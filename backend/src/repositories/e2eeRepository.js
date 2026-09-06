"use strict";

const { query, queryOne } = require("../db/pool");

const DEVICE_COLUMNS = "deviceId, userId, publicKey, kemPublicKey, fingerprint, label, createdAt, lastSeenAt, revokedAt";

const e2eeRepository = {
    upsertDevice: async (userId, { publicKey, kemPublicKey, fingerprint, label }, connection) => {
        await query(
            "e2ee.upsertDevice",
            `INSERT INTO e2ee_devices (userId, publicKey, kemPublicKey, fingerprint, label)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE label = VALUES(label), kemPublicKey = VALUES(kemPublicKey),
                                     lastSeenAt = CURRENT_TIMESTAMP, revokedAt = NULL`,
            [userId, publicKey, kemPublicKey, fingerprint, label],
            connection
        );
        return queryOne(
            "e2ee.findDeviceByFingerprint",
            `SELECT ${DEVICE_COLUMNS} FROM e2ee_devices WHERE fingerprint = ?`,
            [fingerprint],
            connection
        );
    },

    findDeviceByFingerprint: (fingerprint, connection) =>
        queryOne(
            "e2ee.findDeviceByFingerprint",
            `SELECT ${DEVICE_COLUMNS} FROM e2ee_devices WHERE fingerprint = ?`,
            [fingerprint],
            connection
        ),

    findDeviceById: (deviceId, connection) =>
        queryOne("e2ee.findDeviceById", `SELECT ${DEVICE_COLUMNS} FROM e2ee_devices WHERE deviceId = ?`, [deviceId], connection),

    listDevicesForUser: (userId, connection) =>
        query(
            "e2ee.listDevicesForUser",
            `SELECT ${DEVICE_COLUMNS} FROM e2ee_devices WHERE userId = ? AND revokedAt IS NULL ORDER BY createdAt ASC`,
            [userId],
            connection
        ),

    revokeDevice: async (userId, deviceId, connection) => {
        const result = await query(
            "e2ee.revokeDevice",
            "UPDATE e2ee_devices SET revokedAt = CURRENT_TIMESTAMP WHERE deviceId = ? AND userId = ? AND revokedAt IS NULL",
            [deviceId, userId],
            connection
        );
        return result.affectedRows > 0;
    },

    listChannelRecipients: (channelId, connection) =>
        query(
            "e2ee.listChannelRecipients",
            `SELECT d.deviceId, d.userId, d.publicKey, d.kemPublicKey, d.fingerprint, d.label
               FROM e2ee_devices d
              WHERE d.revokedAt IS NULL
                AND d.userId IN (
                    SELECT m.userId
                      FROM guild_members m
                      JOIN channels c ON c.guildId = m.guildId
                     WHERE c.channelId = ?
                    UNION
                    SELECT f.requesterId FROM friendships f JOIN channels c2 ON c2.friendshipId = f.friendshipId
                     WHERE c2.channelId = ? AND f.status = 'accepted'
                    UNION
                    SELECT f.addresseeId FROM friendships f JOIN channels c3 ON c3.friendshipId = f.friendshipId
                     WHERE c3.channelId = ? AND f.status = 'accepted'
                )
              ORDER BY d.userId ASC, d.deviceId ASC`,
            [channelId, channelId, channelId],
            connection
        ),

    currentEpoch: (channelId, connection) =>
        queryOne(
            "e2ee.currentEpoch",
            `SELECT epochId, channelId, epoch, createdBy, createdByDeviceId, ephemeralPublicKey, algorithm, createdAt
               FROM channel_key_epochs WHERE channelId = ? ORDER BY epoch DESC LIMIT 1`,
            [channelId],
            connection
        ),

    findEpoch: (channelId, epoch, connection) =>
        queryOne(
            "e2ee.findEpoch",
            `SELECT epochId, channelId, epoch, createdBy, createdByDeviceId, ephemeralPublicKey, algorithm, createdAt
               FROM channel_key_epochs WHERE channelId = ? AND epoch = ?`,
            [channelId, epoch],
            connection
        ),

    createEpoch: async (data, connection) => {
        const result = await query(
            "e2ee.createEpoch",
            `INSERT INTO channel_key_epochs (channelId, epoch, createdBy, createdByDeviceId, ephemeralPublicKey, algorithm)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [data.channelId, data.epoch, data.createdBy, data.createdByDeviceId, data.ephemeralPublicKey, data.algorithm],
            connection
        );
        return result.insertId;
    },

    insertShares: (epochId, shares, connection) =>
        query(
            "e2ee.insertShares",
            `INSERT INTO channel_key_shares (epochId, deviceId, wrappedKey, kemCipherText)
             VALUES ${shares.map(() => "(?, ?, ?, ?)").join(", ")}`,
            shares.flatMap((share) => [epochId, share.deviceId, share.wrappedKey, share.kemCipherText]),
            connection
        ),

    listShareDeviceIds: (epochId, connection) =>
        query("e2ee.listShareDeviceIds", "SELECT deviceId FROM channel_key_shares WHERE epochId = ?", [epochId], connection),

    findShareForDevice: (epochId, deviceId, connection) =>
        queryOne(
            "e2ee.findShareForDevice",
            "SELECT wrappedKey, kemCipherText FROM channel_key_shares WHERE epochId = ? AND deviceId = ?",
            [epochId, deviceId],
            connection
        ),

    setChannelEpoch: (channelId, epoch, connection) =>
        query("e2ee.setChannelEpoch", "UPDATE channels SET keyEpoch = ? WHERE channelId = ?", [epoch, channelId], connection),

    setChannelEncryption: async (channelId, enabled, connection) => {
        const result = await query(
            "e2ee.setChannelEncryption",
            "UPDATE channels SET e2eeEnabled = ? WHERE channelId = ?",
            [enabled ? 1 : 0, channelId],
            connection
        );
        return result.affectedRows > 0;
    },
};

module.exports = e2eeRepository;
