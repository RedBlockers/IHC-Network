const express = require("express");
const multer = require("multer");
const guildController = require("../controllers/guildController");
const channelController = require("../controllers/channelController");
const auth = require("../middlewares/authMiddleware");
const checkGuildMembership = require("../middlewares/guildMiddleware");
const validate = require("../middlewares/validate");
const { createGuildSchema } = require("../validators/guildValidator");
const { createChannelSchema } = require("../validators/channelValidator");

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
        allowed.includes(file.mimetype)
            ? cb(null, true)
            : cb(new Error(`Type non supporté : ${file.mimetype}`));
    },
});

router.post("/", auth, upload.single("guildImage"), validate(createGuildSchema), guildController.createGuild);

router.get("/:guildId", auth, checkGuildMembership, guildController.getGuildById);
router.get("/:guildId/channels", auth, checkGuildMembership, channelController.getChannels);
router.get("/:guildId/defaultChannel", auth, checkGuildMembership, guildController.getDefaultChannel);

// Channel creation imbriquée sous la guilde (REST)
router.post("/:guildId/channels", auth, checkGuildMembership, validate(createChannelSchema), channelController.createChannel);

// Invitations
router.post("/:guildId/invites", auth, checkGuildMembership, guildController.createInvite);

module.exports = router;
