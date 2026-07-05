const express = require("express");
const router = express.Router();
const messageController = require("../controllers/messageController");
const auth = require("../middlewares/authMiddleware");
const checkGuildMembership = require("../middlewares/guildMiddleware");
const validate = require("../middlewares/validate");
const { postMessageSchema } = require("../validators/messageValidator");

// DM en premier pour éviter que "dm" soit interprété comme guildId
router.get("/dm/:channelId", auth, messageController.getPrivateMessages);

// Messages d'un channel de guilde
router.get("/:guildId/:channelId", auth, checkGuildMembership, messageController.getMessages);

// Envoi d'un message (guild ou DM)
router.post("/:channelId", auth, validate(postMessageSchema), messageController.postMessage);

module.exports = router;
