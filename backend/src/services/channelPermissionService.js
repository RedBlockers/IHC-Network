"use strict";

const { withTransaction } = require("../db/pool");
const { NotFound } = require("../errors");
const channelRepository = require("../repositories/channelRepository");
const channelPermissionRepository = require("../repositories/channelPermissionRepository");
const roleRepository = require("../repositories/roleRepository");
const channelAccessService = require("./channelAccessService");

async function requireChannel(guildId, channelId, connection) {
    const channel = await channelRepository.findById(channelId, connection);
    if (!channel || Number(channel.guildId) !== Number(guildId)) throw new NotFound("Salon introuvable.");
    return channel;
}

async function requireTarget(guildId, targetType, targetId, connection) {
    const exists =
        targetType === "role"
            ? Boolean(await roleRepository.findById(guildId, targetId, connection))
            : await roleRepository.memberExists(guildId, targetId, connection);
    if (!exists) throw new NotFound(targetType === "role" ? "Rôle introuvable." : "Membre introuvable.");
}

function groupRows(rows) {
    const grouped = new Map();
    for (const row of rows) {
        const key = `${row.targetType}:${row.targetId}`;
        if (!grouped.has(key))
            grouped.set(key, {
                targetType: row.targetType,
                targetId: Number(row.targetId),
                targetName: row.targetName,
                targetIcon: row.targetIcon ?? null,
                targetColor: row.targetColor ?? null,
                permissions: {},
            });
        grouped.get(key).permissions[row.permission] = row.effect;
    }
    return [...grouped.values()];
}

async function list(guildId, channelId) {
    await requireChannel(guildId, channelId);
    return groupRows(await channelPermissionRepository.list(channelId));
}

async function replace(guildId, channelId, targetType, targetId, permissions) {
    await withTransaction(async (connection) => {
        await requireChannel(guildId, channelId, connection);
        await requireTarget(guildId, targetType, targetId, connection);
        await channelPermissionRepository.clearTarget(channelId, targetType, targetId, connection);
        for (const [permission, effect] of Object.entries(permissions)) {
            if (effect === "inherit") continue;
            await channelPermissionRepository.set(channelId, targetType, targetId, permission, effect, connection);
        }
    });
    await channelAccessService.refreshAccess(channelId, guildId);
    return list(guildId, channelId);
}

module.exports = { list, replace };
