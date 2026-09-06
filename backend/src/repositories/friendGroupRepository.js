"use strict";

const { query, queryOne } = require("../db/pool");

const friendGroupRepository = {
    list: (userId, connection) =>
        query(
            "friendGroups.list",
            `SELECT g.groupId, g.name, g.position,
                    COALESCE((
                        SELECT JSON_ARRAYAGG(m.friendId)
                        FROM friend_group_members m
                        WHERE m.groupId = g.groupId AND m.userId = g.userId
                    ), JSON_ARRAY()) AS members
             FROM friend_groups g
             WHERE g.userId = ?
             ORDER BY g.position ASC, g.groupId ASC`,
            [userId],
            connection
        ),

    findById: (groupId, userId, connection) =>
        queryOne(
            "friendGroups.findById",
            "SELECT groupId, name, position FROM friend_groups WHERE groupId = ? AND userId = ?",
            [groupId, userId],
            connection
        ),

    nextPosition: (userId, connection) =>
        queryOne(
            "friendGroups.nextPosition",
            "SELECT COALESCE(MAX(position) + 1, 0) AS position FROM friend_groups WHERE userId = ?",
            [userId],
            connection
        ),

    create: async (userId, { name, position }, connection) => {
        const result = await query(
            "friendGroups.create",
            "INSERT INTO friend_groups (userId, name, position) VALUES (?, ?, ?)",
            [userId, name, position],
            connection
        );
        return Number(result.insertId);
    },

    rename: (groupId, userId, name, connection) =>
        query(
            "friendGroups.rename",
            "UPDATE friend_groups SET name = ? WHERE groupId = ? AND userId = ?",
            [name, groupId, userId],
            connection
        ),

    delete: (groupId, userId, connection) =>
        query(
            "friendGroups.delete",
            "DELETE FROM friend_groups WHERE groupId = ? AND userId = ?",
            [groupId, userId],
            connection
        ),

    addMember: (groupId, userId, friendId, connection) =>
        query(
            "friendGroups.addMember",
            "INSERT IGNORE INTO friend_group_members (groupId, userId, friendId) VALUES (?, ?, ?)",
            [groupId, userId, friendId],
            connection
        ),

    removeMember: (groupId, userId, friendId, connection) =>
        query(
            "friendGroups.removeMember",
            "DELETE FROM friend_group_members WHERE groupId = ? AND userId = ? AND friendId = ?",
            [groupId, userId, friendId],
            connection
        ),
};

module.exports = friendGroupRepository;
