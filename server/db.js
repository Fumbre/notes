require("dotenv").config();
const { MongoClient, ObjectId } = require("mongodb");
const { nanoid } = require("nanoid");
const bcrypt = require("bcrypt");
const saltRounds = 10;

const client = new MongoClient(process.env.DB_URI, {
  maxPoolSize: 10,
});

(async () => {
  const maxRetries = 5;
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      await client.connect();
      console.log("Connected to MongoDB");
      break;
    } catch (err) {
      attempts++;
      console.error(`Failed to connect to MongoDB. Attempt ${attempts}/${maxRetries}.`, err);
      if (attempts >= maxRetries) {
        console.error("Max retries reached. Exiting.");
        process.exit(1);
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
})();

process.on("SIGINT", async () => {
  await client.close();
  console.log("MongoDB connection closed");
  process.exit(0);
});

async function connectToCollection(name) {
  try {
    const collection = client.db("Notes").collection(name);
    return collection;
  } catch (err) {
    console.error(`Can not connect to collection ${name}` + err);
    throw new Error('Failed to connect to data base');
  }
}

async function createSession(userId) {
  try {
    const session = await (await connectToCollection("sessions")).insertOne({
      userId
    });
    return session.insertedId
  } catch (err) {
    console.error("userId has to be type of objectId()");
    throw err;
  }
}

async function deleteSession(id) {
  try {
    const sessionId = new ObjectId(`${id}`);
    const session = await (await connectToCollection("sessions")).deleteOne({
      _id: sessionId,
    });
    if (session.deletedCount !== 1) throw new Error("cann't find session");
  } catch (err) {
    throw err
  }
}

async function findUserByUsername(username) {
  try {
    const user = await (await connectToCollection("users")).findOne({
      username
    });
    if (!user) return null;
    return user._id;
  } catch (err) {
    throw err;
  }
}

async function findUserIdBySessionId(id) {
  try {
    const sessionId = new ObjectId(`${id}`);
    const session = await (await connectToCollection("sessions")).findOne({
      _id: sessionId,
    })
    if (!session) return null;
    return session.userId;
  } catch (err) {
    throw err
  }
}
async function findUsernameByUserId(userId) {
  try {
    const user = await (await connectToCollection("users")).findOne({
      _id: userId,
    })
    if (!user) return null;
    return user.username;
  } catch (err) {
    throw err
  }
}

async function createUser(username, password) {
  const isUserExist = await findUserByUsername(username);
  if (isUserExist) return null;
  try {
    const hash = await bcrypt.hash(!password ? nanoid() : password, saltRounds).then(hash => hash);
    const user = await (await connectToCollection("users")).insertOne({
      username: `${username}`,
      password: `${hash}`
    });
    await createNote(user.insertedId, 'Тестовая заметка', `# Возможности Markdown
Markdown — это простой язык разметки для форматирования текста. Вот основные возможности:
**НАЖМИТЕ РЕДАКТИРОВАТЬ ДЛЯ ПРОСМОТРА СИНТАКСИСА**
## Заголовки
"# Заголовок первого уровня"
"## Заголовок второго уровня"
"### Заголовок третьего уровня и тд."

Результат:
# Заголовок первого уровня
## Заголовок второго уровня
### Заголовок третьего уровня

## Форматирование текста
Markdown поддерживает базовое форматирование:

Жирный текст: оберните текст в ** или __
Пример: **жирный текст**
Курсив: оберните текст в * или _
Пример: *курсив*
Зачёркнутый текст: используйте ~~
Пример: ~~зачёркнутый текст~~

## Списки
Вы можете создавать упорядоченные и неупорядоченные списки:

Неупорядоченный список: используйте -, *, или +
- Первый пункт
- Второй пункт

1. Первый пункт
2. Второй пункт

### Гиперссылки
Создание ссылок очень просто:
"[Текст ссылки](URL)"
Пример:
[Markdown Guide](https://www.markdownguide.org)

### Изображения
Вставка изображений схожа с гиперссылками, только добавляется восклицательный знак:
![Описание изображения](URL-изображения)

### Цитаты
Цитаты создаются с помощью символа >:
> Это цитата
> Она может занимать несколько строк

Эти функции Markdown помогут вам эффективно оформлять текст. `);
    return user.insertedId;
  } catch (err) {
    throw err;
  }

}

async function makeAuthorization(username, password) {
  try {
    const userId = await findUserByUsername(username);
    if (!userId) return { code: 2 };
    const user = await (await connectToCollection("users")).findOne({
      _id: userId,
    });
    const isPasswordCorrect = await bcrypt.compare(password, user.password).then(result => result);
    if (!isPasswordCorrect) return { code: 3 };
    return { userId };
  } catch (err) {
    throw err
  }

}

function escapeRegex(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function getNotes(userId, age, page, findparam = false) {
  try {
    const pageSize = 8;
    const byCreateDate = age === 'archive' ? { archivedAt: -1 } : { _id: -1 };
    const filter = () => {
      const dateNow = new Date();
      if (age === '1month') {
        dateNow.setMonth(dateNow.getMonth() - 1);
        return ObjectId.createFromTime(dateNow.getTime() / 1000);
      }
      if (age === '3months') {
        dateNow.setMonth(dateNow.getMonth() - 3);
        return ObjectId.createFromTime(dateNow.getTime() / 1000);
      }
      return false
    }
    const query = findparam ? {
      userId,
      title: { $regex: escapeRegex(findparam), $options: "i" },
      ...(age === 'archive'
        ? { archivedAt: { $ne: null } }
        : { archivedAt: null }
      )
    } : {
      ...(filter()
        ? { _id: { $gte: filter() } }
        : {}),
      userId,
      ...(age === 'archive'
        ? { archivedAt: { $ne: null } }
        : { archivedAt: null }
      ),
    }

    const notes = await (await connectToCollection("notes")).find(query)
      .sort(byCreateDate)
      .skip((page - 1) * pageSize)
      .limit(pageSize + 1)
      .toArray();

    const hasMore = notes.length > pageSize
    if (hasMore) {
      notes.pop()
    }
    if (notes) {
      notes.map(item => item.created = item._id.getTimestamp());
      return { notes, hasMore }
    }
  } catch (err) {
    throw err
  }
}

async function createNote(userId, title, text) {
  try {
    const note = await (await connectToCollection("notes")).insertOne({
      userId,
      title,
      text,
    });
    return note.insertedId
  } catch (err) {
    throw err
  }
}

async function getNote(noteId) {
  try {
    const id = new ObjectId(`${noteId}`);
    const note = await (await connectToCollection("notes")).findOne({
      _id: id
    });
    if (!note) {
      return null
    }
    return note;
  } catch (err) {
    throw err
  }
}

async function updateNote(noteId, body) {
  try {
    const id = new ObjectId(`${noteId}`);
    const note = await (await connectToCollection("notes")).updateOne(
      { _id: id },
      {
        $set: {
          title: body.title,
          text: body.text
        }
      });
    if (note.matchedCount === 0) {
      return null
    }
    return note;
  } catch (err) {
    throw err
  }
}

async function makeNoteArchive(noteId) {
  try {
    const id = new ObjectId(`${noteId}`);
    const note = await (await connectToCollection("notes")).updateOne({
      _id: id,
    }, {
      $set: {
        archivedAt: new Date(),
      }
    });
    if (note.matchedCount === 0) {
      return null;
    }
    return note;
  } catch (err) {
    throw err
  }
}

async function makeNoteUnarchive(noteId) {
  try {
    const id = new ObjectId(`${noteId}`);
    const note = await (await connectToCollection("notes")).updateOne({
      _id: id,
    }, {
      $set: {
        archivedAt: null,
      }
    });
    if (note.matchedCount === 0) {
      return null;
    }
    return note;
  } catch (err) {
    throw err
  }
}

async function deleteNote(noteId) {
  try {
    const id = new ObjectId(`${noteId}`);
    const note = await (await connectToCollection("notes")).deleteOne({ _id: id });
    if (note.deletedCount === 0) {
      return null
    }
    return note;
  } catch (err) {
    throw err
  }
}

async function deleteAllArchivedNotes(userId) {
  try {
    const note = await (await connectToCollection("notes")).deleteMany({
      userId,
      archivedAt: { $ne: null }
    });
    if (note.deletedCount === 0) {
      return null
    }
    return note;
  } catch (err) {
    throw err
  }
}

module.exports = {
  createSession,
  deleteSession,
  createUser,
  makeAuthorization,
  findUserIdBySessionId,
  findUsernameByUserId,
  findUserByUsername,
  getNotes,
  createNote,
  getNote,
  updateNote,
  makeNoteArchive,
  makeNoteUnarchive,
  deleteNote,
  deleteAllArchivedNotes
}
