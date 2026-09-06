"use strict";

const service = require("../services/notificationSettingsService");

const notificationSettingsController = {
    markChannelRead: async (req, res) => {
        res.status(200).json(await service.markChannelRead(req.user, req.params.channelId));
    },

    list: async (req, res) => res.status(200).json(await service.listSettings(req.user)),

    setGuild: async (req, res) =>
        res.status(200).json({ setting: await service.setLevel(req.user, "guild", req.params.guildId, req.body.level) }),

    setChannel: async (req, res) =>
        res.status(200).json({ setting: await service.setLevel(req.user, "channel", req.params.channelId, req.body.level) }),

    setQuietHours: async (req, res) => res.status(200).json(await service.setQuietHours(req.user, req.body)),

    markRead: async (req, res) =>
        res.status(200).json(await service.markRead(req.user, req.params.channelId, req.params.messageId)),

    unread: async (req, res) => {
        const channelIds = req.validatedQuery.channels.split(",").map(Number).filter(Boolean).slice(0, 200);
        res.status(200).json({ unread: await service.unreadFor(req.user.userId, channelIds) });
    },
};

module.exports = notificationSettingsController;
