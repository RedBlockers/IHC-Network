const express = require("express");
const guildController = require("../controllers/guildController");

const router = express.Router();

router.get("/getGuildsByUser", guildController.getGuildsByUser);
router.post("/createGuild", guildController.createGuild);
router.post("/createInvite", guildController.createInvite);
router.get("/invite", guildController.inviteByCode);

module.exports = router;
