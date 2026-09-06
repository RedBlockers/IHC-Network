"use strict";

const webhookService = require("../services/webhookService");

const webhookController = {
    list: async (req, res) => res.status(200).json({ webhooks: await webhookService.list(req.channel) }),

    create: async (req, res) =>
        res.status(201).json({ webhook: await webhookService.create(req.channel, req.user, req.body.name) }),

    revoke: async (req, res) => {
        await webhookService.revoke(req.channel, req.params.webhookId);
        res.status(204).end();
    },

    post: async (req, res) => {
        const message = await webhookService.post(req.params.token, req.body);
        res.status(201).json({ message });
    },
};

module.exports = webhookController;
