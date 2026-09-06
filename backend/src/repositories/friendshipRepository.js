"use strict";

const { query, queryOne } = require("../db/pool");

const friendshipRepository = {
    findBetween: (userA, userB, connection) =>
        queryOne(
            "friendships.findBetween",
            `SELECT * FROM friendships
             WHERE userLow = LEAST(?, ?) AND userHigh = GREATEST(?, ?)`,
            [userA, userB, userA, userB],
            connection
        ),

    findById: (friendshipId, connection) =>
        queryOne("friendships.findById", "SELECT * FROM friendships WHERE friendshipId = ?", [friendshipId], connection),

    create: async (requesterId, addresseeId, connection) => {
        const result = await query(
            "friendships.create",
            "INSERT INTO friendships (requesterId, addresseeId, status) VALUES (?, ?, 'pending')",
            [requesterId, addresseeId],
            connection
        );
        return result.insertId;
    },

    accept: (friendshipId, addresseeId, connection) =>
        query(
            "friendships.accept",
            "UPDATE friendships SET status = 'accepted' WHERE friendshipId = ? AND addresseeId = ? AND status = 'pending'",
            [friendshipId, addresseeId],
            connection
        ),

    remove: (friendshipId, connection) =>
        query("friendships.remove", "DELETE FROM friendships WHERE friendshipId = ?", [friendshipId], connection),

    listAcceptedIds: (userId, connection) =>
        query(
            "friendships.listAcceptedIds",
            `SELECT CASE WHEN f.requesterId = ? THEN f.addresseeId ELSE f.requesterId END AS userId
               FROM friendships f
              WHERE (f.requesterId = ? OR f.addresseeId = ?) AND f.status = 'accepted'`,
            [userId, userId, userId],
            connection
        ),

    listForUser: (userId, connection) =>
        query(
            "friendships.listForUser",
            `SELECT f.friendshipId, f.requesterId, f.status,
                    u.userId, u.handle, u.displayName, u.avatar, u.bannerImage, u.aboutMe,
                    u.activityText, u.statusPreference, u.presence, u.isBot
             FROM friendships f
             JOIN users u ON u.userId = CASE WHEN f.requesterId = ? THEN f.addresseeId ELSE f.requesterId END
             WHERE f.requesterId = ? OR f.addresseeId = ?
             ORDER BY f.status = 'pending' DESC, u.displayName ASC`,
            [userId, userId, userId],
            connection
        ),
};

module.exports = friendshipRepository;
