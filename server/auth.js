require("dotenv").config();
const bodyParser = require("body-parser");
const {
  createSession,
  deleteSession,
  createUser,
  makeAuthorization,
  findUserIdBySessionId,
  findUsernameByUserId,
  findUserByUsername,
  getNote,
} = require("./db");
const axios = require('axios');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = `${process.env.REDIRECT_URI}/auth/google/callback`;
const BASE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

const checkAuth = () => async (req, res, next) => {
  const sessionId = req?.cookies["sessionId"];
  if (!sessionId) {
    return next();
  }
  try {
    const userId = await findUserIdBySessionId(sessionId);
    if (!userId) return next();
    const username = await findUsernameByUserId(userId);
    if (!username) return next();
    req.user = { userId, username };
    req.sessionId = sessionId;
    next();
  } catch (err) {
    return next();
  }
}

const checkNotePremision = () => async (req, res, next) => {
  const sessionId = req?.cookies["sessionId"];
  if (!sessionId) {
    return res.status(401).send("Not authorized");
  }
  try {
    if (!req.params.id || !req.user) {
      return res.status(400).send("Invalid request parameters");
    }
    const { userId } = await getNote(req.params.id);
    if (!userId) return res.status(401).send("Not authorized");
    if (req.user.userId.toString() !== userId.toString()) return res.status(401).send("Not authorized");
    next();
  } catch (err) {
    return res.status(401).send("Not authorized");
  }
};

function isFieldEmpty(username, password) {
  if (!username && !password) return { code: 4 };
  if (!username) return { code: 5 };
  if (!password) return { code: 6 };
  return false;
}

const setup = (app) => {

  app.post("/login", bodyParser.urlencoded({ extended: false }), async (req, res) => {
    const { username, password } = req.body;
    const isEmpty = isFieldEmpty(username, password);
    if (isEmpty) return res.redirect(`/?authError=true&code=${isEmpty.code}`);

    try {
      const auth = await makeAuthorization(username, password);
      if (auth?.code) return res.redirect(`/?authError=true&code=${auth.code}`);

      const sessionId = await createSession(auth.userId);
      return res.cookie("sessionId", sessionId, { httpOnly: true }).redirect("/");
    } catch (err) {
      throw err
    }

  });

  app.get("/auth/google", (req, res) => {
    const url = `${BASE_URL}?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=email%20profile`;
    res.redirect(url);
  });

  app.get('/auth/google/callback', async (req, res) => {
    const { code } = req.query;

    if (!code) {
      return res.redirect('/?authError=true&code=0');
    }

    try {
      const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      });

      const { access_token } = tokenResponse.data;

      const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });

      const user = userInfoResponse.data;

      const isUserExist = await findUserByUsername(user.email);
      const userId = !isUserExist ? await createUser(user.email, false) : isUserExist;
      const sessionId = await createSession(userId);

      req.sessionId = sessionId;

      return res.cookie("sessionId", sessionId, { httpOnly: true }).redirect("/dashboard");
    } catch (err) {
      console.error('Ошибка авторизации:', err.message);
      res.redirect('/?authError=true&code=0');
    }
  });

  app.post("/signup", bodyParser.urlencoded({ extended: false }), async (req, res) => {
    const { username, password } = req.body;
    const isEmpty = isFieldEmpty(username, password);
    if (isEmpty) return res.redirect(`/?authError=true&code=${isEmpty.code}`);

    try {
      const userId = await createUser(username, password);
      if (!userId) return res.redirect(`/?authError=true&code=${7}`);

      const sessionId = await createSession(userId);
      return res.cookie("sessionId", sessionId, { httpOnly: true }).redirect("/");
    } catch (err) {
      throw err;
    }
  },
  );

  app.get("/logout", async (req, res) => {
    if (req?.cookies["sessionId"]) {
      try {
        await deleteSession(req.cookies["sessionId"]);
      } finally {
        return res.clearCookie("sessionId").redirect("/");
      }
    }
    return res.redirect("/");
  })

};

module.exports = { setup, checkAuth, checkNotePremision };
