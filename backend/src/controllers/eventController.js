"use strict";

const eventService = require("../services/eventService");

const eventController = {
    list: async (req, res) => res.status(200).json({ events: await eventService.list(req.channel, req.user) }),
    create: async (req, res) => res.status(201).json({ event: await eventService.create(req.channel, req.user, req.body) }),
    respond: async (req, res) =>
        res.status(200).json({ event: await eventService.respond(req.channel, req.user, req.params.eventId, req.body.response) }),
    update: async (req, res) =>
        res.status(200).json({ event: await eventService.update(req.channel, req.user, req.params.eventId, req.body) }),
    cancel: async (req, res) => res.status(200).json(await eventService.cancel(req.channel, req.user, req.params.eventId)),
};

module.exports = eventController;
