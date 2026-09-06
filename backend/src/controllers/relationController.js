"use strict";

const relationService = require("../services/relationService");

const relationController = {
    listBlocked: async (req, res) => res.status(200).json({ blocked: await relationService.listBlocked(req.user) }),
    block: async (req, res) => res.status(201).json({ blocked: await relationService.block(req.user, req.params.userId) }),
    unblock: async (req, res) => res.status(200).json({ blocked: await relationService.unblock(req.user, req.params.userId) }),
    getNote: async (req, res) => res.status(200).json(await relationService.getNote(req.user, req.params.userId)),
    setNote: async (req, res) => res.status(200).json(await relationService.setNote(req.user, req.params.userId, req.body.body)),
};

module.exports = relationController;
