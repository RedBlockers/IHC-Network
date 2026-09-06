"use strict";

const { query, queryOne } = require("../db/pool");

const botRepository = {
    create: async (data, connection) => {
        const result = await query(
            "bots.create",
            `INSERT INTO guild_bots (guildId, name, tokenHash, publicId, events, createdBy)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [data.guildId, data.name, data.tokenHash, data.publicId, data.events, data.createdBy],
            connection
        );
        return result.insertId;
    },

    listByGuild: (guildId, connection) =>
        query(
            "bots.listByGuild",
            `SELECT botId, guildId, name, publicId, events, createdBy, createdAt, revokedAt, lastUsedAt
               FROM guild_bots WHERE guildId = ? ORDER BY createdAt DESC`,
            [guildId],
            connection
        ),

    findByPublicId: (publicId, connection) =>
        queryOne(
            "bots.findByPublicId",
            `SELECT botId, guildId, name, tokenHash, publicId, events, createdBy, revokedAt
               FROM guild_bots WHERE publicId = ?`,
            [publicId],
            connection
        ),

    revoke: (botId, guildId, connection) =>
        query(
            "bots.revoke",
            "UPDATE guild_bots SET revokedAt = CURRENT_TIMESTAMP(3) WHERE botId = ? AND guildId = ? AND revokedAt IS NULL",
            [botId, guildId],
            connection
        ),

    touch: (botId, connection) =>
        query("bots.touch", "UPDATE guild_bots SET lastUsedAt = CURRENT_TIMESTAMP(3) WHERE botId = ?", [botId], connection),

    enqueueEvent: (botId, type, payload, connection) =>
        query(
            "bots.enqueueEvent",
            "INSERT INTO bot_events (botId, type, payload) VALUES (?, ?, ?)",
            [botId, type, JSON.stringify(payload)],
            connection
        ),

    listEvents: (botId, afterId, connection) =>
        query(
            "bots.listEvents",
            `SELECT eventId, botId, type, payload, createdAt
               FROM bot_events WHERE botId = ? AND eventId > ?
              ORDER BY eventId ASC`,
            [botId, afterId ?? 0],
            connection
        ),

    listActiveForGuild: (guildId, connection) =>
        query(
            "bots.listActiveForGuild",
            "SELECT botId, events FROM guild_bots WHERE guildId = ? AND revokedAt IS NULL",
            [guildId],
            connection
        ),
};

module.exports = botRepository;
