"use strict";

const { query, queryOne } = require("../db/pool");

const groupChannelRepository = {
    create: async (name, ownerId, connection) => {
        const result = await query(
            "groups.create",
            "INSERT INTO channels (type, name, description, isGroup, groupOwnerId) VALUES ('text', ?, '', 1, ?)",
            [name, ownerId],
            connection
        );
        return Number(result.insertId);
    },

    addParticipants: (channelId, userIds, connection) => {
        if (userIds.length === 0) return Promise.resolve();
        const values = userIds.map(() => "(?, ?)").join(", ");
        return query(
            "groups.addParticipants",
            `INSERT IGNORE INTO channel_participants (channelId, userId) VALUES ${values}`,
            userIds.flatMap((userId) => [channelId, userId]),
            connection
        );
    },

    removeParticipant: (channelId, userId, connection) =>
        query(
            "groups.removeParticipant",
            "DELETE FROM channel_participants WHERE channelId = ? AND userId = ?",
            [channelId, userId],
            connection
        ),

    listParticipants: (channelId, connection) =>
        query(
            "groups.listParticipants",
            `SELECT u.userId, u.handle, u.displayName, u.avatar, p.joinedAt
             FROM channel_participants p
             JOIN users u ON u.userId = p.userId
             WHERE p.channelId = ?
             ORDER BY p.joinedAt ASC`,
            [channelId],
            connection
        ),

    countParticipants: (channelId, connection) =>
        queryOne(
            "groups.countParticipants",
            "SELECT COUNT(*) AS total FROM channel_participants WHERE channelId = ?",
            [channelId],
            connection
        ),

    listForUser: (userId, connection) =>
        query(
            "groups.listForUser",
            `SELECT c.channelId, c.name, c.groupOwnerId,
                    (SELECT COUNT(*) FROM channel_participants x WHERE x.channelId = c.channelId) AS participants,
                    COALESCE((
                        SELECT JSON_ARRAYAGG(u.displayName)
                        FROM channel_participants y
                        JOIN users u ON u.userId = y.userId
                        WHERE y.channelId = c.channelId AND y.userId <> ?
                    ), JSON_ARRAY()) AS others
             FROM channels c
             JOIN channel_participants p ON p.channelId = c.channelId AND p.userId = ?
             WHERE c.isGroup = 1
             ORDER BY c.channelId DESC`,
            [userId, userId],
            connection
        ),
};

module.exports = groupChannelRepository;
