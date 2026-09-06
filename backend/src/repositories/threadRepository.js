"use strict";

const { query, queryOne } = require("../db/pool");

const THREAD_COLUMNS =
    "CAST(t.rootId AS CHAR) AS rootId, t.channelId, t.title, t.createdBy, t.createdAt, t.lastMessageAt, t.replyCount, t.autoArchiveMinutes, t.resolvedAt";

const threadRepository = {
    update: (rootId, { title, resolvedAt }, connection) =>
        query(
            "threads.update",
            "UPDATE message_threads SET title = ?, resolvedAt = ? WHERE rootId = ?",
            [title, resolvedAt, rootId],
            connection
        ),
    create: (data, connection) =>
        query(
            "threads.create",
            "INSERT INTO message_threads (rootId, channelId, title, createdBy) VALUES (?, ?, ?, ?)",
            [data.rootId, data.channelId, data.title, data.createdBy],
            connection
        ),

    findByRoot: (rootId, connection) =>
        queryOne(
            "threads.findByRoot",
            `SELECT ${THREAD_COLUMNS} FROM message_threads t WHERE t.rootId = ?`,
            [rootId],
            connection
        ),

    listByChannel: (channelId, limit, connection) =>
        query(
            "threads.listByChannel",
            `SELECT ${THREAD_COLUMNS},
                    m.content AS rootContent,
                    u.userId AS authorId, u.handle AS authorHandle, u.displayName AS authorDisplayName, u.avatar AS authorAvatar, u.avatarDecoration AS authorDecoration
               FROM message_threads t
               JOIN messages m ON m.messageId = t.rootId
               JOIN users u ON u.userId = t.createdBy
              WHERE t.channelId = ?
              ORDER BY t.lastMessageAt DESC
              LIMIT ?`,
            [channelId, limit],
            connection
        ),

    touch: (rootId, connection) =>
        query(
            "threads.touch",
            "UPDATE message_threads SET lastMessageAt = CURRENT_TIMESTAMP(3), replyCount = replyCount + 1 WHERE rootId = ?",
            [rootId],
            connection
        ),

    follow: async (rootId, userId, connection) => {
        const result = await query(
            "threads.follow",
            "INSERT IGNORE INTO thread_followers (rootId, userId) VALUES (?, ?)",
            [rootId, userId],
            connection
        );
        return result.affectedRows > 0;
    },

    unfollow: async (rootId, userId, connection) => {
        const result = await query(
            "threads.unfollow",
            "DELETE FROM thread_followers WHERE rootId = ? AND userId = ?",
            [rootId, userId],
            connection
        );
        return result.affectedRows > 0;
    },

    listFollowers: (rootId, connection) =>
        query("threads.listFollowers", "SELECT userId FROM thread_followers WHERE rootId = ?", [rootId], connection),

    isFollowing: async (rootId, userId, connection) => {
        const row = await queryOne(
            "threads.isFollowing",
            "SELECT 1 AS ok FROM thread_followers WHERE rootId = ? AND userId = ?",
            [rootId, userId],
            connection
        );
        return row !== null;
    },

    listMessages: (rootId, limit, connection) =>
        query(
            "threads.listMessages",
            `SELECT CAST(m.messageId AS CHAR) AS messageId, m.channelId, m.content, m.encryptionEpoch, m.createdAt, m.editedAt,
                    u.userId, u.handle, u.displayName, u.avatar, u.avatarDecoration
               FROM messages m JOIN users u ON u.userId = m.userId
              WHERE m.threadRootId = ? OR m.messageId = ?
              ORDER BY m.messageId ASC
              LIMIT ?`,
            [rootId, rootId, limit],
            connection
        ),
};

module.exports = threadRepository;
