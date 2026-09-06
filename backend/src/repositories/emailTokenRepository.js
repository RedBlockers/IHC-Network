"use strict";

const { query, queryOne } = require("../db/pool");

const emailTokenRepository = {
    create: (data, connection) =>
        query(
            "emailTokens.create",
            "INSERT INTO email_tokens (userId, purpose, tokenHash, email, expiresAt) VALUES (?, ?, ?, ?, ?)",
            [data.userId, data.purpose, data.tokenHash, data.email, data.expiresAt],
            connection
        ),

    findByHash: (tokenHash, purpose, connection) =>
        queryOne(
            "emailTokens.findByHash",
            `SELECT tokenId, userId, purpose, email, expiresAt, usedAt
               FROM email_tokens WHERE tokenHash = ? AND purpose = ?`,
            [tokenHash, purpose],
            connection
        ),

    consume: async (tokenId, connection) => {
        const result = await query(
            "emailTokens.consume",
            "UPDATE email_tokens SET usedAt = NOW() WHERE tokenId = ? AND usedAt IS NULL",
            [tokenId],
            connection
        );
        return result.affectedRows > 0;
    },

    invalidatePending: (userId, purpose, connection) =>
        query(
            "emailTokens.invalidatePending",
            "UPDATE email_tokens SET usedAt = NOW() WHERE userId = ? AND purpose = ? AND usedAt IS NULL",
            [userId, purpose],
            connection
        ),

    countRecent: (userId, purpose, minutes, connection) =>
        queryOne(
            "emailTokens.countRecent",
            `SELECT COUNT(*) AS total FROM email_tokens
              WHERE userId = ? AND purpose = ? AND createdAt > (NOW() - INTERVAL ? MINUTE)`,
            [userId, purpose, minutes],
            connection
        ),
};

module.exports = emailTokenRepository;
