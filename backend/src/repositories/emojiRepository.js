"use strict";

const { query, queryOne } = require("../db/pool");

const emojiRepository = {
    listByGuild: (guildId, kind, connection) =>
        query(
            "emojis.listByGuild",
            `SELECT e.emojiId, e.guildId, e.kind, e.name, e.url, e.bytes, e.createdAt,
                    u.userId AS authorId, u.handle AS authorHandle, u.displayName AS authorDisplayName
             FROM guild_emojis e
             JOIN users u ON u.userId = e.createdBy
             WHERE e.guildId = ? AND (? IS NULL OR e.kind = ?)
             ORDER BY e.kind ASC, e.name ASC`,
            [guildId, kind ?? null, kind ?? null],
            connection
        ),

    findByName: (guildId, name, kind = "emoji", connection) =>
        queryOne(
            "emojis.findByName",
            "SELECT emojiId, guildId, kind, name, url FROM guild_emojis WHERE guildId = ? AND name = ? AND kind = ?",
            [guildId, name, kind],
            connection
        ),

    findByNames: (guildId, names, connection) => {
        if (names.length === 0) return Promise.resolve([]);
        const placeholders = names.map(() => "?").join(",");
        return query(
            "emojis.findByNames",
            `SELECT emojiId, name, url FROM guild_emojis WHERE guildId = ? AND kind = 'emoji' AND name IN (${placeholders})`,
            [guildId, ...names],
            connection
        );
    },

    create: async (data, connection) => {
        const result = await query(
            "emojis.create",
            "INSERT INTO guild_emojis (guildId, kind, name, url, bytes, storageKey, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [data.guildId, data.kind ?? "emoji", data.name, data.url, data.bytes ?? 0, data.storageKey, data.createdBy],
            connection
        );
        return Number(result.insertId);
    },

    findById: (emojiId, guildId, connection) =>
        queryOne(
            "emojis.findById",
            "SELECT emojiId, guildId, kind, name, url, storageKey FROM guild_emojis WHERE emojiId = ? AND guildId = ?",
            [emojiId, guildId],
            connection
        ),

    delete: (emojiId, guildId, connection) =>
        query("emojis.delete", "DELETE FROM guild_emojis WHERE emojiId = ? AND guildId = ?", [emojiId, guildId], connection),

    countForGuild: (guildId, kind, connection) =>
        queryOne(
            "emojis.countForGuild",
            "SELECT COUNT(*) AS total FROM guild_emojis WHERE guildId = ? AND kind = ?",
            [guildId, kind],
            connection
        ),
};

module.exports = emojiRepository;
