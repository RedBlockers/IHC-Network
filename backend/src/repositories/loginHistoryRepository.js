"use strict";

const { query, queryOne } = require("../db/pool");

const loginHistoryRepository = {
    record: (entry, connection) =>
        query(
            "loginHistory.record",
            "INSERT INTO login_history (userId, outcome, deviceLabel, ipHash) VALUES (?, ?, ?, ?)",
            [entry.userId, entry.outcome, entry.deviceLabel ?? "", entry.ipHash ?? null],
            connection
        ),

    hasSucceededOn: (userId, deviceLabel, connection) =>
        queryOne(
            "loginHistory.hasSucceededOn",
            `SELECT 1 AS seen FROM login_history
              WHERE userId = ? AND deviceLabel = ? AND outcome = 'success' LIMIT 1`,
            [userId, deviceLabel],
            connection
        ),

    listForUser: (userId, limit, connection) =>
        query(
            "loginHistory.listForUser",
            `SELECT entryId, outcome, deviceLabel, createdAt
               FROM login_history WHERE userId = ? ORDER BY createdAt DESC LIMIT ?`,
            [userId, limit],
            connection
        ),
};

module.exports = loginHistoryRepository;
