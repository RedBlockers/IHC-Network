"use strict";

const { query, queryOne } = require("../db/pool");

const COLUMNS = "credentialId, userId, publicKey, counter, transports, label, backedUp, createdAt, lastUsedAt";

const credentialRepository = {
    create: (data, connection) =>
        query(
            "credentials.create",
            `INSERT INTO user_credentials (credentialId, userId, publicKey, counter, transports, label, backedUp)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [data.credentialId, data.userId, data.publicKey, data.counter, data.transports, data.label, data.backedUp],
            connection
        ),

    listForUser: (userId, connection) =>
        query(
            "credentials.listForUser",
            `SELECT ${COLUMNS} FROM user_credentials WHERE userId = ? ORDER BY createdAt ASC`,
            [userId],
            connection
        ),

    findById: (credentialId, connection) =>
        queryOne(
            "credentials.findById",
            `SELECT ${COLUMNS} FROM user_credentials WHERE credentialId = ?`,
            [credentialId],
            connection
        ),

    recordUse: (credentialId, counter, connection) =>
        query(
            "credentials.recordUse",
            "UPDATE user_credentials SET counter = ?, lastUsedAt = NOW() WHERE credentialId = ?",
            [counter, credentialId],
            connection
        ),

    remove: (credentialId, userId, connection) =>
        query(
            "credentials.remove",
            "DELETE FROM user_credentials WHERE credentialId = ? AND userId = ?",
            [credentialId, userId],
            connection
        ),

    rename: (credentialId, userId, label, connection) =>
        query(
            "credentials.rename",
            "UPDATE user_credentials SET label = ? WHERE credentialId = ? AND userId = ?",
            [label, credentialId, userId],
            connection
        ),
};

const challengeRepository = {
    create: (challenge, userId, purpose, expiresAt, connection) =>
        query(
            "webauthnChallenges.create",
            "INSERT INTO webauthn_challenges (challenge, userId, purpose, expiresAt) VALUES (?, ?, ?, ?)",
            [challenge, userId, purpose, expiresAt],
            connection
        ),

    consume: async (challenge, purpose, connection) => {
        const row = await queryOne(
            "webauthnChallenges.find",
            "SELECT challenge, userId, purpose, expiresAt FROM webauthn_challenges WHERE challenge = ? AND purpose = ?",
            [challenge, purpose],
            connection
        );
        await query(
            "webauthnChallenges.purge",
            "DELETE FROM webauthn_challenges WHERE challenge = ? OR expiresAt < NOW()",
            [challenge],
            connection
        );
        if (!row) return null;
        return new Date(row.expiresAt) > new Date() ? row : null;
    },
};

module.exports = { credentialRepository, challengeRepository };
