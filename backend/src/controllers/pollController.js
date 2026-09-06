"use strict";

const pollService = require("../services/pollService");

const pollController = {
    create: async (req, res) => res.status(201).json(await pollService.create(req.channel, req.user, req.body)),
    vote: async (req, res) =>
        res
            .status(200)
            .json({ poll: await pollService.vote(req.channel, req.user, req.params.messageId, req.body.optionId) }),
    close: async (req, res) =>
        res.status(200).json({ poll: await pollService.close(req.channel, req.user, req.params.messageId) }),
    get: async (req, res) => {
        const poll = await pollService.forMessage(req.params.messageId, req.user.userId, req.channel.channelId);
        res.status(200).json({ poll });
    },
};

module.exports = pollController;
