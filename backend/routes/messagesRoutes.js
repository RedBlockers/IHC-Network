const express = require("express");
const router = express.Router();
const messageController = require("../controllers/messageController");
const auth = require("../middlewares/authMiddleware");

router.get("/:guildId/:channelId/messages", messageController.getMessages);
router.post("/:channelId/", auth, messageController.postMessage);
router.get("/:channelId/messages", auth, messageController.getPrivateMessages);
module.exports = router;
