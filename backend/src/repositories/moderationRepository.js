"use strict";

const { query, queryOne } = require("../db/pool");

const SANCTION_COLUMNS =
    "sanctionId, guildId, userId, type, reason, issuedBy, issuedAt, expiresAt, revokedAt, revokedBy, revokeReason, appealText, appealedAt";

const moderationRepository = {
    createSanction: async (data, connection) => {
        const result = await query(
            "moderation.createSanction",
            `INSERT INTO guild_sanctions (guildId, userId, type, reason, issuedBy, expiresAt)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [data.guildId, data.userId, data.type, data.reason, data.issuedBy, data.expiresAt],
            connection
        );
        return result.insertId;
    },

    findSanction: (guildId, sanctionId, connection) =>
        queryOne(
            "moderation.findSanction",
            `SELECT ${SANCTION_COLUMNS} FROM guild_sanctions WHERE sanctionId = ? AND guildId = ?`,
            [sanctionId, guildId],
            connection
        ),

    listSanctionsForMember: (guildId, userId, connection) =>
        query(
            "moderation.listSanctionsForMember",
            `SELECT ${SANCTION_COLUMNS} FROM guild_sanctions
              WHERE guildId = ? AND userId = ? ORDER BY issuedAt DESC`,
            [guildId, userId],
            connection
        ),

    findActiveSanction: (guildId, userId, type, connection) =>
        queryOne(
            "moderation.findActiveSanction",
            `SELECT ${SANCTION_COLUMNS} FROM guild_sanctions
              WHERE guildId = ? AND userId = ? AND type = ?
                AND revokedAt IS NULL
                AND (expiresAt IS NULL OR expiresAt > NOW())
              ORDER BY issuedAt DESC LIMIT 1`,
            [guildId, userId, type],
            connection
        ),

    revokeSanction: async (guildId, sanctionId, { revokedBy, reason }, connection) => {
        const result = await query(
            "moderation.revokeSanction",
            `UPDATE guild_sanctions SET revokedAt = NOW(), revokedBy = ?, revokeReason = ?
              WHERE sanctionId = ? AND guildId = ? AND revokedAt IS NULL`,
            [revokedBy, reason, sanctionId, guildId],
            connection
        );
        return result.affectedRows > 0;
    },

    recordAppeal: async (guildId, sanctionId, userId, text, connection) => {
        const result = await query(
            "moderation.recordAppeal",
            `UPDATE guild_sanctions SET appealText = ?, appealedAt = NOW()
              WHERE sanctionId = ? AND guildId = ? AND userId = ? AND appealedAt IS NULL`,
            [text, sanctionId, guildId, userId],
            connection
        );
        return result.affectedRows > 0;
    },

    appendAudit: (entry, connection) =>
        query(
            "moderation.appendAudit",
            `INSERT INTO guild_audit_log (guildId, actorId, action, targetType, targetId, reason)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [entry.guildId, entry.actorId, entry.action, entry.targetType, entry.targetId ?? null, entry.reason ?? null],
            connection
        ),

    listAudit: (guildId, { limit, action }, connection) =>
        query(
            "moderation.listAudit",
            `SELECT a.entryId, a.actorId, a.action, a.targetType, a.targetId, a.reason, a.createdAt,
                    u.handle AS actorHandle, u.displayName AS actorDisplayName, u.avatar AS actorAvatar
               FROM guild_audit_log a
               LEFT JOIN users u ON u.userId = a.actorId
              WHERE a.guildId = ? ${action ? "AND a.action = ?" : ""}
              ORDER BY a.createdAt DESC, a.entryId DESC
              LIMIT ?`,
            action ? [guildId, action, limit] : [guildId, limit],
            connection
        ),

    createNote: async (data, connection) => {
        const result = await query(
            "moderation.createNote",
            "INSERT INTO moderation_notes (guildId, userId, authorId, body) VALUES (?, ?, ?, ?)",
            [data.guildId, data.userId, data.authorId, data.body],
            connection
        );
        return result.insertId;
    },

    listNotes: (guildId, userId, connection) =>
        query(
            "moderation.listNotes",
            `SELECT n.noteId, n.body, n.createdAt, u.userId AS authorId, u.handle AS authorHandle, u.displayName AS authorDisplayName
               FROM moderation_notes n JOIN users u ON u.userId = n.authorId
              WHERE n.guildId = ? AND n.userId = ?
              ORDER BY n.createdAt DESC`,
            [guildId, userId],
            connection
        ),
};

module.exports = moderationRepository;
