"use strict";

const { query, queryOne } = require("../db/pool");

const COLUMNS =
    "modeId, guildId, name, baseType, icon, acceptsMessages, requiresThread, requiresPoll, " +
    "requiresAttachment, pinnedFirst, refusal, createdBy, createdAt";

const VALUES = [
    "guildId", "name", "baseType", "icon", "acceptsMessages", "requiresThread",
    "requiresPoll", "requiresAttachment", "pinnedFirst", "refusal", "createdBy",
];

module.exports = {
    create: async (data, connection) => {
        const result = await query(
            "channelModes.create",
            `INSERT INTO guild_channel_modes (${VALUES.join(", ")})
             VALUES (${VALUES.map(() => "?").join(", ")})`,
            VALUES.map((key) => data[key] ?? null),
            connection
        );
        return result.insertId;
    },

    listForGuild: (guildId, connection) =>
        query(
            "channelModes.listForGuild",
            `SELECT ${COLUMNS} FROM guild_channel_modes WHERE guildId = ? ORDER BY name ASC`,
            [guildId],
            connection
        ),

    findById: (modeId, connection) =>
        queryOne("channelModes.findById", `SELECT ${COLUMNS} FROM guild_channel_modes WHERE modeId = ?`, [modeId], connection),

    update: (modeId, guildId, data, connection) =>
        query(
            "channelModes.update",
            `UPDATE guild_channel_modes SET name = ?, baseType = ?, icon = ?, acceptsMessages = ?,
                    requiresThread = ?, requiresPoll = ?, requiresAttachment = ?, pinnedFirst = ?, refusal = ?
              WHERE modeId = ? AND guildId = ?`,
            [
                data.name, data.baseType, data.icon, data.acceptsMessages, data.requiresThread,
                data.requiresPoll, data.requiresAttachment, data.pinnedFirst, data.refusal, modeId, guildId,
            ],
            connection
        ),

    remove: (modeId, guildId, connection) =>
        query(
            "channelModes.remove",
            "DELETE FROM guild_channel_modes WHERE modeId = ? AND guildId = ?",
            [modeId, guildId],
            connection
        ),
};
