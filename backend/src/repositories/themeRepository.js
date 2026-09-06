"use strict";

const { query, queryOne } = require("../db/pool");

const COLUMNS = "themeId, guildId, tokens, label, effectiveAt, createdBy, createdAt";

module.exports = {
    create: async (data, connection) => {
        const result = await query(
            "themes.create",
            "INSERT INTO guild_themes (guildId, tokens, label, effectiveAt, createdBy) VALUES (?, ?, ?, ?, ?)",
            [data.guildId, data.tokens, data.label, data.effectiveAt, data.createdBy],
            connection
        );
        return result.insertId;
    },

    findActive: (guildId, connection) =>
        queryOne(
            "themes.findActive",
            `SELECT ${COLUMNS} FROM guild_themes
              WHERE guildId = ? AND effectiveAt <= NOW()
              ORDER BY effectiveAt DESC, themeId DESC LIMIT 1`,
            [guildId],
            connection
        ),

    list: (guildId, connection) =>
        query(
            "themes.list",
            `SELECT ${COLUMNS} FROM guild_themes WHERE guildId = ? ORDER BY effectiveAt DESC, themeId DESC LIMIT 50`,
            [guildId],
            connection
        ),

    findById: (themeId, connection) =>
        queryOne("themes.findById", `SELECT ${COLUMNS} FROM guild_themes WHERE themeId = ?`, [themeId], connection),

    remove: (themeId, guildId, connection) =>
        query(
            "themes.remove",
            "DELETE FROM guild_themes WHERE themeId = ? AND guildId = ?",
            [themeId, guildId],
            connection
        ),
};
