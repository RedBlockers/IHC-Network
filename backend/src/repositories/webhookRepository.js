"use strict";

const { query, queryOne } = require("../db/pool");

const webhookRepository = {
    listForChannel: (channelId, connection) =>
        query(
            "webhooks.listForChannel",
            `SELECT w.webhookId, w.name, w.createdAt, w.lastUsedAt, w.uses, w.revokedAt,
                    u.handle AS authorHandle, u.displayName AS authorDisplayName
             FROM channel_webhooks w
             JOIN users u ON u.userId = w.createdBy
             WHERE w.channelId = ?
             ORDER BY w.webhookId DESC`,
            [channelId],
            connection
        ),

    create: async (data, connection) => {
        const result = await query(
            "webhooks.create",
            `INSERT INTO channel_webhooks (channelId, guildId, name, tokenHash, createdBy)
             VALUES (?, ?, ?, ?, ?)`,
            [data.channelId, data.guildId, data.name, data.tokenHash, data.createdBy],
            connection
        );
        return Number(result.insertId);
    },

    findByTokenHash: (tokenHash, connection) =>
        queryOne(
            "webhooks.findByTokenHash",
            `SELECT webhookId, channelId, guildId, name
             FROM channel_webhooks
             WHERE tokenHash = ? AND revokedAt IS NULL`,
            [tokenHash],
            connection
        ),

    recordUse: (webhookId, connection) =>
        query(
            "webhooks.recordUse",
            "UPDATE channel_webhooks SET uses = uses + 1, lastUsedAt = NOW() WHERE webhookId = ?",
            [webhookId],
            connection
        ),

    revoke: (webhookId, channelId, connection) =>
        query(
            "webhooks.revoke",
            "UPDATE channel_webhooks SET revokedAt = NOW() WHERE webhookId = ? AND channelId = ? AND revokedAt IS NULL",
            [webhookId, channelId],
            connection
        ),
};

module.exports = webhookRepository;
