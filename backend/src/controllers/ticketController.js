"use strict";

const ticketService = require("../services/ticketService");

const ticketController = {
    assignees: async (req, res) => res.json({ members: await ticketService.assignees(req.channel, req.user) }),
    updateDetails: async (req, res) =>
        res.json({ ticket: await ticketService.updateDetails(req.channel, req.user, req.params.ticketId, req.body) }),
    list: async (req, res) => res.status(200).json(await ticketService.list(req.channel, req.user, req.validatedQuery)),
    open: async (req, res) =>
        res.status(201).json({ ticket: await ticketService.open(req.channel, req.user, req.body) }),
    thread: async (req, res) =>
        res.status(200).json(await ticketService.thread(req.channel, req.user, req.params.ticketId)),
    reply: async (req, res) =>
        res.status(201).json(await ticketService.reply(req.channel, req.user, req.params.ticketId, req.body)),
    setStatus: async (req, res) =>
        res
            .status(200)
            .json({
                ticket: await ticketService.setStatus(req.channel, req.user, req.params.ticketId, req.body.status),
            }),
    assign: async (req, res) =>
        res
            .status(200)
            .json({
                ticket: await ticketService.assign(req.channel, req.user, req.params.ticketId, req.body.assigneeId),
            }),
};

module.exports = ticketController;
