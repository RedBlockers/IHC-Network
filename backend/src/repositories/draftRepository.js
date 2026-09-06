"use strict";

const { query, queryOne } = require("../db/pool");

const draftRepository = {
    listForUser: (userId, connection) =>
        query(
            "drafts.listForUser",
            "SELECT channelId, content, updatedAt FROM message_drafts WHERE userId = ?",
            [userId],
            connection
        ),

    find: (userId, channelId, connection) =>
        queryOne(
            "drafts.find",
            "SELECT content, updatedAt FROM message_drafts WHERE userId = ? AND channelId = ?",
            [userId, channelId],
            connection
        ),

    save: (userId, channelId, content, connection) =>
        query(
            "drafts.save",
            `INSERT INTO message_drafts (userId, channelId, content) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE content = VALUES(content)`,
            [userId, channelId, content],
            connection
        ),

    remove: (userId, channelId, connection) =>
        query(
            "drafts.remove",
            "DELETE FROM message_drafts WHERE userId = ? AND channelId = ?",
            [userId, channelId],
            connection
        ),
};

module.exports = draftRepository;
