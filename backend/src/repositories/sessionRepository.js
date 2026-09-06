"use strict";

const { query, queryOne } = require("../db/pool");

const sessionRepository = {
    create: (session, connection) =>
        query(
            "sessions.create",
            `INSERT INTO user_sessions
                (sessionId, familyId, userId, tokenHash, userAgentHash, deviceLabel, expiresAt)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [session.sessionId, session.familyId, session.userId, session.tokenHash, session.userAgentHash,
             session.deviceLabel ?? "", session.expiresAt],
            connection
        ),

    findByTokenForUpdate: (tokenHash, connection) =>
        queryOne(
            "sessions.findByTokenForUpdate",
            `SELECT sessionId, familyId, userId, tokenHash, expiresAt, revokedAt
             FROM user_sessions WHERE tokenHash = ? FOR UPDATE`,
            [tokenHash],
            connection
        ),

    revoke: (sessionId, connection) =>
        query(
            "sessions.revoke",
            "UPDATE user_sessions SET revokedAt = COALESCE(revokedAt, NOW()), lastUsedAt = NOW() WHERE sessionId = ?",
            [sessionId],
            connection
        ),

    revokeByHash: (tokenHash, connection) =>
        query(
            "sessions.revokeByHash",
            "UPDATE user_sessions SET revokedAt = COALESCE(revokedAt, NOW()) WHERE tokenHash = ?",
            [tokenHash],
            connection
        ),

    findByToken: (tokenHash, connection) =>
        queryOne(
            "sessions.findByToken",
            "SELECT sessionId, familyId, userId FROM user_sessions WHERE tokenHash = ? AND revokedAt IS NULL",
            [tokenHash],
            connection
        ),

    listActiveForUser: (userId, connection) =>
        query(
            "sessions.listActiveForUser",
            `SELECT sessionId, deviceLabel, createdAt, lastUsedAt, expiresAt
               FROM user_sessions
              WHERE userId = ? AND revokedAt IS NULL AND expiresAt > NOW()
              ORDER BY lastUsedAt IS NULL, lastUsedAt DESC, createdAt DESC`,
            [userId],
            connection
        ),

    findForUser: (userId, sessionId, connection) =>
        queryOne(
            "sessions.findForUser",
            "SELECT sessionId, familyId, deviceLabel FROM user_sessions WHERE userId = ? AND sessionId = ? AND revokedAt IS NULL",
            [userId, sessionId],
            connection
        ),

    revokeAllExceptFamily: async (userId, familyId, connection) => {
        const result = await query(
            "sessions.revokeAllExceptFamily",
            "UPDATE user_sessions SET revokedAt = NOW() WHERE userId = ? AND familyId <> ? AND revokedAt IS NULL",
            [userId, familyId],
            connection
        );
        return result.affectedRows;
    },

    revokeFamily: (familyId, connection) =>
        query(
            "sessions.revokeFamily",
            "UPDATE user_sessions SET revokedAt = COALESCE(revokedAt, NOW()) WHERE familyId = ?",
            [familyId],
            connection
        ),
};

module.exports = sessionRepository;
