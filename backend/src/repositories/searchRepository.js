"use strict";

const { query, queryOne } = require("../db/pool");

const MESSAGE_SELECT = `
    CAST(m.messageId AS CHAR) AS messageId, m.channelId, m.content, m.createdAt, m.editedAt, m.encryptionEpoch,
    u.userId, u.handle, u.displayName, u.avatar, m.webhookName, m.botName,
    c.name AS channelName, c.type AS channelType`;

const searchRepository = {
    searchMessages: (channelIds, term, limit, connection) =>
        query(
            "search.messages",
            `SELECT ${MESSAGE_SELECT}
               FROM messages m
               JOIN users u ON u.userId = m.userId
               JOIN channels c ON c.channelId = m.channelId
              WHERE m.channelId IN (${channelIds.map(() => "?").join(", ")})
                AND MATCH(m.content) AGAINST (? IN NATURAL LANGUAGE MODE)
              ORDER BY m.messageId DESC
              LIMIT ?`,
            [...channelIds, term, limit],
            connection
        ),

    searchRecent: (channelIds, limit, connection) =>
        query(
            "search.recent",
            `SELECT ${MESSAGE_SELECT}
               FROM messages m
               JOIN users u ON u.userId = m.userId
               JOIN channels c ON c.channelId = m.channelId
              WHERE m.channelId IN (${channelIds.map(() => "?").join(", ")})
              ORDER BY m.messageId DESC
              LIMIT ?`,
            [...channelIds, limit],
            connection
        ),

    searchFiles: (channelIds, term, limit, connection) =>
        query(
            "search.files",
            `SELECT a.attachmentId, a.name, a.mime, a.bytes, a.url, a.width, a.height,
                    a.path, a.version, a.createdAt, a.channelId,
                    c.name AS channelName, c.guildId,
                    u.userId, u.handle, u.displayName, u.avatar
               FROM message_attachments a
               JOIN channels c ON c.channelId = a.channelId
               JOIN users u ON u.userId = a.userId
              WHERE a.channelId IN (${channelIds.map(() => "?").join(", ")})
                AND a.messageId IS NOT NULL
                AND a.name LIKE ?
              ORDER BY a.attachmentId DESC
              LIMIT ?`,
            [...channelIds, `%${term}%`, limit],
            connection
        ),

    listPins: (channelId, connection) =>
        query(
            "search.listPins",
            `SELECT ${MESSAGE_SELECT}, p.pinnedAt, p.pinnedBy
               FROM message_pins p
               JOIN messages m ON m.messageId = p.messageId
               JOIN users u ON u.userId = m.userId
               JOIN channels c ON c.channelId = m.channelId
              WHERE p.channelId = ?
              ORDER BY p.pinnedAt DESC`,
            [channelId],
            connection
        ),

    countPins: (channelId, connection) =>
        queryOne(
            "search.countPins",
            "SELECT COUNT(*) AS total FROM message_pins WHERE channelId = ?",
            [channelId],
            connection
        ),

    pin: async (channelId, messageId, pinnedBy, connection) => {
        const result = await query(
            "search.pin",
            "INSERT IGNORE INTO message_pins (channelId, messageId, pinnedBy) VALUES (?, ?, ?)",
            [channelId, messageId, pinnedBy],
            connection
        );
        return result.affectedRows > 0;
    },

    unpin: async (channelId, messageId, connection) => {
        const result = await query(
            "search.unpin",
            "DELETE FROM message_pins WHERE channelId = ? AND messageId = ?",
            [channelId, messageId],
            connection
        );
        return result.affectedRows > 0;
    },
};

module.exports = searchRepository;
