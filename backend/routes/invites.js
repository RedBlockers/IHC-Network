const express = require("express");
const guildController = require("../controllers/guildController");
const auth = require("../middlewares/authMiddleware");
const router = express.Router();

router.get("/:inviteCode", guildController.inviteByCode);
router.post("/:guildId", auth, guildController.createInvite);

module.exports = router;
