"use strict";

const reportService = require("../services/reportService");

const reportController = {
    report: async (req, res) => {
        const result = await reportService.report(req.channel, req.user, req.params.messageId, req.body.reason);
        res.status(201).json(result);
    },

    queue: async (req, res) => {
        const result = await reportService.queue(req.guild.guildId, req.validatedQuery);
        res.status(200).json(result);
    },

    context: async (req, res) => {
        const result = await reportService.context(req.guild.guildId, req.params.reportId);
        res.status(200).json(result);
    },

    resolve: async (req, res) => {
        const result = await reportService.resolve(req.guild, req.user, req.params.reportId, req.body);
        res.status(200).json(result);
    },
};

module.exports = reportController;
