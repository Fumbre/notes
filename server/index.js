require("dotenv").config();
const express = require("express");
const nunjucks = require("nunjucks");
const cookieParser = require("cookie-parser");
const { setup: authorizations, checkAuth } = require("./auth");
const { errors: errorMessages } = require("./errorsMessage");
const { router: noteRouter } = require("./note");
const app = express();

nunjucks.configure("views", {
  autoescape: true,
  express: app,
});

app.set("view engine", "njk");

app.use(express.json());
app.use(express.static("public"));
app.use(cookieParser());

authorizations(app);

app.get("/", checkAuth(), (req, res) => {
  if (!req?.user || !req?.sessionId) {
    res.render("index", {
      authError:
        req.query.authError === "true"
          ? req.query.code
            ? errorMessages[req.query.code]
            : errorMessages[0]
          : null,
    });
  }
  if (req.user && req.sessionId) {
    res.redirect("/dashboard");
  }
});

app.get("/dashboard", checkAuth(), (req, res) => {
  if (!req?.user?.username || !req?.sessionId) return res.redirect("/");

  res.render("dashboard", {
    username: req.user.username
  });
})

app.use("/api/notes", noteRouter);

// requstions with 404
app.use((req, res, next) => {
  return res.status(404).redirect('/');
});

// requstions with 500
app.use((err, req, res, next) => {
  console.error(err.message);
});

const PORT = process.env.PORT | 3000;

app.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`);
});
