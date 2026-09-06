"use strict";

const roleService = require("../services/roleService");

const roleController = {
    templates: async (req, res) => {
        res.status(200).json({ templates: await roleService.templatesFor(req.guild, req.user) });
    },
    createFromTemplate: async (req, res) => {
        const role = await roleService.createFromTemplate(req.guild, req.user, req.params.templateId, req.body);
        res.status(201).json({ role });
    },

    list: async (req, res) => res.status(200).json({ roles: await roleService.list(req.guild.guildId) }),
    create: async (req, res) => res.status(201).json({ role: await roleService.create(req.guild, req.user, req.body) }),
    update: async (req, res) => res.status(200).json({ role: await roleService.update(req.guild, req.user, req.params.roleId, req.body) }),
    remove: async (req, res) => {
        await roleService.remove(req.guild, req.user, req.params.roleId);
        res.status(204).end();
    },
    reorder: async (req, res) => res.status(200).json({ roles: await roleService.reorder(req.guild, req.user, req.body.order) }),

    assign: async (req, res) => res.status(200).json({
        roles: await roleService.assign(req.guild, req.user, req.params.userId, req.params.roleId, true),
    }),
    unassign: async (req, res) => res.status(200).json({
        roles: await roleService.assign(req.guild, req.user, req.params.userId, req.params.roleId, false),
    }),
};

module.exports = roleController;
