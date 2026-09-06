"use strict";

const service = require("../services/friendGroupService");

const friendGroupController = {
    list: async (req, res) => res.status(200).json({ groups: await service.list(req.user.userId) }),

    create: async (req, res) => res.status(201).json({ group: await service.create(req.user, req.body.name) }),

    rename: async (req, res) =>
        res.status(200).json({ group: await service.rename(req.user, req.params.groupId, req.body.name) }),

    remove: async (req, res) => {
        await service.remove(req.user, req.params.groupId);
        res.status(204).end();
    },

    setMember: async (req, res) =>
        res.status(200).json(await service.setMember(req.user, req.params.groupId, req.params.userId, req.body.inGroup)),
};

module.exports = friendGroupController;
