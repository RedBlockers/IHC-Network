"use strict";

const threadService = require("../services/threadService");

const threadController = {
    update: async (req, res) =>
        res.json({ thread: await threadService.update(req.channel, req.user, req.params.messageId, req.body) }),
    open: async (req, res) => {
        const thread = await threadService.open(req.channel, req.user, req.params.messageId, req.body.title);
        res.status(201).json({ thread });
    },

    openTopic: async (req, res) => {
        const thread = await threadService.openTopic(req.channel, req.user, req.body);
        res.status(201).json({ thread });
    },

    list: async (req, res) => {
        const threads = await threadService.list(req.channel, req.user, req.validatedQuery.limit);
        res.status(200).json({ threads });
    },

    messages: async (req, res) => {
        const result = await threadService.messages(req.channel, req.params.messageId);
        res.status(200).json(result);
    },

    reply: async (req, res) => {
        const message = await threadService.reply(req.channel, req.user, req.params.messageId, req.body.content);
        res.status(201).json({ message });
    },

    follow: async (req, res) => {
        const thread = await threadService.setFollowing(req.channel, req.user, req.params.messageId, true);
        res.status(200).json({ thread });
    },

    unfollow: async (req, res) => {
        const thread = await threadService.setFollowing(req.channel, req.user, req.params.messageId, false);
        res.status(200).json({ thread });
    },
};

module.exports = threadController;
