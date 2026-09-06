"use strict";

const { Router } = require("express");

const router = Router();

router.use("/auth", require("./authRoutes"));
router.use("/users", require("./userRoutes"));
router.use("/friends", require("./friendRoutes"));
router.use("/guilds", require("./guildRoutes"));
router.use("/invites", require("./inviteRoutes"));
router.use("/channels", require("./channelRoutes"));
router.use("/notifications", require("./notificationRoutes"));
router.use("/account", require("./accountRoutes"));
router.use("/friend-groups", require("./friendGroupRoutes"));
router.use("/status", require("./statusRoutes"));
router.use("/organisation", require("./organisationRoutes"));
router.use("/search", require("./searchRoutes"));
router.use("/links", require("./linkRoutes"));
router.use("/webhooks", require("./webhookRoutes"));
router.use("/e2ee", require("./e2eeRoutes"));
router.use("/bots", require("./botRoutes"));
router.use("/activities", require("./activityRoutes"));

module.exports = router;
