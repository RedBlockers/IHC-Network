"use strict";

const mediaService = require("../services/mediaService");

const mediaController = {
    createToken: async (req, res) => {
        const session = await mediaService.createRoomToken(req.user, req.channel);
        res.status(200).json(session);
    },

    webhook: async (req, res) => {
        await mediaService.receiveWebhook(req.body, req.get("Authorization"));
        res.status(204).end();
    },
};

module.exports = mediaController;
