"use strict";

const { query, queryOne } = require("../db/pool");

const COLUMNS = "subscriptionId, userId, endpoint, p256dh, auth, deviceLabel, createdAt, lastSentAt, failures";

module.exports = {
    upsert: (data, connection) =>
        query(
            "push.upsert",
            `INSERT INTO push_subscriptions (userId, endpoint, endpointHash, p256dh, auth, deviceLabel)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                 userId = VALUES(userId),
                 p256dh = VALUES(p256dh),
                 auth = VALUES(auth),
                 deviceLabel = VALUES(deviceLabel),
                 failures = 0`,
            [data.userId, data.endpoint, data.endpointHash, data.p256dh, data.auth, data.deviceLabel],
            connection
        ),

    listForUser: (userId, connection) =>
        query(
            "push.listForUser",
            `SELECT ${COLUMNS} FROM push_subscriptions WHERE userId = ? ORDER BY createdAt ASC`,
            [userId],
            connection
        ),

    findByHash: (endpointHash, connection) =>
        queryOne(
            "push.findByHash",
            `SELECT ${COLUMNS} FROM push_subscriptions WHERE endpointHash = ?`,
            [endpointHash],
            connection
        ),

    remove: (endpointHash, userId, connection) =>
        query(
            "push.remove",
            "DELETE FROM push_subscriptions WHERE endpointHash = ? AND userId = ?",
            [endpointHash, userId],
            connection
        ),

    removeByHash: (endpointHash, connection) =>
        query("push.removeByHash", "DELETE FROM push_subscriptions WHERE endpointHash = ?", [endpointHash], connection),

    recordSuccess: (subscriptionId, connection) =>
        query(
            "push.recordSuccess",
            "UPDATE push_subscriptions SET lastSentAt = NOW(), failures = 0 WHERE subscriptionId = ?",
            [subscriptionId],
            connection
        ),

    recordFailure: (subscriptionId, connection) =>
        query(
            "push.recordFailure",
            "UPDATE push_subscriptions SET failures = failures + 1 WHERE subscriptionId = ?",
            [subscriptionId],
            connection
        ),
};
