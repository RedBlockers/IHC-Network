"use strict";

const { query, queryOne } = require("../db/pool");

const TREE_COLUMNS =
    "worktreeId, channelId, guildId, name, baseBranch, headBranch, headSha, dirty, status, createdBy, createdAt, updatedAt";

const worktreeRepository = {
    create: async (data, connection) => {
        const result = await query(
            "worktrees.create",
            `INSERT INTO channel_worktrees
                (channelId, guildId, name, baseBranch, headBranch, createdBy)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [data.channelId, data.guildId, data.name, data.baseBranch, data.headBranch, data.createdBy],
            connection
        );
        return result.insertId;
    },

    findById: (worktreeId, connection) =>
        queryOne(
            "worktrees.findById",
            `SELECT ${TREE_COLUMNS} FROM channel_worktrees WHERE worktreeId = ?`,
            [worktreeId],
            connection
        ),

    listByChannel: (channelId, connection) =>
        query(
            "worktrees.listByChannel",
            `SELECT ${TREE_COLUMNS} FROM channel_worktrees
              WHERE channelId = ? AND status <> 'archived'
              ORDER BY updatedAt DESC, worktreeId DESC`,
            [channelId],
            connection
        ),

    update: async (worktreeId, fields, connection) => {
        const entries = Object.entries(fields);
        if (entries.length === 0) return false;
        const result = await query(
            "worktrees.update",
            `UPDATE channel_worktrees SET ${entries.map(([key]) => `${key} = ?`).join(", ")} WHERE worktreeId = ?`,
            [...entries.map(([, value]) => value), worktreeId],
            connection
        );
        return result.affectedRows > 0;
    },

    addMember: (worktreeId, userId, role, connection) =>
        query(
            "worktrees.addMember",
            `INSERT INTO worktree_members (worktreeId, userId, role)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE role = VALUES(role)`,
            [worktreeId, userId, role],
            connection
        ),

    listMembers: (worktreeId, connection) =>
        query(
            "worktrees.listMembers",
            `SELECT m.worktreeId, m.userId, m.role, m.consentTerminal, m.lastSeenAt, m.joinedAt,
                    u.handle, u.displayName, u.avatar
               FROM worktree_members m
               JOIN users u ON u.userId = m.userId
              WHERE m.worktreeId = ?
              ORDER BY m.joinedAt ASC`,
            [worktreeId],
            connection
        ),

    findMember: (worktreeId, userId, connection) =>
        queryOne(
            "worktrees.findMember",
            "SELECT worktreeId, userId, role, consentTerminal FROM worktree_members WHERE worktreeId = ? AND userId = ?",
            [worktreeId, userId],
            connection
        ),

    setConsent: (worktreeId, userId, consent, connection) =>
        query(
            "worktrees.setConsent",
            "UPDATE worktree_members SET consentTerminal = ? WHERE worktreeId = ? AND userId = ?",
            [consent ? 1 : 0, worktreeId, userId],
            connection
        ),

    promotePairsToMob: (worktreeId, connection) =>
        query(
            "worktrees.promotePairsToMob",
            "UPDATE worktree_members SET role = 'mob' WHERE worktreeId = ? AND role = 'pair'",
            [worktreeId],
            connection
        ),

    touchMember: (worktreeId, userId, connection) =>
        query(
            "worktrees.touchMember",
            "UPDATE worktree_members SET lastSeenAt = CURRENT_TIMESTAMP(3) WHERE worktreeId = ? AND userId = ?",
            [worktreeId, userId],
            connection
        ),

    replaceCommits: async (worktreeId, commits, connection) => {
        await query("worktrees.clearCommits", "DELETE FROM worktree_commits WHERE worktreeId = ?", [worktreeId], connection);
        for (const commit of commits) {
            await query(
                "worktrees.insertCommit",
                `INSERT INTO worktree_commits (worktreeId, sha, subject, authorHandle, committedAt)
                 VALUES (?, ?, ?, ?, ?)`,
                [worktreeId, commit.sha, commit.subject, commit.authorHandle, commit.committedAt],
                connection
            );
        }
    },

    listCommits: (worktreeId, connection) =>
        query(
            "worktrees.listCommits",
            `SELECT commitId, worktreeId, sha, subject, authorHandle, committedAt
               FROM worktree_commits WHERE worktreeId = ?
              ORDER BY committedAt DESC, commitId DESC`,
            [worktreeId],
            connection
        ),

    replaceFiles: async (worktreeId, files, connection) => {
        await query("worktrees.clearFiles", "DELETE FROM worktree_files WHERE worktreeId = ?", [worktreeId], connection);
        for (const file of files) {
            await query(
                "worktrees.insertFile",
                `INSERT INTO worktree_files (worktreeId, path, status, language, patch)
                 VALUES (?, ?, ?, ?, ?)`,
                [worktreeId, file.path, file.status, file.language ?? null, file.patch ?? null],
                connection
            );
        }
    },

    listFiles: (worktreeId, connection) =>
        query(
            "worktrees.listFiles",
            `SELECT fileId, worktreeId, path, status, language, patch
               FROM worktree_files WHERE worktreeId = ?
              ORDER BY path ASC`,
            [worktreeId],
            connection
        ),

    createReview: async (data, connection) => {
        const result = await query(
            "worktrees.createReview",
            `INSERT INTO worktree_reviews (worktreeId, channelId, title, baseSha, headSha, createdBy)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [data.worktreeId, data.channelId, data.title, data.baseSha, data.headSha, data.createdBy],
            connection
        );
        return result.insertId;
    },

    findReview: (reviewId, connection) =>
        queryOne(
            "worktrees.findReview",
            `SELECT reviewId, worktreeId, channelId, title, baseSha, headSha, status, createdBy, createdAt
               FROM worktree_reviews WHERE reviewId = ?`,
            [reviewId],
            connection
        ),

    listReviews: (worktreeId, connection) =>
        query(
            "worktrees.listReviews",
            `SELECT reviewId, worktreeId, channelId, title, baseSha, headSha, status, createdBy, createdAt
               FROM worktree_reviews WHERE worktreeId = ?
              ORDER BY createdAt DESC`,
            [worktreeId],
            connection
        ),

    updateReview: (reviewId, fields, connection) => {
        const entries = Object.entries(fields);
        if (entries.length === 0) return Promise.resolve(false);
        return query(
            "worktrees.updateReview",
            `UPDATE worktree_reviews SET ${entries.map(([key]) => `${key} = ?`).join(", ")} WHERE reviewId = ?`,
            [...entries.map(([, value]) => value), reviewId],
            connection
        ).then((result) => result.affectedRows > 0);
    },

    addComment: async (data, connection) => {
        const result = await query(
            "worktrees.addComment",
            `INSERT INTO worktree_review_comments (reviewId, path, lineStart, lineEnd, body, authorId)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [data.reviewId, data.path, data.lineStart, data.lineEnd, data.body, data.authorId],
            connection
        );
        return result.insertId;
    },

    listComments: (reviewId, connection) =>
        query(
            "worktrees.listComments",
            `SELECT c.commentId, c.reviewId, c.path, c.lineStart, c.lineEnd, c.body, c.authorId, c.createdAt,
                    u.handle, u.displayName
               FROM worktree_review_comments c
               JOIN users u ON u.userId = c.authorId
              WHERE c.reviewId = ?
              ORDER BY c.path ASC, c.lineStart ASC, c.commentId ASC`,
            [reviewId],
            connection
        ),

    listCommentsForWorktree: (worktreeId, connection) =>
        query(
            "worktrees.listCommentsForWorktree",
            `SELECT c.commentId, c.reviewId, c.path, c.lineStart, c.lineEnd, c.body, c.authorId, c.createdAt,
                    u.handle, u.displayName
               FROM worktree_review_comments c
               JOIN worktree_reviews r ON r.reviewId = c.reviewId
               JOIN users u ON u.userId = c.authorId
              WHERE r.worktreeId = ?
              ORDER BY c.path ASC, c.lineStart ASC, c.commentId ASC`,
            [worktreeId],
            connection
        ),

    reportPipeline: async (data, connection) => {
        const result = await query(
            "worktrees.reportPipeline",
            `INSERT INTO worktree_pipelines (worktreeId, name, status, logExcerpt, finishedAt)
             VALUES (?, ?, ?, ?, ?)`,
            [data.worktreeId, data.name, data.status, data.logExcerpt, data.finishedAt],
            connection
        );
        return result.insertId;
    },

    listPipelines: (worktreeId, connection) =>
        query(
            "worktrees.listPipelines",
            `SELECT pipelineId, worktreeId, name, status, logExcerpt, startedAt, finishedAt
               FROM worktree_pipelines WHERE worktreeId = ?
              ORDER BY startedAt DESC, pipelineId DESC`,
            [worktreeId],
            connection
        ),

    addDecision: async (data, connection) => {
        const result = await query(
            "worktrees.addDecision",
            `INSERT INTO worktree_decisions (worktreeId, title, body, createdBy)
             VALUES (?, ?, ?, ?)`,
            [data.worktreeId, data.title, data.body, data.createdBy],
            connection
        );
        return result.insertId;
    },

    listDecisions: (worktreeId, connection) =>
        query(
            "worktrees.listDecisions",
            `SELECT d.decisionId, d.worktreeId, d.title, d.body, d.createdBy, d.createdAt,
                    u.handle, u.displayName
               FROM worktree_decisions d
               JOIN users u ON u.userId = d.createdBy
              WHERE d.worktreeId = ?
              ORDER BY d.createdAt DESC`,
            [worktreeId],
            connection
        ),

    openTerminal: async (worktreeId, openedBy, connection) => {
        const result = await query(
            "worktrees.openTerminal",
            "INSERT INTO worktree_terminals (worktreeId, openedBy, status) VALUES (?, ?, 'pending')",
            [worktreeId, openedBy],
            connection
        );
        return result.insertId;
    },

    findTerminal: (sessionId, connection) =>
        queryOne(
            "worktrees.findTerminal",
            "SELECT sessionId, worktreeId, openedBy, status, createdAt FROM worktree_terminals WHERE sessionId = ?",
            [sessionId],
            connection
        ),

    listTerminals: (worktreeId, connection) =>
        query(
            "worktrees.listTerminals",
            `SELECT sessionId, worktreeId, openedBy, status, createdAt
               FROM worktree_terminals WHERE worktreeId = ? AND status <> 'closed'
              ORDER BY createdAt DESC`,
            [worktreeId],
            connection
        ),

    updateTerminal: (sessionId, fields, connection) => {
        const entries = Object.entries(fields);
        if (entries.length === 0) return Promise.resolve(false);
        return query(
            "worktrees.updateTerminal",
            `UPDATE worktree_terminals SET ${entries.map(([key]) => `${key} = ?`).join(", ")} WHERE sessionId = ?`,
            [...entries.map(([, value]) => value), sessionId],
            connection
        ).then((result) => result.affectedRows > 0);
    },

    appendTerminalChunk: async (data, connection) => {
        const result = await query(
            "worktrees.appendTerminalChunk",
            "INSERT INTO worktree_terminal_chunks (sessionId, userId, direction, data) VALUES (?, ?, ?, ?)",
            [data.sessionId, data.userId, data.direction, data.data],
            connection
        );
        return result.insertId;
    },

    listTerminalChunks: (sessionId, afterId, limit, connection) =>
        query(
            "worktrees.listTerminalChunks",
            `SELECT c.chunkId, c.sessionId, c.userId, c.direction, c.data, c.createdAt, u.handle
               FROM worktree_terminal_chunks c
               JOIN users u ON u.userId = c.userId
              WHERE c.sessionId = ? AND c.chunkId > ?
              ORDER BY c.chunkId ASC
              LIMIT ${Math.min(500, Math.max(1, Number(limit) || 200))}`,
            [sessionId, afterId],
            connection
        ),

    upsertCursor: (data, connection) =>
        query(
            "worktrees.upsertCursor",
            `INSERT INTO worktree_cursors (worktreeId, userId, path, lineNo, columnOffset)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE path = VALUES(path), lineNo = VALUES(lineNo),
                                     columnOffset = VALUES(columnOffset)`,
            [data.worktreeId, data.userId, data.path, data.lineNo, data.columnOffset],
            connection
        ),

    listCursors: (worktreeId, connection) =>
        query(
            "worktrees.listCursors",
            `SELECT c.worktreeId, c.userId, c.path, c.lineNo, c.columnOffset, c.updatedAt,
                    u.handle, u.displayName
               FROM worktree_cursors c
               JOIN users u ON u.userId = c.userId
              WHERE c.worktreeId = ?`,
            [worktreeId],
            connection
        ),
};

module.exports = worktreeRepository;
