"use strict";

const { query, queryOne } = require("../db/pool");

const relationRepository = {
    block: async (blockerId, blockedId, connection) => {
        const result = await query(
            "relations.block",
            "INSERT IGNORE INTO user_blocks (blockerId, blockedId) VALUES (?, ?)",
            [blockerId, blockedId],
            connection
        );
        return result.affectedRows > 0;
    },

    unblock: async (blockerId, blockedId, connection) => {
        const result = await query(
            "relations.unblock",
            "DELETE FROM user_blocks WHERE blockerId = ? AND blockedId = ?",
            [blockerId, blockedId],
            connection
        );
        return result.affectedRows > 0;
    },

    listBlocked: (blockerId, connection) =>
        query(
            "relations.listBlocked",
            `SELECT u.userId, u.handle, u.displayName, u.avatar, b.createdAt
               FROM user_blocks b JOIN users u ON u.userId = b.blockedId
              WHERE b.blockerId = ? ORDER BY b.createdAt DESC`,
            [blockerId],
            connection
        ),

    isBlockedEitherWay: async (a, b, connection) => {
        const row = await queryOne(
            "relations.isBlockedEitherWay",
            `SELECT 1 AS ok FROM user_blocks
              WHERE (blockerId = ? AND blockedId = ?) OR (blockerId = ? AND blockedId = ?) LIMIT 1`,
            [a, b, b, a],
            connection
        );
        return row !== null;
    },

    listBlockedIds: async (blockerId, connection) => {
        const rows = await query(
            "relations.listBlockedIds",
            "SELECT blockedId FROM user_blocks WHERE blockerId = ?",
            [blockerId],
            connection
        );
        return rows.map((row) => Number(row.blockedId));
    },

    upsertNote: (authorId, subjectId, body, connection) =>
        query(
            "relations.upsertNote",
            `INSERT INTO contact_notes (authorId, subjectId, body) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE body = VALUES(body)`,
            [authorId, subjectId, body],
            connection
        ),

    deleteNote: (authorId, subjectId, connection) =>
        query("relations.deleteNote", "DELETE FROM contact_notes WHERE authorId = ? AND subjectId = ?", [authorId, subjectId], connection),

    findNote: (authorId, subjectId, connection) =>
        queryOne(
            "relations.findNote",
            "SELECT body, updatedAt FROM contact_notes WHERE authorId = ? AND subjectId = ?",
            [authorId, subjectId],
            connection
        ),
};

module.exports = relationRepository;
