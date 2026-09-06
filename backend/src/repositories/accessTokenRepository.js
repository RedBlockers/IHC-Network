"use strict";

const { query, queryOne } = require("../db/pool");

const COLUMNS = "tokenId, userId, label, prefix, createdAt, lastUsedAt, expiresAt, revokedAt";

const accessTokenRepository = {
    create: async (data, connection) => {
        const result = await query(
            "accessTokens.create",
            `INSERT INTO personal_access_tokens (userId, label, prefix, tokenHash, expiresAt)
             VALUES (?, ?, ?, ?, ?)`,
            [data.userId, data.label, data.prefix, data.tokenHash, data.expiresAt ?? null],
            connection
        );
        return result.insertId;
    },

    findById: (tokenId, connection) =>
        queryOne(
            "accessTokens.findById",
            `SELECT ${COLUMNS} FROM personal_access_tokens WHERE tokenId = ?`,
            [tokenId],
            connection
        ),

    findByHash: (tokenHash, connection) =>
        queryOne(
            "accessTokens.findByHash",
            `SELECT ${COLUMNS} FROM personal_access_tokens WHERE tokenHash = ?`,
            [tokenHash],
            connection
        ),

    listByUser: (userId, connection) =>
        query(
            "accessTokens.listByUser",
            `SELECT ${COLUMNS} FROM personal_access_tokens
              WHERE userId = ? AND revokedAt IS NULL
              ORDER BY createdAt DESC`,
            [userId],
            connection
        ),

    countActive: async (userId, connection) => {
        const row = await queryOne(
            "accessTokens.countActive",
            `SELECT COUNT(*) AS total FROM personal_access_tokens
              WHERE userId = ? AND revokedAt IS NULL AND (expiresAt IS NULL OR expiresAt > NOW(3))`,
            [userId],
            connection
        );
        return Number(row?.total ?? 0);
    },

    touch: (tokenId, connection) =>
        query(
            "accessTokens.touch",
            "UPDATE personal_access_tokens SET lastUsedAt = NOW(3) WHERE tokenId = ?",
            [tokenId],
            connection
        ),

    revoke: (tokenId, userId, connection) =>
        query(
            "accessTokens.revoke",
            `UPDATE personal_access_tokens SET revokedAt = NOW(3)
              WHERE tokenId = ? AND userId = ? AND revokedAt IS NULL`,
            [tokenId, userId],
            connection
        ).then((result) => result.affectedRows > 0),
};

module.exports = accessTokenRepository;
