var mongoose = require("mongoose");
var router = require("express").Router();
var passport = require("passport");
var User = mongoose.model("User");
var auth = require("../auth");
const { sendEvent } = require("../../lib/event");

router.get("/user", auth.required, function(req, res, next) {
  User.findById(req.payload.id)
    .then(function(user) {
      if (!user) {
        return res.sendStatus(401);
      }

      return res.json({ user: user.toAuthJSON() });
    })
    .catch(next);
});

router.put("/user", auth.required, function(req, res, next) {
  User.findById(req.payload.id)
    .then(function(user) {
      if (!user) {
        return res.sendStatus(401);
      }

      // only update fields that were actually passed...
      if (typeof req.body.user.username !== "undefined") {
        user.username = req.body.user.username;
      }
      if (typeof req.body.user.email !== "undefined") {
        user.email = req.body.user.email;
      }
      if (typeof req.body.user.bio !== "undefined") {
        user.bio = req.body.user.bio;
      }
      if (typeof req.body.user.image !== "undefined") {
        user.image = req.body.user.image;
      }
      if (typeof req.body.user.password !== "undefined") {
        user.setPassword(req.body.user.password);
      }

      return user.save().then(function() {
        return res.json({ user: user.toAuthJSON() });
      });
    })
    .catch(next);
});

router.post("/users/login", function(req, res, next) {
  if (!req.body.user.email) {
    return res.status(422).json({ errors: { email: "can't be blank" } });
  }

  if (!req.body.user.password) {
    return res.status(422).json({ errors: { password: "can't be blank" } });
  }

  passport.authenticate("local", { session: false }, function(err, user, info) {
    if (err) {
      return next(err);
    }

    if (user) {
      user.token = user.generateJWT();
      return res.json({ user: user.toAuthJSON() });
    } else {
      return res.status(422).json(info);
    }
  })(req, res, next);
});

router.post("/users", function(req, res, next) {
  var user = new User();

  user.username = req.body.user.username;
  user.email = req.body.user.email;
  user.setPassword(req.body.user.password);

  user
    .save()
    .then(function() {
      sendEvent('user_created', { username: req.body.user.username })
      return res.json({ user: user.toAuthJSON() });
    })
    .catch(next);
});

module.exports = router;

// integrated isVerified field into /items API response for each seller
router.get("/", auth.optional, function(req, res, next) {
  var query = {};
  var limit = 20;
  var offset = 0;

  if (typeof req.query.limit !== "undefined") {
    limit = req.query.limit;
  }

  if (typeof req.query.offset !== "undefined") {
    offset = req.query.offset;
  }

  Promise.all([
    req.payload ? User.findById(req.payload.id) : null,
    Item.find(query)
      .limit(Number(limit))
      .skip(Number(offset))
      .populate("seller")
      .exec(),
    Item.countDocuments(query).exec()
  ])
    .then(function(results) {
      var user = results[0];
      var items = results[1];
      var itemsCount = results[2];

      return res.json({
        items: items.map(function(item) {
          return item.toJSONFor(user);
        }),
        itemsCount: itemsCount
      });
    })
    .catch(next);
});

const {toggleIsVerified} = require('../../lib/userUtils');

//new endpoint to toggle user's verification status
router.post("/toggle-verify", auth.required, function(req, res, next) {
  User.findById(req.payload.id)
    .then(function(user) {
      if (!user) {
        return res.sendStatus(401);
      }

      toggleIsVerified(user)
        .then(updatedUser => {
          return res.json({ user: updatedUser.toAuthJSON() });
        })
        .catch(next);
    })
    .catch(next);
});
