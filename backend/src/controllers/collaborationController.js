"use strict";

const collaborationService = require("../services/collaborationService");

const collaborationController = {
    whiteboard: async (req, res) => res.status(200).json(await collaborationService.whiteboard(req.channel)),
    stroke: async (req, res) =>
        res.status(201).json({ stroke: await collaborationService.addStroke(req.channel, req.user, req.body) }),
    clearBoard: async (req, res) => res.status(200).json(await collaborationService.clearBoard(req.channel)),
    transcript: async (req, res) =>
        res.status(201).json({
            transcript: await collaborationService.addTranscript(req.channel, req.user, req.body),
        }),
    listTranscripts: async (req, res) => res.status(200).json(await collaborationService.listTranscripts(req.channel)),
    summarize: async (req, res) =>
        res.status(201).json(await collaborationService.summarize(req.channel, req.user, req.body)),
    listSummaries: async (req, res) => res.status(200).json(await collaborationService.listSummaries(req.channel)),
};

module.exports = collaborationController;
