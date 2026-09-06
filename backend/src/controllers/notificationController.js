"use strict";

const notificationService = require("../services/notificationService");
const settingsService = require("./../services/notificationSettingsService");
const pushService = require("../services/pushService");

const notificationController = {
    list: async (req, res) => {
        const { limit, filter, before } = req.validatedQuery;
        res.status(200).json(await notificationService.list(req.user.userId, { limit, filter, before }));
    },
    digest: async (req, res) => {
        const settings = await settingsService.listSettings(req.user);
        res.status(200).json(await notificationService.digest(req.user.userId, settings.digestFrequency));
    },
    markRead: async (req, res) => {
        await notificationService.markRead(req.user.userId, req.params.notificationId);
        res.status(204).end();
    },
    markAllRead: async (req, res) => {
        await notificationService.markAllRead(req.user.userId, req.validatedQuery?.filter);
        res.status(204).end();
    },

    pushKey: async (_req, res) => {
        res.status(200).json(pushService.publicKey());
    },
    pushDevices: async (req, res) => {
        res.status(200).json({ devices: await pushService.list(req.user.userId) });
    },
    subscribePush: async (req, res) => {
        res.status(201).json(await pushService.subscribe(req.user, req.body.subscription, req.body.deviceLabel));
    },
    unsubscribePush: async (req, res) => {
        res.status(200).json(await pushService.unsubscribe(req.user, req.body.endpoint));
    },
};

module.exports = notificationController;
