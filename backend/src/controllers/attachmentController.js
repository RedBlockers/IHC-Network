"use strict";

const attachmentService = require("../services/attachmentService");

const attachmentController = {
    upload: async (req, res) => {
        const attachment = await attachmentService.store(req.channel, req.user, req.file, {
            relativePath: req.body?.path ?? "",
        });
        res.status(201).json({ attachment });
    },

    gallery: async (req, res) =>
        res.status(200).json({ attachments: await attachmentService.gallery(req.channel) }),

    versions: async (req, res) =>
        res.status(200).json({ versions: await attachmentService.versions(req.channel, req.validatedQuery.name) }),
};

module.exports = attachmentController;
