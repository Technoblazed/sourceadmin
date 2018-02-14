const authEnsure = require('connect-ensure-login');
const express = require('express');

const ensureLoggedIn = authEnsure.ensureLoggedIn();
const ensureNotLoggedIn = authEnsure.ensureNotLoggedIn('/');

const router = express.Router();

module.exports = () => {
  router.get('/', ensureLoggedIn, (req, res) => {
    res.render('index', {});
  });

  router.get('/login', ensureNotLoggedIn, (req, res) => {
    res.render('login', {
      PAGE_TITLE: 'Login'
    });
  });

  router.get('/logout', ensureLoggedIn, (req, res) => {
    res.redirect('/auth/logout');
  });

  return router;
};
