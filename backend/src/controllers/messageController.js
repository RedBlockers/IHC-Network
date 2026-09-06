"use strict";

const messageService = require("../services/messageService");

const messageController = {
    reactionAuthors: async (req, res) => {
        const { emoji } = req.params;
        res.status(200).json(await messageService.reactionAuthors(req.channel, req.params.messageId, decodeURIComponent(emoji)));
    },

    favoriteReactions: async (req, res) => {
        res.status(200).json({ emojis: await messageService.favoriteReactions(req.user.userId) });
    },

    list: async (req, res) => {
        const { limit, before } = req.validatedQuery;
        const result = await messageService.listMessages(req.channel, { limit, before }, req.user.userId);
        res.status(200).json(result);
    },

    post: async (req, res) => {
        const message = await messageService.postMessage(req.channel, req.user, {
            content: req.body.content,
            replyToId: req.body.replyToId,
            attachmentIds: req.body.attachmentIds,
            clientNonce: req.body.clientNonce,
        });
        res.status(201).json({ message });
    },

    edit: async (req, res) => {
        const message = await messageService.editMessage(req.channel, req.user, req.params.messageId, req.body.content);
        res.status(200).json({ message });
    },

    remove: async (req, res) => {
        await messageService.deleteMessage(req.channel, req.user, req.params.messageId);
        res.status(204).end();
    },

    addReaction: async (req, res) => {
        const reaction = await messageService.toggleReaction(req.channel, req.user, req.params.messageId, req.body.emoji, true);
        res.status(201).json({ reaction });
    },

    removeReaction: async (req, res) => {
        const reaction = await messageService.toggleReaction(req.channel, req.user, req.params.messageId, req.params.emoji, false);
        res.status(200).json({ reaction });
    },
};

module.exports = messageController;
