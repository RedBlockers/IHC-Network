"use strict";

const service = require("../services/organisationService");

const organisationController = {
    overview: async (req, res) => res.status(200).json(await service.overview(req.user.userId)),

    createFolder: async (req, res) =>
        res.status(201).json({ folder: await service.createFolder(req.user.userId, req.body) }),

    updateFolder: async (req, res) =>
        res.status(200).json({ folder: await service.updateFolder(req.user.userId, req.params.folderId, req.body) }),

    deleteFolder: async (req, res) => {
        await service.deleteFolder(req.user.userId, req.params.folderId);
        res.status(204).end();
    },

    placeGuild: async (req, res) =>
        res.status(200).json(await service.placeGuild(req.user.userId, req.params.guildId, req.body)),

    setChannelFavorite: async (req, res) =>
        res.status(200).json(await service.setChannelFavorite(req.user.userId, req.params.channelId, req.body.isFavorite)),

    setDisplay: async (req, res) =>
        res.status(200).json(await service.setHideReadChannels(req.user.userId, req.body.hideReadChannels)),
};

module.exports = organisationController;
