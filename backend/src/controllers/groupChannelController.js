"use strict";

const service = require("../services/groupChannelService");

const groupChannelController = {
    list: async (req, res) => res.status(200).json({ groups: await service.list(req.user.userId) }),

    create: async (req, res) => res.status(201).json(await service.create(req.user, req.body)),

    participants: async (req, res) =>
        res.status(200).json({ participants: await service.participants(req.channel) }),

    add: async (req, res) =>
        res.status(200).json(await service.addParticipant(req.channel, req.user, req.params.userId)),

    remove: async (req, res) => {
        await service.removeParticipant(req.channel, req.user, req.params.userId);
        res.status(204).end();
    },
};

module.exports = groupChannelController;
