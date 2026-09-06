"use strict";

const searchService = require("../services/searchService");

const searchController = {
    searchAll: async (req, res) => {
        res.status(200).json(await searchService.searchAll(req.user, req.validatedQuery));
    },

    searchFiles: async (req, res) => {
        res.status(200).json(await searchService.searchFiles(req.user, req.validatedQuery));
    },

    searchSemantic: async (req, res) => {
        res.status(200).json(await searchService.searchSemantic(req.user, req.validatedQuery));
    },

    searchGuild: async (req, res) => {
        const result = await searchService.searchGuild(req.user, req.guild.guildId, req.validatedQuery);
        res.status(200).json(result);
    },

    searchChannel: async (req, res) => {
        const result = await searchService.searchChannel(req.user, req.channel, req.validatedQuery);
        res.status(200).json(result);
    },

    listPins: async (req, res) => {
        const pins = await searchService.listPins(req.channel.channelId);
        res.status(200).json({ pins });
    },

    pin: async (req, res) => {
        const pins = await searchService.pin(req.channel, req.user, req.params.messageId);
        res.status(201).json({ pins });
    },

    unpin: async (req, res) => {
        const pins = await searchService.unpin(req.channel, req.params.messageId);
        res.status(200).json({ pins });
    },
};

module.exports = searchController;
