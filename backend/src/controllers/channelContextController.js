"use strict";

const accessService = require("../services/accessService");
const moderationService = require("../services/moderationService");
const channelModes = require("../domain/channelModes");

async function read(req, res) {
    const permissions = await accessService.effectiveChannelPermissions(
        req.user.userId,
        req.channel.channelId,
        req.channel
    );
    const timedOut = req.channel.guildId && (await moderationService.isTimedOut(req.channel.guildId, req.user.userId));
    const expired = Boolean(req.channel.expiresAt && new Date(req.channel.expiresAt).getTime() <= Date.now());
    res.json({
        channelId: Number(req.channel.channelId),
        mode: channelModes.resolveMode(req.channel.type, req.channel.customMode),
        permissions,
        writable: !req.channel.suspendedAt && !timedOut && !expired && permissions.includes("SEND_MESSAGES"),
        expired,
        suspended: Boolean(req.channel.suspendedAt),
        timedOut: Boolean(timedOut),
    });
}

module.exports = { read };
