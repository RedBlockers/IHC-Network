"use strict";

const { query, queryOne } = require("../db/pool");

const COLUMNS = "documentId, channelId, guildId, title, position, createdBy, updatedBy, createdAt, updatedAt";

const documentRepository = {
    nextPosition: (channelId, connection) =>
        queryOne(
            "documents.nextPosition",
            "SELECT COALESCE(MAX(position), 0) + 1 AS position FROM channel_documents WHERE channelId = ?",
            [channelId],
            connection
        ),

    create: async (data, connection) => {
        const result = await query(
            "documents.create",
            `INSERT INTO channel_documents (channelId, guildId, title, position, createdBy, updatedBy)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [data.channelId, data.guildId, data.title, data.position, data.createdBy, data.createdBy],
            connection
        );
        return result.insertId;
    },

    findById: (documentId, connection) =>
        queryOne(
            "documents.findById",
            `SELECT ${COLUMNS} FROM channel_documents WHERE documentId = ?${connection ? " FOR UPDATE" : ""}`,
            [documentId],
            connection
        ),

    listByChannel: (channelId, connection) =>
        query(
            "documents.listByChannel",
            `SELECT d.${COLUMNS.split(", ").join(", d.")},
                    u.handle AS editorHandle, u.displayName AS editorDisplayName
               FROM channel_documents d JOIN users u ON u.userId = d.updatedBy
              WHERE d.channelId = ?
              ORDER BY d.position ASC, d.documentId ASC`,
            [channelId],
            connection
        ),

    update: async (documentId, fields, connection) => {
        const entries = Object.entries(fields);
        if (entries.length === 0) return false;
        const result = await query(
            "documents.update",
            `UPDATE channel_documents SET ${entries.map(([key]) => `${key} = ?`).join(", ")} WHERE documentId = ?`,
            [...entries.map(([, value]) => value), documentId],
            connection
        );
        return result.affectedRows > 0;
    },

    remove: async (documentId, channelId, connection) => {
        const result = await query(
            "documents.remove",
            "DELETE FROM channel_documents WHERE documentId = ? AND channelId = ?",
            [documentId, channelId],
            connection
        );
        return result.affectedRows > 0;
    },

    addRevision: (documentId, { body, summary, editedBy, title = null }, connection) =>
        query(
            "documents.addRevision",
            "INSERT INTO document_revisions (documentId, body, summary, editedBy, title) VALUES (?, ?, ?, ?, ?)",
            [documentId, body, summary, editedBy, title],
            connection
        ),

    latestRevision: (documentId, connection) =>
        queryOne(
            "documents.latestRevision",
            `SELECT r.revisionId, r.body, r.title, r.summary, r.editedAt, u.userId AS editedBy, u.handle, u.displayName
               FROM document_revisions r JOIN users u ON u.userId = r.editedBy
              WHERE r.documentId = ? ORDER BY r.revisionId DESC LIMIT 1`,
            [documentId],
            connection
        ),

    listRevisions: (documentId, limit, connection) =>
        query(
            "documents.listRevisions",
            `SELECT r.revisionId, r.title, r.summary, r.editedAt, u.userId AS editedBy, u.handle, u.displayName
               FROM document_revisions r JOIN users u ON u.userId = r.editedBy
              WHERE r.documentId = ? ORDER BY r.revisionId DESC LIMIT ?`,
            [documentId, limit],
            connection
        ),

    findRevision: (documentId, revisionId, connection) =>
        queryOne(
            "documents.findRevision",
            `SELECT revisionId, documentId, title, body, summary, editedBy, editedAt
               FROM document_revisions WHERE revisionId = ? AND documentId = ?`,
            [revisionId, documentId],
            connection
        ),
};

module.exports = documentRepository;
