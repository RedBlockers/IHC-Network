"use strict";

const taskService = require("../services/taskService");

const taskController = {
    board: async (req, res) => res.status(200).json(await taskService.board(req.channel)),
    create: async (req, res) => res.status(201).json({ task: await taskService.create(req.channel, req.user, req.body) }),
    update: async (req, res) =>
        res.status(200).json({ task: await taskService.update(req.channel, req.user, req.params.taskId, req.body) }),
    remove: async (req, res) => res.status(200).json(await taskService.remove(req.channel, req.user, req.params.taskId)),
};

module.exports = taskController;
