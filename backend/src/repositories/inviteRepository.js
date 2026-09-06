"use strict";

const { query, queryOne } = require("../db/pool");

const inviteRepository = {
    create: (data, connection) =>
        query(
            "invites.create",
            "INSERT INTO invites (code, guildId, createdBy, maxUses, expiresAt) VALUES (?, ?, ?, ?, ?)",
            [data.code, data.guildId, data.createdBy, data.maxUses ?? null, data.expiresAt ?? null],
            connection
        ),

    findValidByCode: (code, connection) =>
        queryOne(
            "invites.findValidByCode",
            `SELECT * FROM invites
             WHERE code = ?
               AND revokedAt IS NULL
               AND (expiresAt IS NULL OR expiresAt > NOW())
               AND (maxUses IS NULL OR uses < maxUses)`,
            [code],
            connection
        ),

    findPreviewByCode: (code, connection) =>
        queryOne(
            "invites.findPreviewByCode",
            `SELECT i.code, i.guildId, i.expiresAt,
                    g.name, g.description, g.icon, g.banner, g.accent,
                    (SELECT COUNT(*) FROM guild_members gm WHERE gm.guildId = i.guildId) AS memberCount
             FROM invites i
             JOIN guilds g ON g.guildId = i.guildId
             WHERE i.code = ?
               AND i.revokedAt IS NULL
               AND (i.expiresAt IS NULL OR i.expiresAt > NOW())
               AND (i.maxUses IS NULL OR i.uses < i.maxUses)`,
            [code],
            connection
        ),

    listByGuild: (guildId, connection) =>
        query(
            "invites.listByGuild",
            `SELECT i.inviteId, i.code, i.maxUses, i.uses, i.expiresAt, i.revokedAt, i.createdAt,
                    u.userId AS authorId, u.handle AS authorHandle, u.displayName AS authorDisplayName,
                    u.avatar AS authorAvatar
             FROM invites i
             JOIN users u ON u.userId = i.createdBy
             WHERE i.guildId = ?
             ORDER BY i.inviteId DESC
             LIMIT 200`,
            [guildId],
            connection
        ),

    revoke: (inviteId, guildId, connection) =>
        query(
            "invites.revoke",
            "UPDATE invites SET revokedAt = NOW() WHERE inviteId = ? AND guildId = ? AND revokedAt IS NULL",
            [inviteId, guildId],
            connection
        ),

    consume: (inviteId, connection) =>
        query(
            "invites.consume",
            "UPDATE invites SET uses = uses + 1 WHERE inviteId = ? AND (maxUses IS NULL OR uses < maxUses)",
            [inviteId],
            connection
        ),
};

module.exports = inviteRepository;
