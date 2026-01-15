const { marked } = require("marked");
const { checkAuth, checkNotePremision } = require("./auth");
const router = require("express").Router();
const pdf = require("html-pdf");
const contentDisposition = require('content-disposition')

const {
  getNotes,
  createNote,
  getNote,
  updateNote,
  makeNoteArchive,
  makeNoteUnarchive,
  deleteNote,
  deleteAllArchivedNotes
} = require("./db");

router.get("/", checkAuth(), async (req, res) => {
  try {
    const queryData = req.query;
    const notes = queryData.search ? await getNotes(req.user.userId, queryData.age, queryData.page, queryData.search) : await getNotes(req.user.userId, queryData.age, queryData.page);
    if (queryData.search) {
      notes.notes.map(item => {
        const regex = new RegExp(`(${queryData.search})`, "gi");
        item.highlights = item.title.replace(regex, "<mark>$1</mark>");
      });
    }

    const data = {
      data: notes.notes,
      hasMore: notes?.hasMore ? true : false,
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).redirect('/');
  }
});

router.get("/note/:id", checkAuth(), checkNotePremision(), async (req, res) => {
  try {
    const id = req.params.id;
    const note = await getNote(id);
    if (!note) {
      return res.status(404).send("Note not found");
    }

    const options = {
      breaks: true,
      gfm: true,
      xhtml: true,
    };

    note.html = marked(note.text, options);
    return res.status(200).json(note);
  } catch (err) {
    console.error(err);
    return res.status(500).redirect('/');
  }
});

router.get("/note-to-pdf/:id", checkAuth(), checkNotePremision(), async (req, res) => {
  const id = req.params.id;
  try {
    const note = await getNote(id);
    if (!note) {
      return res.status(404).send("Note not found")
    }
    const options = {
      breaks: true,
      gfm: true,
      xhtml: true,
    };

    note.html = marked(note.text, options);
    pdf.create(note.html, { format: "A4" }).toStream((err, stream) => {
      if (err) {
        res.status(500).send("Error while making PDF");
        return;
      }

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", contentDisposition(`${note.title}.pdf`));
      stream.pipe(res);
    });
  } catch (err) {
    console.error('Error generating PDF:', err);
    res.status(500).send('Failed to generate PDF');
  }
})

router.post("/", checkAuth(), async (req, res) => {
  try {
    const body = req.body
    const noteId = await createNote(req.user.userId, body.title, body.text)
    if (!noteId) {
      return res.status(400).send("Can't create note, bad request");
    }
    return res.status(201).json({ _id: noteId });
  } catch (err) {
    console.error(err);
    return res.status(500).redirect('/');
  }

});

router.patch("/note/:id", checkAuth(), checkNotePremision(), async (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body;
    if (!body?.title && !body?.text) return res.status(400);
    const note = await updateNote(id, body);
    if (!note) {
      return res.status(404).send("Note not found");
    }
    return res.status(200).json(note);
  } catch (err) {
    console.error(err);
    return res.status(500).redirect('/');
  }
});

router.put("/note-archive/:id", checkAuth(), checkNotePremision(), async (req, res) => {
  try {
    const id = req.params.id;
    const note = await makeNoteArchive(id);
    if (!note) {
      return res.status(404).send("Note not found");
    }
    return res.status(200).json(note);
  } catch (err) {
    console.error(err);
    return res.status(500).redirect('/');
  }
});

router.put("/note-unarchive/:id", checkAuth(), checkNotePremision(), async (req, res) => {
  try {

    const id = req.params.id;
    const note = await makeNoteUnarchive(id);
    if (!note) {
      return res.status(404).send("Note not found");
    }
    return res.status(200).json(note);
  } catch (err) {
    console.error(err);
    return res.status(500).redirect('/');
  }
});

router.delete("/note/:id", checkAuth(), checkNotePremision(), async (req, res) => {
  try {
    const id = req.params.id;
    const note = await deleteNote(id);
    if (!note) {
      return res.status(404).send("Note not found");
    }
    return res.status(200).json(note);
  } catch (err) {
    console.error(err);
    return res.status(500).redirect('/');
  }
});

router.delete("/note-archive/deleteAll", checkAuth(), async (req, res) => {
  try {
    const userId = req.user.userId;
    const note = await deleteAllArchivedNotes(userId);
    if (!note) {
      return res.status(404).send("Notes not found");
    }
    return res.status(200).json(note);
  } catch (err) {
    console.error(err);
    return res.status(500).redirect('/');
  }
});


module.exports = { router };