const db = require("./connDB");
const { logDB } = require("../utils/helpers/logHelper");
const mappers = require("../utils/mappers");

module.exports = {
    getUserById: async (userId) => {
        const startTime = Date.now();
        try {
            const [rows] = await db
                .promise()
                .execute("SELECT * FROM users WHERE userId = ?", [userId]);
            logDB(
                "SELECT",
                "users",
                startTime,
                true,
                `SELECT * FROM users WHERE userId = ${userId}`
            );
            return rows[0];
        } catch (error) {
            logDB(
                "SELECT",
                "users",
                startTime,
                false,
                `SELECT * FROM users WHERE userId = ${userId}`,
                error
            );
            throw error;
        }
    },
    getUserByHandle: async (handle) => {
        const startTime = Date.now();
        try {
            const [rows] = await db
                .promise()
                .execute("SELECT * FROM users WHERE handle = ?", [handle]);
            logDB(
                "SELECT",
                "users",
                startTime,
                true,
                `SELECT * FROM users WHERE handle = ${handle}`
            );
            return rows[0];
        } catch (error) {
            logDB(
                "SELECT",
                "users",
                startTime,
                false,
                `SELECT * FROM users WHERE handle = ${handle}`,
                error
            );
            throw error;
        }
    },
    getUserByDisplayName: async (displayName) => {
        const startTime = Date.now();
        try {
            const [rows] = await db
                .promise()
                .execute("SELECT * FROM users WHERE displayName = ?", [
                    displayName,
                ]);
            logDB(
                "SELECT",
                "users",
                startTime,
                true,
                `SELECT * FROM users WHERE displayName = ${displayName}`
            );
            return rows[0];
        } catch (error) {
            logDB(
                "SELECT",
                "users",
                startTime,
                false,
                `SELECT * FROM users WHERE displayName = ${displayName}`,
                error
            );
            throw error;
        }
    },
    getUserByEmail: async (email) => {
        const startTime = Date.now();
        try {
            const [rows] = await db
                .promise()
                .execute("SELECT * FROM users WHERE email = ?", [email]);
            logDB(
                "SELECT",
                "users",
                startTime,
                true,
                `SELECT * FROM users WHERE email = ${email}`
            );
            return rows[0];
        } catch (error) {
            logDB(
                "SELECT",
                "users",
                startTime,
                false,
                `SELECT * FROM users WHERE email = ${email}`,
                error
            );
            throw error;
        }
    },
    createUser: async (userData) => {
        const startTime = Date.now();
        try {
            const currentDateTime = new Date();

            const [result] = await db
                .promise()
                .execute(
                    "INSERT INTO users (handle, displayName, email, avatar, aboutMe, password, passwordUpdatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    [
                        userData.handle,
                        userData.displayName,
                        userData.email,
                        userData.avatar,
                        userData.aboutMe,
                        userData.password,
                        currentDateTime,
                    ]
                );
            logDB(
                "INSERT",
                "users",
                startTime,
                true,
                `INSERT INTO users (handle, displayName, email, avatar, password, passwordUpdatedAt) VALUES (?, ?, ?, ?, ?, ?)`
            );
            return {
                userId: result.insertId,
                handle: userData.handle,
                displayName: userData.displayName,
                userEmail: userData.email,
                userImage: userData.image,
                passwordUpdatedAt: currentDateTime,
                presence: "offline", // Valeur par défaut en DB
                aboutMe: userData.aboutMe || "",
                isBot: 0,
            };
        } catch (error) {
            logDB(
                "INSERT",
                "users",
                startTime,
                false,
                `Created user handle: ${userData.handle}`,
                error
            );
            return null;
        }
    },

    addUserAttempt: async (ip) => {
        try {
            const startTime = Date.now();
            await db
                .promise()
                .execute("INSERT INTO user_attempts (ip) VALUES (?)", [ip]);
            logDB(
                "INSERT",
                "user_attempts",
                startTime,
                true,
                `INSERT INTO user_attempts (ip) VALUES (${ip})`
            );
            return true;
        } catch (error) {
            logDB(
                "INSERT",
                "user_attempts",
                startTime,
                false,
                `INSERT INTO user_attempts (ip) VALUES (${ip})`,
                error
            );
            throw error;
        }
    },

    getUserAttempts: async (ip) => {
        const startTime = Date.now();
        const [result] = await db
            .promise()
            .execute("SELECT * FROM user_attempts WHERE ip = ?", [ip]);
        logDB(
            "SELECT",
            "user_attempts",
            startTime,
            true,
            `SELECT * FROM user_attempts WHERE ip = ${ip}`
        );
        return result;
    },

    deleteUserAttempt: async (ip) => {
        const startTime = Date.now();
        await db
            .promise()
            .execute("DELETE FROM user_attempts WHERE ip = ?", [ip]);
        logDB(
            "DELETE",
            "user_attempts",
            startTime,
            true,
            `DELETE FROM user_attempts WHERE ip = ${ip}`
        );
        return true;
    },

    checkPendingFriendRequest: async (userId, friendId) => {
        const startTime = Date.now();
        try {
            const [result] = await db
                .promise()
                .execute(
                    "SELECT * FROM friends WHERE userId = ? AND friendId = ? AND isPending = 1",
                    [userId, friendId]
                );
            logDB(
                "SELECT",
                "friends",
                startTime,
                true,
                `SELECT * FROM friends WHERE userId = ${userId} AND friendId = ${friendId} AND isPending = 1`
            );
            return result.length > 0;
        } catch (error) {
            logDB(
                "SELECT",
                "friends",
                startTime,
                false,
                `SELECT * FROM friends WHERE userId = ${userId} AND friendId = ${friendId} AND isPending = 1`,
                error
            );
            throw error;
        }
    },

    addFriendRequest: async (userId, friendId) => {
        const startTime = Date.now();
        try {
            await db
                .promise()
                .execute(
                    "INSERT INTO friends (userId, friendId, isPending) VALUES (?, ?, 1)",
                    [userId, friendId]
                );
            logDB(
                "INSERT",
                "friends",
                startTime,
                true,
                `INSERT INTO friends (userId, friendId, isPending) VALUES (${userId}, ${friendId}, 1)`
            );
            return true;
        } catch (error) {
            logDB(
                "INSERT",
                "friends",
                startTime,
                false,
                `INSERT INTO friends (userId, friendId, isPending) VALUES (${userId}, ${friendId}, 1)`,
                error
            );
            return false;
        }
    },

    getFriends: async (userId) => {
        const startTime = Date.now();
        const [result] = await db.promise().execute(
            `
          SELECT u.userId, u.handle, u.displayName, u.avatar, u.aboutMe, u.notes, u.presence, u.isBot, u.email, u.isEmailVerified, u.isBanned, u.banDayDuration , f.isPending, f.UserId = ? AS isSender
          FROM friends f
          JOIN users u ON (f.friendId = u.userId AND f.userId = ?) OR (f.userId = u.userId AND f.friendId = ?)
      `,
            [userId, userId, userId]
        );
        logDB(
            "SELECT",
            "friends",
            startTime,
            true,
            `SELECT u.*, f.isPending, f.UserId = ${userId} AS isSender FROM friends f JOIN users u ON (f.friendId = u.userId AND f.userId = ${userId}) OR (f.userId = u.userId AND f.friendId = ${userId})`
        );
        return result.map((row) => mappers.friendshipMapper(row));
    },

    acceptFriendRequest: async (
        userId,
        friendId,
        connection = db.promise()
    ) => {
        try {
            const startTime = Date.now();
            const [result] = await connection.execute(
                "UPDATE friends SET isPending = 0 WHERE userId = ? AND friendId = ?",
                [friendId, userId]
            );

            if (result.affectedRows === 0) return false;

            const [rows] = await connection.execute(
                "SELECT id FROM friends WHERE (userId = ? AND friendId = ?) OR (userId = ? AND friendId = ?)",
                [userId, friendId, friendId, userId]
            );

            logDB(
                "UPDATE",
                "friends",
                startTime,
                true,
                `UPDATE friends SET isPending = 0 WHERE userId = ${friendId} AND friendId = ${userId}`
            );
            return rows[0].id;
        } catch (error) {
            logDB(
                "UPDATE",
                "friends",
                startTime,
                false,
                `UPDATE friends SET isPending = 0 WHERE userId = ${friendId} AND friendId = ${userId}`,
                error
            );
            throw error;
        }
    },

    removeFriend: async (userId, friendId) => {
        const startTime = Date.now();
        try {
            const [result] = await db
                .promise()
                .execute(
                    "DELETE FROM friends WHERE ((userId = ? AND friendId = ?) OR ( userId = ? AND friendId = ? ))",
                    [userId, friendId, friendId, userId]
                );
            logDB(
                "DELETE",
                "friends",
                startTime,
                true,
                `DELETE FROM friends WHERE ((userId = ${userId} AND friendId = ${friendId}) OR (userId = ${friendId} AND friendId = ${userId}))`
            );
            return result.affectedRows > 0;
        } catch (error) {
            logDB(
                "DELETE",
                "friends",
                startTime,
                false,
                `DELETE FROM friends WHERE ((userId = ${userId} AND friendId = ${friendId}) OR (userId = ${friendId} AND friendId = ${userId}))`,
                error
            );
            return false;
        }
    },

    isAlreadyFriendOrPending: async (userId, friendId) => {
        const startTime = Date.now();
        try {
            const [result] = await db
                .promise()
                .execute(
                    "SELECT * FROM friends WHERE ((userId = ? AND friendId = ?) OR (userId = ? AND friendId = ?))",
                    [userId, friendId, friendId, userId]
                );
            logDB(
                "SELECT",
                "friends",
                startTime,
                true,
                `SELECT * FROM friends WHERE ((userId = ${userId} AND friendId = ${friendId}) OR (userId = ${friendId} AND friendId = ${userId}))`
            );
            return result.length > 0;
        } catch (error) {
            logDB(
                "SELECT",
                "friends",
                startTime,
                false,
                `SELECT * FROM friends WHERE ((userId = ${userId} AND friendId = ${friendId}) OR (userId = ${friendId} AND friendId = ${userId}))`,
                error
            );
            return false;
        }
    },

    AddUserInvite: async (invite, userId) => {
        const startTime = Date.now();
        try {
            await db.promise().execute(
                `
        INSERT INTO users_invited (invite, user, used_at) 
        VALUES (?, ?, NOW())
        ON DUPLICATE KEY UPDATE used_at = NOW()
      `,
                [invite.id, userId]
            );
            logDB(
                "INSERT",
                "users_invited",
                startTime,
                true,
                `INSERT INTO users_invited (invite, user, used_at) VALUES (${invite.id}, ${userId}, NOW()) ON DUPLICATE KEY UPDATE used_at = NOW()`
            );
        } catch (error) {
            logDB(
                "INSERT",
                "users_invited",
                startTime,
                false,
                `INSERT INTO users_invited (invite, user, used_at) VALUES (${invite.id}, ${userId}, NOW()) ON DUPLICATE KEY UPDATE used_at = NOW()`,
                error
            );
        }
    },

    JoinGuild: async (userId, guildId) => {
        const startTime = Date.now();
        try {
            const [rows] = await db
                .promise()
                .execute(
                    "INSERT INTO guilds_joined (guildId, userId) VALUES (?, ?)",
                    [guildId, userId]
                );
            logDB(
                "INSERT",
                "guilds_joined",
                startTime,
                true,
                `INSERT INTO guilds_joined (guildId, userId) VALUES (${guildId}, ${userId})`
            );
            return rows;
        } catch (error) {
            logDB("INSERT", "guilds_joined", startTime, false, error);
            throw error;
        }
    },

    getUsersByGuildId: async (guildId) => {
        const startTime = Date.now();
        try {
            const [rows] = await db.promise().execute(
                `SELECT u.userId, u.handle, u.displayName, u.avatar, u.aboutMe, u.notes, u.presence, u.isBot
                    FROM guilds_joined gj
                    JOIN users u ON gj.userId = u.userId
                    WHERE gj.guildId = ?`,
                [guildId]
            );
            logDB(
                "SELECT",
                "users, guilds_joined",
                startTime,
                true,
                `SELECT u.userId, u.handle, u.displayName, u.avatar, u.aboutMe, u.notes, u.presence, u.isBot FROM guilds_joined gj JOIN users u ON gj.userId = u.userId WHERE gj.guildId = ${guildId}`,
                [guildId]
            );
            return rows;
        } catch (error) {
            logDB(
                "SELECT",
                "users, guilds_joined",
                startTime,
                false,
                `SELECT u.userId, u.handle, u.displayName, u.avatar, u.aboutMe, u.notes, u.presence, u.isBot, u.email FROM guilds_joined gj JOIN users u ON gj.userId = u.userId WHERE gj.guildId = ${guildId}`,
                error
            );
            throw error;
        }
    },
    updateUserField: async (userId, field, value) => {
        const startTime = Date.now();

        try {
            // Sécurisation : empêcher la modification de champs sensibles
            const allowedFields = [
                "handle",
                "displayName",
                "email",
                "avatar",
                "aboutMe",
                "notes",
                "presence",
                "isBot",
                "isEmailVerified",
                "isBanned",
                "banDayDuration",
            ];

            if (!allowedFields.includes(field)) {
                throw new Error(`Champ non autorisé : ${field}`);
            }

            const sql = `UPDATE users SET ${field} = ? WHERE userId = ?`;

            const [result] = await db.promise().execute(sql, [value, userId]);

            logDB(
                "UPDATE",
                "users",
                startTime,
                true,
                `UPDATE users SET ${field} = ${value} WHERE userId = ${userId}`
            );

            return result.affectedRows > 0;
        } catch (error) {
            logDB(
                "UPDATE",
                "users",
                startTime,
                false,
                `UPDATE users SET ${field} = ${value} WHERE userId = ${userId}`,
                error
            );
            throw error;
        }
    },
};
