const db = require("./connDB");
const bcrypt = require("bcrypt");
const logger = require("../utils/logger");
const e = require("express");

module.exports = {
    getUserByUsername: async (username) => {
        const startTime = Date.now();
        const [rows] = await db
            .promise()
            .execute("SELECT * FROM users WHERE userNickname = ?", [username]);
        logger.debug({
            event: "DBQuery",
            operation: "SELECT",
            table: "users",
            querySummary: `SELECT * FROM users WHERE userNickname = ${username}`,
            duration: Date.now() - startTime,
            success: true,
        });

        return rows;
    },

    getUserByMail: async (mail) => {
        const startTime = Date.now();
        const [rows] = await db
            .promise()
            .execute("SELECT * FROM users WHERE userEmail = ?", [mail]);
        logger.debug({
            event: "DBQuery",
            operation: "SELECT",
            table: "users",
            querySummary: `SELECT * FROM users WHERE userEmail = ${mail}`,
            duration: Date.now() - startTime,
            success: true,
        });
        return rows;
    },

    getUserById: async (userId) => {
        const startTime = Date.now();
        const [rows] = await db
            .promise()
            .execute("SELECT * FROM users WHERE userId = ?", [userId]);
        logger.debug({
            event: "DBQuery",
            operation: "SELECT",
            table: "users",
            querySummary: `SELECT * FROM users WHERE userId = ${userId}`,
            duration: Date.now() - startTime,
            success: true,
        });
        return rows[0];
    },

    createUser: async (username, password, mail, profileImagePath) => {
        const startTime = Date.now();

        try {
            // Hachage du mot de passe
            const hashedPassword = await bcrypt.hash(password, 10);
            const currentDateTime = new Date();
            username, hashedPassword, mail, profileImagePath, currentDateTime;
            // Exécution de la requête d'insertion
            const [result] = await db
                .promise()
                .execute(
                    "INSERT INTO users (userNickname, password, userEmail, userImage, passwordUpdatedAt) VALUES (?, ?, ?, ?, ?)",
                    [
                        username,
                        hashedPassword,
                        mail,
                        profileImagePath,
                        currentDateTime,
                    ]
                );

            logger.debug({
                event: "DBQuery",
                operation: "INSERT",
                table: "users",
                querySummary: `INSERT INTO users (userNickname, password, userEmail, userImage, passwordUpdatedAt) VALUES (?, ?, ?, ?, ?)`,
                duration: Date.now() - startTime,
                success: true,
            });
            // Retourner l'ID de l'utilisateur créé
            return {
                success: true,
                userId: result.insertId,
                currentDateTime: currentDateTime,
            };
        } catch (error) {
            logger.error({
                event: "DBError",
                message: error.message,
                stack: error.stack,
                duration: `${Date.now() - start}ms`,
            });
            return {
                success: false,
                message: "Erreur lors de la création de l'utilisateur.",
            };
        }
    },

    checkPassword: async (existingUser, password) => {
        if (existingUser.length === 0) {
            return {
                success: false,
                message: "Nom d'utilisateur ou mot de passe incorrect.",
            };
        }
        const isPasswordCorrect = await bcrypt.compare(
            password,
            existingUser[0].password
        );
        if (!isPasswordCorrect) {
            return {
                success: false,
                message: "Nom d'utilisateur ou mot de passe incorrect.",
            };
        }
        return { success: true };
    },

    addUserAttempt: async (ip) => {
        const startTime = Date.now();
        await db
            .promise()
            .execute("INSERT INTO user_attempts (ip) VALUES (?)", [ip]);
        logger.debug({
            event: "DBQuery",
            operation: "INSERT",
            table: "user_attempts",
            querySummary: `INSERT INTO user_attempts (ip) VALUES (?)`,
            duration: Date.now() - startTime,
            success: true,
        });
    },

    getUserAttempts: async (ip) => {
        const startTime = Date.now();
        const [result] = await db
            .promise()
            .execute("SELECT * FROM user_attempts WHERE ip = ?", [ip]);
        logger.debug({
            event: "DBQuery",
            operation: "SELECT",
            table: "user_attempts",
            querySummary: `SELECT * FROM user_attempts WHERE ip = ${ip}`,
            duration: Date.now() - startTime,
            success: true,
        });
        return result;
    },

    deleteUserAttempt: async (ip) => {
        const startTime = Date.now();
        await db
            .promise()
            .execute("DELETE FROM user_attempts WHERE ip = ?", [ip]);
        logger.debug({
            event: "DBQuery",
            operation: "DELETE",
            table: "user_attempts",
            querySummary: `DELETE FROM user_attempts WHERE ip = ${ip}`,
            duration: Date.now() - startTime,
            success: true,
        });
    },

    checkPendingFriendRequest: async (userId, friendId) => {
        const startTime = Date.now();
        const [result] = await db
            .promise()
            .execute(
                "SELECT * FROM friends WHERE userId = ? AND friendId = ? AND isPending = 1",
                [userId, friendId]
            );
        logger.debug({
            event: "DBQuery",
            operation: "SELECT",
            table: "friends",
            querySummary: `SELECT * FROM friends WHERE userId = ${userId} AND friendId = ${friendId} AND isPending = 1`,
            duration: Date.now() - startTime,
            success: true,
        });
        return result.length > 0;
    },

    addFriendRequest: async (userId, friendId) => {
        const startTime = Date.now();
        const hasPendingRequest =
            await module.exports.checkPendingFriendRequest(userId, friendId);
        if (hasPendingRequest) {
            return {
                success: false,
                message: "Une demande d'amis est déjà en cours.",
            };
        }
        await db
            .promise()
            .execute(
                "INSERT INTO friends (userId, friendId, isPending) VALUES (?, ?, 1)",
                [userId, friendId]
            );
        logger.debug({
            event: "DBQuery",
            operation: "INSERT",
            table: "friends",
            querySummary: `INSERT INTO friends (userId, friendId, isPending) VALUES (${userId}, ${friendId}, 1)`,
            duration: Date.now() - startTime,
            success: true,
        });
        return { success: true };
    },

    getFriends: async (userId) => {
        const startTime = Date.now();
        const [result] = await db.promise().execute(
            `
          SELECT u.userId, u.userNickname, u.userImage, f.isPending, f.UserId = ? AS isSender
          FROM friends f
          JOIN users u ON (f.friendId = u.userId AND f.userId = ?) OR (f.userId = u.userId AND f.friendId = ?)
      `,
            [userId, userId, userId]
        );
        logger.debug({
            event: "DBQuery",
            operation: "SELECT",
            table: "friends",
            querySummary: `SELECT u.userId, u.userNickname, u.userImage, f.isPending, f.UserId = ${userId} AS isSender FROM friends f JOIN users u ON (f.friendId = u.userId AND f.userId = ${userId}) OR (f.userId = u.userId AND f.friendId = ${userId})`,
            duration: Date.now() - startTime,
            success: true,
        });
        return result.map((r) => ({
            userId: r.userId,
            username: r.userNickname,
            userImage: r.userImage,
            isPending: r.isPending,
            isSender: r.isSender,
        }));
    },

    acceptFriendRequest: async (userId, friendId) => {
        const start = Date.now();

        try {
            const t0 = Date.now();
            const [updateRes] = await db
                .promise()
                .execute(
                    "UPDATE friends SET isPending = 0 WHERE userId = ? AND friendId = ?",
                    [friendId, userId]
                );
            logger.debug({
                event: "DBQuery",
                operation: "UPDATE",
                table: "friends",
                querySummary:
                    "SET isPending = 0 WHERE userId = ? AND friendId = ?",
                duration: `${Date.now() - t0}ms`,
                success: true,
            });

            if (updateRes.affectedRows === 0) {
                return {
                    success: false,
                    message: "Demande d'ami introuvable.",
                };
            }

            const t1 = Date.now();
            const [rows] = await db
                .promise()
                .execute(
                    "SELECT id FROM friends WHERE userId = ? AND friendId = ? AND isPending = 0",
                    [friendId, userId]
                );
            logger.debug({
                event: "DBQuery",
                operation: "SELECT",
                table: "friends",
                querySummary:
                    "SELECT id WHERE userId = ? AND friendId = ? AND isPending = 0",
                duration: `${Date.now() - t1}ms`,
                success: true,
            });

            const t2 = Date.now();
            await db
                .promise()
                .execute(
                    "INSERT INTO channels(type, name, description, guildId, isPrivate, friendId) VALUES (?,?,?,?,?,?)",
                    ["text", "Private chat", "Chat privé", null, 1, rows[0].id]
                );
            logger.debug({
                event: "DBQuery",
                operation: "INSERT",
                table: "channels",
                querySummary: "INSERT private chat channel for friendId",
                duration: `${Date.now() - t2}ms`,
                success: true,
            });

            return { success: true };
        } catch (error) {
            logger.error({
                event: "DBError",
                message: error.message,
                stack: error.stack,
                duration: `${Date.now() - start}ms`,
            });
            return {
                success: false,
                message: "Erreur lors de l'acceptation de la demande.",
            };
        }
    },

    refuseFriendRequest: async (userId, friendId) => {
        const startTime = Date.now();
        const res = await db
            .promise()
            .execute(
                "DELETE FROM friends WHERE userId = ? AND friendId = ? AND isPending = 1",
                [friendId, userId]
            );
        if (res[0].affectedRows === 0) {
            return { success: false, message: "Demande d'ami introuvable." };
        }
        logger.debug({
            event: "DBQuery",
            operation: "DELETE",
            table: "friends",
            querySummary: `DELETE FROM friends WHERE userId = ${friendId} AND friendId = ${userId} AND isPending = 1`,
            duration: Date.now() - startTime,
            success: true,
        });
        return { success: true };
    },
    cancelFriendRequest: async (userId, friendId) => {
        const startTime = Date.now();
        const res = await db
            .promise()
            .execute(
                "DELETE FROM friends WHERE userId = ? AND friendId = ? AND isPending = 1",
                [userId, friendId]
            );
        if (res[0].affectedRows === 0) {
            return { success: false, message: "Demande d'ami introuvable." };
        }
        logger.debug({
            event: "DBQuery",
            operation: "DELETE",
            table: "friends",
            querySummary: `DELETE FROM friends WHERE userId = ${userId} AND friendId = ${friendId} AND isPending = 1`,
            duration: Date.now() - startTime,
            success: true,
        });
        return { success: true };
    },
    RemoveFriend: async (userId, friendId) => {
        const startTime = Date.now();
        const connection = await db.promise().getConnection();
        try {
            await connection.beginTransaction();
            await connection.execute("SET foreign_key_checks = 0");
            const [res] = await connection.execute(
                "DELETE FROM friends WHERE ((userId = ? AND friendId = ?) OR ( userId = ? AND friendId = ? )) AND isPending = 0",
                [userId, friendId, friendId, userId]
            );
            logger.debug({
                event: "DBQuery",
                operation: "DELETE",
                table: "friends",
                querySummary: `DELETE FROM friends WHERE ((userId = ${userId} AND friendId = ${friendId}) OR (userId = ${friendId} AND friendId = ${userId})) AND isPending = 0`,
                duration: `${Date.now() - startTime}ms`,
                success: true,
            });
            await connection.execute("SET foreign_key_checks = 1");
            if (res.affectedRows === 0) {
                await connection.rollback();
                return { success: false, message: "Ami introuvable." };
            }
            await connection.commit();
            return { success: true };
        } catch (error) {
            await connection.rollback();
            logger.error({
                event: "DBError",
                message: error.message,
                stack: error.stack,
                duration: `${Date.now() - startTime}ms`,
            });
            throw error;
        } finally {
            connection.release();
        }
    },
    AddUserInvite: async (invite, userId) => {
        const startTime = Date.now();
        await db.promise().execute(
            `
        INSERT INTO users_invited (invite, user, used_at) 
        VALUES (?, ?, NOW()) 
        ON DUPLICATE KEY UPDATE used_at = NOW()
      `,
            [invite.id, userId]
        );
        logger.debug({
            event: "DBQuery",
            operation: "INSERT",
            table: "users_invited",
            querySummary: `INSERT INTO users_invited (invite, user, used_at) VALUES (${invite.id}, ${userId}, NOW()) ON DUPLICATE KEY UPDATE used_at = NOW()`,
            duration: Date.now() - startTime,
            success: true,
        });
    },
    getUserInfoById: async (userId, reqId) => {
        const startTime = Date.now();
        isOwn = userId == reqId ? 1 : 0;
        const [rows] = await db
            .promise()
            .execute(
                "SELECT userNickname, userImage, userId, aboutMe, notes, presence FROM users WHERE userId = ?",
                [reqId]
            );
        if (rows.length === 0) {
            return null;
        }

        logger.debug({
            event: "DBQuery",
            operation: "SELECT",
            table: "users",
            querySummary: `SELECT userNickname, userImage, userId, aboutMe, notes, presence FROM users WHERE userId = ${reqId}`,
            duration: Date.now() - startTime,
            success: true,
        });
        return rows.map((r) => ({
            userId: r.userId,
            username: r.userNickname,
            userImage: r.userImage,
            aboutMe: r.aboutMe,
            notes: r.notes,
            presence: r.presence,
            isOwn: isOwn,
        }))[0];
    },

    JoinGuild: async (userId, guildId) => {
        const t0 = Date.now();
        const [rows] = await db
            .promise()
            .execute(
                "SELECT * FROM guilds_user WHERE guildId = ? AND userId = ?",
                [guildId, userId]
            );
        logger.debug({
            event: "DBQuery",
            operation: "SELECT",
            table: "guilds_user",
            querySummary: `SELECT * FROM guilds_user WHERE guildId = ${guildId} AND userId = ${userId}`,
            duration: Date.now() - t0,
            success: true,
        });
        if (rows.length > 0) {
            return {
                success: false,
                message: "User already joined the guild.",
            };
        }
        const t1 = Date.now();
        await db
            .promise()
            .execute(
                "INSERT INTO guilds_joined (guildId, userId) VALUES (?, ?)",
                [guildId, userId]
            );
        logger.debug({
            event: "DBQuery",
            operation: "INSERT",
            table: "guilds_joined",
            querySummary: `INSERT INTO guilds_joined (guildId, userId) VALUES (${guildId}, ${userId})`,
            duration: Date.now() - t1,
            success: true,
        });
        return { success: true };
    },
};
