"use strict";

const { query, queryOne } = require("../db/pool");

const presenceRepository = {
    setActivity: (userId, { kind, name, detail, context, expiresAt }, connection) =>
        query(
            "presence.setActivity",
            `INSERT INTO user_activity (userId, kind, name, detail, context, expiresAt)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                 kind = VALUES(kind), name = VALUES(name), detail = VALUES(detail),
                 context = VALUES(context), startedAt = NOW(), expiresAt = VALUES(expiresAt)`,
            [userId, kind, name, detail ?? null, context ?? null, expiresAt],
            connection
        ),

    clearActivity: (userId, connection) =>
        query("presence.clearActivity", "DELETE FROM user_activity WHERE userId = ?", [userId], connection),

    findActivity: (userId, connection) =>
        queryOne(
            "presence.findActivity",
            "SELECT kind, name, detail, context, startedAt FROM user_activity WHERE userId = ? AND expiresAt > NOW()",
            [userId],
            connection
        ),

    listActivities: (userIds, connection) => {
        if (userIds.length === 0) return Promise.resolve([]);
        const placeholders = userIds.map(() => "?").join(",");
        return query(
            "presence.listActivities",
            `SELECT u.userId, u.presenceVisibility, u.activityVisibility,
                    a.kind, a.name, a.detail, a.context, a.startedAt
               FROM users u
               LEFT JOIN user_activity a ON a.userId = u.userId AND a.expiresAt > NOW()
              WHERE u.userId IN (${placeholders})`,
            userIds,
            connection
        );
    },

    setVisibility: (userId, { presence, activity }, connection) =>
        query(
            "presence.setVisibility",
            "UPDATE users SET presenceVisibility = ?, activityVisibility = ? WHERE userId = ?",
            [presence, activity, userId],
            connection
        ),

    findProfile: (guildId, userId, connection) =>
        queryOne(
            "presence.findProfile",
            "SELECT displayName, aboutMe, avatar FROM guild_profiles WHERE guildId = ? AND userId = ?",
            [guildId, userId],
            connection
        ),

    upsertProfile: (guildId, userId, { displayName, aboutMe, avatar }, connection) =>
        query(
            "presence.upsertProfile",
            `INSERT INTO guild_profiles (guildId, userId, displayName, aboutMe, avatar)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                 displayName = VALUES(displayName), aboutMe = VALUES(aboutMe), avatar = VALUES(avatar)`,
            [guildId, userId, displayName ?? null, aboutMe ?? null, avatar ?? null],
            connection
        ),

    deleteProfile: (guildId, userId, connection) =>
        query(
            "presence.deleteProfile",
            "DELETE FROM guild_profiles WHERE guildId = ? AND userId = ?",
            [guildId, userId],
            connection
        ),
};

module.exports = presenceRepository;
