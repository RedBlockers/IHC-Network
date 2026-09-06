"use strict";

const linkPreviewService = require("../services/linkPreviewService");

const linkController = {
    preview: async (req, res) => {
        res.status(200).json({ preview: await linkPreviewService.preview(req.validatedQuery.url) });
    },
};

module.exports = linkController;
