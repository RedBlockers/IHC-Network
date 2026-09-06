"use strict";

const { query, queryOne } = require("../db/pool");

const COLUMNS =
    "attachmentId, channelId, messageId, userId, name, mime, bytes, storageKey, url, width, height, path, version, replacesId, createdAt";

const selectColumns = (prefix = "") => COLUMNS.split(", ").map((column) =>
    column === "messageId" ? `CAST(${prefix}messageId AS CHAR) AS messageId` : `${prefix}${column}`
).join(", ");

const attachmentRepository = {
    create: async (data, connection) => {
        const result = await query(
            "attachments.create",
            `INSERT INTO message_attachments
                (channelId, userId, name, mime, bytes, storageKey, url, width, height, path, version, replacesId)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                data.channelId, data.userId, data.name, data.mime, data.bytes, data.storageKey, data.url,
                data.width, data.height, data.path, data.version, data.replacesId,
            ],
            connection
        );
        return result.insertId;
    },

    findById: (attachmentId, connection) =>
        queryOne("attachments.findById", `SELECT ${selectColumns()} FROM message_attachments WHERE attachmentId = ?`, [attachmentId], connection),

    findByIds: (ids, connection) =>
        query(
            "attachments.findByIds",
            `SELECT ${selectColumns()} FROM message_attachments WHERE attachmentId IN (${ids.map(() => "?").join(", ")})`,
            ids,
            connection
        ),

    latestVersion: (channelId, name, connection) =>
        queryOne(
            "attachments.latestVersion",
            `SELECT attachmentId, version FROM message_attachments
              WHERE channelId = ? AND name = ? ORDER BY version DESC LIMIT 1`,
            [channelId, name],
            connection
        ),

    listVersions: (channelId, name, connection) =>
        query(
            "attachments.listVersions",
            `SELECT ${selectColumns("a.")}, u.handle, u.displayName
               FROM message_attachments a JOIN users u ON u.userId = a.userId
              WHERE a.channelId = ? AND a.name = ?
              ORDER BY a.version DESC`,
            [channelId, name],
            connection
        ),

    attachToMessage: (messageId, ids, connection) =>
        query(
            "attachments.attachToMessage",
            `UPDATE message_attachments SET messageId = ?
              WHERE attachmentId IN (${ids.map(() => "?").join(", ")}) AND messageId IS NULL`,
            [messageId, ...ids],
            connection
        ),

    sumBytesForGuild: (guildId, connection) =>
        queryOne(
            "attachments.sumBytesForGuild",
            `SELECT COALESCE(SUM(a.bytes), 0) AS used,
                    COUNT(*) AS files,
                    COALESCE(SUM(CASE WHEN a.messageId IS NULL THEN a.bytes ELSE 0 END), 0) AS pending
               FROM message_attachments a
               JOIN channels c ON c.channelId = a.channelId
              WHERE c.guildId = ?`,
            [guildId],
            connection
        ),

    findAbandoned: (guildId, before, connection) =>
        query(
            "attachments.findAbandoned",
            `SELECT a.attachmentId, a.storageKey, a.bytes
               FROM message_attachments a
               JOIN channels c ON c.channelId = a.channelId
              WHERE c.guildId = ? AND a.messageId IS NULL AND a.createdAt < ?`,
            [guildId, before],
            connection
        ),

    deleteByIds: (ids, connection) =>
        query(
            "attachments.deleteByIds",
            `DELETE FROM message_attachments WHERE attachmentId IN (${ids.map(() => "?").join(", ")})`,
            ids,
            connection
        ),

    listForMessages: (messageIds, connection) =>
        query(
            "attachments.listForMessages",
            `SELECT ${selectColumns()} FROM message_attachments
              WHERE messageId IN (${messageIds.map(() => "?").join(", ")}) ORDER BY attachmentId ASC`,
            messageIds,
            connection
        ),

    listForChannel: (channelId, limit, connection) =>
        query(
            "attachments.listForChannel",
            `SELECT ${selectColumns("a.")}, u.handle, u.displayName, u.avatar
               FROM message_attachments a JOIN users u ON u.userId = a.userId
              WHERE a.channelId = ? AND a.messageId IS NOT NULL
              ORDER BY a.attachmentId DESC LIMIT ?`,
            [channelId, limit],
            connection
        ),
};

module.exports = attachmentRepository;
