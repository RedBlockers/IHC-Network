"use strict";

const channelPermissionService = require("../services/channelPermissionService");
const accessService = require("../services/accessService");
const { PERMISSIONS } = require("../domain/permissions");

const channelPermissionController = {
    list: async (req, res) => res.status(200).json({
        overrides: await channelPermissionService.list(req.guild.guildId, req.params.channelId),
    }),
    replace: async (req, res) => res.status(200).json({
        overrides: await channelPermissionService.replace(
            req.guild.guildId,
            req.params.channelId,
            req.params.targetType,
            req.params.targetId,
            req.body.permissions
        ),
    }),
};

channelPermissionController.explain = async (req, res) => {
    const { userId, permissions } = req.validatedQuery;
    const list = permissions ? permissions.split(",").map((p) => p.trim()).filter(Boolean).slice(0, 30) : PERMISSIONS;

    const explained = await Promise.all(
        list.map(async (permission) => ({
            permission,
            ...(await accessService.explainChannelPermission(userId, req.channel?.channelId ?? req.params.channelId, permission)),
        }))
    );

    res.status(200).json({ userId: Number(userId), permissions: explained });
};

module.exports = channelPermissionController;
