const express = require("express");
const guildController = require("../controllers/guildController");
const channelController = require("../controllers/channelController");
const auth = require("../middlewares/authMiddleware");
const checkGuildMembership = require("../middlewares/guildMiddleware");
const validate = require("../middlewares/validate");
const { createGuildSchema } = require("../validators/guildValidator");

const router = express.Router();

router.get(
    "/:guildId/channels",
    auth,
    checkGuildMembership,
    channelController.getChannels
);
router.get(
    "/:guildId/defaultChannel",
    auth,
    checkGuildMembership,
    guildController.getDefaultChannel
);
router.get(
    "/:guildId",
    auth,
    checkGuildMembership,
    guildController.getGuildById
);
router.post(
    "/",
    auth,
    validate(createGuildSchema),
    guildController.createGuild
);

module.exports = router;
