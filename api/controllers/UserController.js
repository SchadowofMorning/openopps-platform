/**
 * UserController
 *
 * @module		:: Controller
 * @description	:: Get and update information about currently logged in user.
 */
var async = require('async');
var _ = require('underscore');
var tagUtils = require('../services/utils/tag');

var update = function (req, res) {
  var user = req.user[0];
  var params = _.extend(req.body || {}, req.params);
  sails.log.debug(params);
  if (params.name) { user.name = params.name; }
  if (params.username) { user.username = params.username; }
  if (params.email) { user.email = params.email; }
  if (params.photoId) { user.photoId = params.photoId; }
  if (params.photoUrl) { user.photoUrl = params.photoUrl; }
  if (params.title) { user.title = params.title; }
  if (params.bio) { user.bio = params.bio; }
  // The main user object is being updated
  if (user) {
    sails.log.debug('User Update:', user);
    user.save(function (err) {
      if (err) { return res.send(400, {message:'Error while saving user.'}) }
      // Check if a userauth was removed
      if (params.auths) {
        var checkAuth = function(auth, done) {
          if (_.contains(params.auths, auth.provider)) {
            return done();
          }
          auth.destroy(done);
        };

        UserAuth.findByUserId(req.user[0].id, function (err, auths) {
          if (err) { return res.send(400, {message:'Error finding authorizations.'}); }
          async.each(auths, checkAuth, function(err) {
            if (err) { return res.send(400, {message:'Error finding authorizations.'}); }
            user.auths = params.auths;
            return res.send(user);
          });
        });
      } else {
        res.send(user);
      }
    });
  }
};

module.exports = {

  /**
   * Check if a given username already exists
   *
   * @params :id of the username to test, eg:
   *         user/username/:id such as user/username/foo
   */
  username: function (req, res) {
    User.findOneByUsername(req.route.params.id, function (err, user) {
      if (err) { return res.send(400, {message:'Error looking up username.'}); }
      if (user && req.user[0].id != user.id) return res.send(true);
      return res.send(false);
    });
  },

  info: function (req, res) {
    if (req.route.params.id) {
      User.findOneById(req.route.params.id, function (err, user) {
        if (err) { return res.send(400, {message:'Error looking up user.'}); }
        if (!user) { return res.send(404, { message: 'User not found.'}); }
        sails.log.debug('User Get:', user);
        var cleanUser = {
          id: user.id,
          name: user.name,
          username: user.username,
          photoId: user.photoId,
          title: user.title,
          bio: user.bio,
          likeCount: 0,
          isOwner: false,
          createdAt: user.createdAt
        }
        if (req.user && (req.route.params.id == req.user[0].id)) {
          cleanUser.isOwner = true;
        }
        tagUtils.assemble({ userId: req.route.params.id }, function (err, tags) {
          if (err) { return res.send(400, { message: "Error looking up tags."}); }
          for (i in tags) {
            delete tags[i].projectId;
            delete tags[i].taskId;
            delete tags[i].updatedAt;
            delete tags[i].deletedAt;
            delete tags[i].userId;
          }
          cleanUser.tags = tags;
          return res.send(cleanUser);
        });
      });
    }
  },

  index: function(req, res) {
    // If the user is not logged in, return null object
    if (!req.user) {
      return res.send(403, null);
    }
    // Get information about the currently logged in user
    if (req.route.method === 'get') {
      // Look up which providers the user has authorized
      UserAuth.findByUserId(req.user[0].id, function (err, auths) {
        if (err) { return res.send(400, {message:'Error looking up user authorizations.'}); }
        var user = req.user[0];
        user.auths = [];
        for (var i = 0; i < auths.length; i++) {
          user.auths.push(auths[i].provider);
        }
        // Look up the user's email addresses
        UserEmail.findByUserId(req.user[0].id, function (err, emails) {
          if (err) { return res.send(400, {message:'Error looking up user email addresses.'}); }
          user.isOwner = true;
          user.likeCount = 0;
          user.emails = [];
          if (emails) { user.emails = emails; }
          tagUtils.assemble({ userId: req.user[0].id }, function (err, tags) {
            if (err) { return res.send(400, { message: "Error looking up tags."}); }
            for (i in tags) {
              delete tags[i].projectId;
              delete tags[i].taskId;
              delete tags[i].updatedAt;
              delete tags[i].deletedAt;
              delete tags[i].userId;
            }
            user.tags = tags;
            sails.log.debug('User Get:', user);
            return res.send(user);
          });
        });
      });
    }
    // Update information about the currently logged in user
    else if (req.route.method === 'put') {
      return update(req, res);
    } else {
      return res.send(400, {message:'Invalid Operation.'});
    }
  },

  update: function (req, res) {
    return update(req, res);
  },

  photo: function(req, res) {
    if (req.route.params.id) {
      User.findOneById(req.route.params.id, function (err, user) {
        if (err || !user) { return res.redirect('/images/default-user-icon-profile.png'); }
        if (user.photoId) {
          return res.redirect('/api/file/get/' + user.photoId);
        } else if (user.photoUrl) {
          return res.redirect(user.photoUrl);
        } else {
          return res.redirect('/images/default-user-icon-profile.png');
        }
      });
    }
  }
};
