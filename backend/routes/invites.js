const express = require("express");
const guildController = require("../controllers/guildController");
const auth = require("../middlewares/authMiddleware");
const router = express.Router();

// Rejoindre une guilde via un code d'invitation
router.get("/:inviteCode", auth, guildController.inviteByCode);

module.exports = router;
