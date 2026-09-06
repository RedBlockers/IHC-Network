"use strict";

const { query, queryOne } = require("../db/pool");
const { generator } = require("../infra/snowflake");

const SELECT_WITH_AUTHOR = `
    SELECT CAST(m.messageId AS CHAR) AS messageId, m.channelId, m.content, m.createdAt, m.editedAt,
           CAST(m.replyToId AS CHAR) AS replyToId,
           u.userId, u.handle, u.displayName, u.avatar, u.avatarDecoration, m.webhookName, m.botName,
           EXISTS(SELECT 1 FROM polls poll WHERE poll.messageId = m.messageId) AS hasPoll,
           rm.content AS replyContent, ru.displayName AS replyAuthorName, ru.handle AS replyAuthorHandle
    FROM messages m
    JOIN users u ON u.userId = m.userId
    LEFT JOIN messages rm ON rm.messageId = m.replyToId
    LEFT JOIN users ru ON ru.userId = rm.userId
`;

const VISIBLE_TO_MEMBER = `
           AND (
               g.ownerId = gm.userId
               OR COALESCE(
                   (SELECT CASE
                        WHEN SUM(member_override.effect = 'deny') > 0 THEN 'deny'
                        WHEN SUM(member_override.effect = 'allow') > 0 THEN 'allow'
                        ELSE NULL
                    END
                    FROM channel_permission_overrides member_override
                    WHERE member_override.channelId = c.channelId
                      AND member_override.targetType = 'member'
                      AND member_override.targetId = gm.userId
                      AND member_override.permission = 'VIEW_CHANNEL'),
                   (SELECT CASE
                        WHEN SUM(role_override.effect = 'deny') > 0 THEN 'deny'
                        WHEN SUM(role_override.effect = 'allow') > 0 THEN 'allow'
                        ELSE NULL
                    END
                    FROM channel_permission_overrides role_override
                    JOIN guild_member_roles override_membership
                      ON override_membership.roleId = role_override.targetId
                     AND override_membership.guildId = c.guildId
                     AND override_membership.userId = gm.userId
                    WHERE role_override.channelId = c.channelId
                      AND role_override.targetType = 'role'
                      AND role_override.permission = 'VIEW_CHANNEL'),
                   (SELECT CASE
                        WHEN SUM(role_permission.effect = 'deny') > 0 THEN 'deny'
                        WHEN SUM(role_permission.effect = 'allow') > 0 THEN 'allow'
                        ELSE NULL
                    END
                    FROM guild_member_roles base_membership
                    JOIN guild_role_permissions role_permission ON role_permission.roleId = base_membership.roleId
                    WHERE base_membership.guildId = c.guildId
                      AND base_membership.userId = gm.userId
                      AND role_permission.permission = 'VIEW_CHANNEL')
               ) = 'allow'
           )`;

const messageRepository = {
    findById: (messageId, connection) =>
        queryOne("messages.findById", `${SELECT_WITH_AUTHOR} WHERE m.messageId = ?`, [messageId], connection),

    create: async (channelId, userId, content, replyToId, connection, threadRootId = null, clientNonce = null) => {
        const messageId = generator.next();
        await query(
            "messages.create",
            `INSERT INTO messages (messageId, channelId, userId, content, replyToId, threadRootId, clientNonce)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [messageId, channelId, userId, content, replyToId ?? null, threadRootId, clientNonce],
            connection
        );
        return messageRepository.findById(messageId, connection);
    },

    createFromWebhook: async (channelId, webhook, content, name, connection) => {
        const messageId = generator.next();
        await query(
            "messages.createFromWebhook",
            `INSERT INTO messages (messageId, channelId, userId, content, webhookName)
             VALUES (?, (SELECT createdBy FROM channel_webhooks WHERE webhookId = ?), ?, ?)`,
            [messageId, webhook.webhookId, content, (name || webhook.name).slice(0, 50)],
            connection
        );
        return messageRepository.findById(messageId, connection);
    },

    createFromBot: async (channelId, bot, content, connection) => {
        const messageId = generator.next();
        await query(
            "messages.createFromBot",
            `INSERT INTO messages (messageId, channelId, userId, content, botName)
             VALUES (?, ?, ?, ?, ?)`,
            [messageId, channelId, bot.createdBy, content, String(bot.name).slice(0, 80)],
            connection
        );
        return messageRepository.findById(messageId, connection);
    },

    findByNonce: (channelId, userId, clientNonce, connection) =>
        queryOne(
            "messages.findByNonce",
            `${SELECT_WITH_AUTHOR} WHERE m.channelId = ? AND m.userId = ? AND m.clientNonce = ?`,
            [channelId, userId, clientNonce],
            connection
        ),

    updateContent: async (messageId, userId, content, connection) => {
        const result = await query(
            "messages.update",
            "UPDATE messages SET content = ?, editedAt = NOW(3) WHERE messageId = ? AND userId = ?",
            [content, messageId, userId],
            connection
        );
        return result.affectedRows > 0;
    },

    deleteOwn: async (messageId, userId, connection) => {
        const result = await query(
            "messages.delete",
            "DELETE FROM messages WHERE messageId = ? AND userId = ?",
            [messageId, userId],
            connection
        );
        return result.affectedRows > 0;
    },

    deleteById: async (messageId, connection) => {
        const result = await query(
            "messages.deleteAny",
            "DELETE FROM messages WHERE messageId = ?",
            [messageId],
            connection
        );
        return result.affectedRows > 0;
    },

    channelOf: async (messageId, connection) => {
        const row = await queryOne(
            "messages.channelOf",
            "SELECT channelId FROM messages WHERE messageId = ?",
            [messageId],
            connection
        );
        return row ? Number(row.channelId) : null;
    },

    authorOf: async (messageId, connection) => {
        const row = await queryOne(
            "messages.authorOf",
            "SELECT userId FROM messages WHERE messageId = ?",
            [messageId],
            connection
        );
        return row ? Number(row.userId) : null;
    },

    resolveMentions: (channelId, handles, authorId, connection) => {
        if (handles.length === 0) return [];
        const placeholders = handles.map(() => "?").join(",");
        return query(
            "messages.resolveMentions",
            `SELECT DISTINCT u.userId
             FROM channels c
             JOIN users u
             LEFT JOIN guild_members gm ON gm.userId = u.userId AND gm.guildId = c.guildId
             LEFT JOIN friendships f ON f.friendshipId = c.friendshipId
             WHERE c.channelId = ? AND LOWER(u.handle) IN (${placeholders}) AND u.userId <> ?
               AND (
                   (c.guildId IS NOT NULL AND gm.guildId = c.guildId)
                   OR (c.friendshipId IS NOT NULL AND f.status = 'accepted'
                       AND u.userId IN (f.requesterId, f.addresseeId))
               )`,
            [channelId, ...handles, authorId],
            connection
        );
    },

    listGuildMentionRecipients: (channelId, authorId, connection) =>
        query(
            "messages.listGuildMentionRecipients",
            `SELECT gm.userId
         FROM channels c
         JOIN guilds g ON g.guildId = c.guildId
         JOIN guild_members gm ON gm.guildId = c.guildId
         WHERE c.channelId = ? AND gm.userId <> ?
           ${VISIBLE_TO_MEMBER}`,
            [channelId, authorId],
            connection
        ),

    listRoleMentionRecipients: (channelId, roleIds, authorId, connection) => {
        if (roleIds.length === 0) return Promise.resolve([]);
        const placeholders = roleIds.map(() => "?").join(",");
        return query(
            "messages.listRoleMentionRecipients",
            `SELECT DISTINCT gm.userId
             FROM channels c
             JOIN guilds g ON g.guildId = c.guildId
             JOIN guild_members gm ON gm.guildId = c.guildId
             JOIN guild_member_roles mentioned
               ON mentioned.guildId = c.guildId
              AND mentioned.userId = gm.userId
              AND mentioned.roleId IN (${placeholders})
             WHERE c.channelId = ? AND gm.userId <> ?
               ${VISIBLE_TO_MEMBER}`,
            [...roleIds, channelId, authorId],
            connection
        );
    },

    lastIdIn: (channelId, connection) =>
        queryOne(
            "messages.lastIdIn",
            "SELECT CAST(MAX(messageId) AS CHAR) AS messageId FROM messages WHERE channelId = ?",
            [channelId],
            connection
        ),

    latestPerChannel: (channelIds, connection) => {
        if (channelIds.length === 0) return Promise.resolve([]);
        const placeholders = channelIds.map(() => "?").join(",");
        return query(
            "messages.latestPerChannel",
            `${SELECT_WITH_AUTHOR}
             JOIN (
                 SELECT channelId, MAX(messageId) AS messageId
                 FROM messages
                 WHERE channelId IN (${placeholders})
                 GROUP BY channelId
             ) last ON last.messageId = m.messageId
             ORDER BY m.messageId DESC`,
            channelIds,
            connection
        );
    },

    latestAcrossChannels: (channelIds, limit, connection) => {
        if (channelIds.length === 0) return Promise.resolve([]);
        const placeholders = channelIds.map(() => "?").join(",");
        return query(
            "messages.latestAcrossChannels",
            `${SELECT_WITH_AUTHOR}
             WHERE m.channelId IN (${placeholders})
             ORDER BY m.messageId DESC
             LIMIT ${Math.min(Math.max(limit, 1), 50)}`,
            channelIds,
            connection
        );
    },

    listByChannel: async (channelId, limit, before, connection) => {
        const pageSize = Math.min(Math.max(Number.parseInt(limit, 10) || 50, 1), 100);
        const take = pageSize + 1;

        const rows = before
            ? await query(
                  "messages.listByChannelBefore",
                  `${SELECT_WITH_AUTHOR}
                   WHERE m.channelId = ? AND m.messageId < ? AND m.threadRootId IS NULL
                   ORDER BY m.messageId DESC
                   LIMIT ${take}`,
                  [channelId, before],
                  connection
              )
            : await query(
                  "messages.listByChannel",
                  `${SELECT_WITH_AUTHOR}
                   WHERE m.channelId = ? AND m.threadRootId IS NULL
                   ORDER BY m.messageId DESC
                   LIMIT ${take}`,
                  [channelId],
                  connection
              );

        const hasMore = rows.length > pageSize;
        const page = hasMore ? rows.slice(0, pageSize) : rows;
        const nextCursor = hasMore ? page[page.length - 1].messageId : null;
        return { rows: page, hasMore, nextCursor };
    },

    addReaction: (messageId, userId, emoji, connection) =>
        query(
            "reactions.add",
            "INSERT IGNORE INTO message_reactions (messageId, userId, emoji) VALUES (?, ?, ?)",
            [messageId, userId, emoji],
            connection
        ),

    removeReaction: (messageId, userId, emoji, connection) =>
        query(
            "reactions.remove",
            "DELETE FROM message_reactions WHERE messageId = ? AND userId = ? AND emoji = ?",
            [messageId, userId, emoji],
            connection
        ),

    reactionAuthors: (messageId, emoji, limit, connection) =>
        query(
            "reactions.authors",
            `SELECT u.userId, u.handle, u.displayName, u.avatar, r.createdAt
               FROM message_reactions r
               JOIN users u ON u.userId = r.userId
              WHERE r.messageId = ? AND r.emoji = ?
              ORDER BY r.createdAt ASC
              LIMIT ${Math.min(Math.max(limit, 1), 50)}`,
            [messageId, emoji],
            connection
        ),

    favoriteReactions: (userId, limit, connection) =>
        query(
            "reactions.favorites",
            `SELECT emoji, COUNT(*) AS uses
               FROM message_reactions
              WHERE userId = ?
              GROUP BY emoji
              ORDER BY uses DESC, MAX(createdAt) DESC
              LIMIT ${Math.min(Math.max(limit, 1), 20)}`,
            [userId],
            connection
        ),

    reactionsForMessages: async (messageIds, userId, connection) => {
        if (messageIds.length === 0) return [];
        const placeholders = messageIds.map(() => "?").join(",");
        return query(
            "reactions.forMessages",
            `SELECT CAST(messageId AS CHAR) AS messageId, emoji, COUNT(*) AS count, MAX(userId = ?) AS me
             FROM message_reactions
             WHERE messageId IN (${placeholders})
             GROUP BY messageId, emoji
             ORDER BY MIN(createdAt)`,
            [userId, ...messageIds],
            connection
        );
    },
};

module.exports = messageRepository;
