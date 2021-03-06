const router = require("express").Router();
const User = require("../models/User");
const wrapper = require("../util/errorWrappers").expressWrapper;
const buildUsername = require("../util/buildUsername");
const EmailService = require('../util/email');

let REDIRECTS = {
  successRedirect: "http://localhost:3000/recipes",
  failureRedirect: "http://localhost:3000/login"
};

if (process.env.NODE_ENV === "production") {
  REDIRECTS = {
    successRedirect: "https://dinnerbell.herokuapp.com/recipes",
    failureRedirect: "https://dinnerbell.herokuapp.com/login"
  };
}

const auth = passport => {
  // User redirect routes, must redirect back to the front-end!
  router.get(
    "/google",
    passport.authenticate("google", { scope: ["profile"] })
  );
  router.get("/google/callback", passport.authenticate("google", REDIRECTS));

  router.get("/facebook", passport.authenticate("facebook"));
  router.get(
    "/facebook/callback",
    passport.authenticate("facebook", REDIRECTS)
  );

  // Redirect back to the frontend on passport errors
  router.use((err, req, res, next) => {
    err =
      err.name === "ValidationError" ? "Warning, username already taken" : err;
    req.session.user = { errors: [err] };
    res.redirect(REDIRECTS.failureRedirect);
  });

  const getCurrentUser = async (req, res) => {
    let user = req.session.user;
    if (user && user.error) {
      req.session.user = null;
    } else if (user) {
      req.session.user = await User.findOne({ _id: user._id });
    }
    res.json(req.session.user);
  };
  router.get("/current-user", wrapper(getCurrentUser));

  router.post("/login", passport.authenticate("local"), (req, res) => {
    res.json(req.session.user);
  });

  const register = async (req, res) => {
    const { password, email } = req.body;
    const username = buildUsername();
    const user = await User.createLocalUser({ email, password, username });
    
    if (!user.errors) {
      req.session.user = user;

      const options = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `Welcome to Dinnerbell ${username}!`,
        text: `Thanks for signing up! Dinnerbell helps you discover and share new recipes with friends and family.`
      };

      await EmailService.send(options);
    }
    res.json(user);
  };
  router.post("/register", wrapper(register));

  router.all("/logout", (req, res) => {
    req.session.destroy();
    req.logout();
    res.json({ message: "logged out" });
  });

  return router;
};

module.exports = auth;
