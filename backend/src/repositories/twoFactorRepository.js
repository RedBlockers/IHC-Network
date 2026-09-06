"use strict";

const { query, queryOne } = require("../db/pool");

const twoFactorRepository = {
    find: (userId, connection) =>
        queryOne(
            "totp.find",
            "SELECT userId, secret, confirmedAt, lastStep FROM user_totp WHERE userId = ?",
            [userId],
            connection
        ),

    upsertSecret: (userId, secret, connection) =>
        query(
            "totp.upsertSecret",
            `INSERT INTO user_totp (userId, secret) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE secret = IF(confirmedAt IS NULL, VALUES(secret), secret),
                                     lastStep = IF(confirmedAt IS NULL, NULL, lastStep)`,
            [userId, secret],
            connection
        ),

    confirm: (userId, step, connection) =>
        query(
            "totp.confirm",
            "UPDATE user_totp SET confirmedAt = NOW(), lastStep = ? WHERE userId = ?",
            [step, userId],
            connection
        ),

    recordStep: (userId, step, connection) =>
        query(
            "totp.recordStep",
            "UPDATE user_totp SET lastStep = ? WHERE userId = ? AND (lastStep IS NULL OR lastStep < ?)",
            [step, userId, step],
            connection
        ),

    disable: (userId, connection) =>
        query("totp.disable", "DELETE FROM user_totp WHERE userId = ?", [userId], connection),

    replaceRecoveryCodes: async (userId, hashes, connection) => {
        await query("totp.clearRecovery", "DELETE FROM user_recovery_codes WHERE userId = ?", [userId], connection);
        if (hashes.length === 0) return;
        const values = hashes.map(() => "(?, ?)").join(", ");
        await query(
            "totp.insertRecovery",
            `INSERT INTO user_recovery_codes (userId, codeHash) VALUES ${values}`,
            hashes.flatMap((hash) => [userId, hash]),
            connection
        );
    },

    listUnusedRecovery: (userId, connection) =>
        query(
            "totp.listUnusedRecovery",
            "SELECT codeId, codeHash FROM user_recovery_codes WHERE userId = ? AND usedAt IS NULL",
            [userId],
            connection
        ),

    consumeRecovery: (codeId, userId, connection) =>
        query(
            "totp.consumeRecovery",
            "UPDATE user_recovery_codes SET usedAt = NOW() WHERE codeId = ? AND userId = ? AND usedAt IS NULL",
            [codeId, userId],
            connection
        ),

    countUnusedRecovery: (userId, connection) =>
        queryOne(
            "totp.countUnusedRecovery",
            "SELECT COUNT(*) AS total FROM user_recovery_codes WHERE userId = ? AND usedAt IS NULL",
            [userId],
            connection
        ),
};

module.exports = twoFactorRepository;
