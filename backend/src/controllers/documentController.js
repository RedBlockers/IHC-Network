"use strict";

const documentService = require("../services/documentService");

const documentController = {
    outline: async (req, res) => res.status(200).json(await documentService.outline(req.channel)),
    create: async (req, res) => res.status(201).json(await documentService.create(req.channel, req.user, req.body)),
    read: async (req, res) => res.status(200).json(await documentService.read(req.channel, req.params.documentId)),
    edit: async (req, res) =>
        res.status(200).json(await documentService.edit(req.channel, req.user, req.params.documentId, req.body)),
    history: async (req, res) =>
        res.status(200).json(await documentService.history(req.channel, req.params.documentId)),
    revision: async (req, res) =>
        res.json(await documentService.revision(req.channel, req.params.documentId, req.params.revisionId)),
    restore: async (req, res) =>
        res
            .status(200)
            .json(await documentService.restore(req.channel, req.user, req.params.documentId, req.body.revisionId)),
    remove: async (req, res) => res.status(200).json(await documentService.remove(req.channel, req.params.documentId)),
};

module.exports = documentController;
