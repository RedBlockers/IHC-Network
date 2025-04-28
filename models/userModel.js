const db = require("./connDB");
const bcrypt = require("bcrypt");
const logger = require("../utils/logger");

module.exports = {
    getUserByUsername: async (username) => {
        logger.info("getUserByUsername " + username);
        const [rows] = await db
            .promise()
            .execute("SELECT * FROM users WHERE userNickname = ?", [username]);
        return rows;
    },

    getUserByMail: async (mail) => {
        logger.info("getUserByMail " + mail);
        const [rows] = await db
            .promise()
            .execute("SELECT * FROM users WHERE userEmail = ?", [mail]);
        return rows;
    },

    getUserById: async (userId) => {
        logger.info("getUserById " + userId);
        const [rows] = await db
            .promise()
            .execute("SELECT * FROM users WHERE userId = ?", [userId]);
        return rows[0];
    },

    createUser: async (username, password, mail, profileImagePath) => {
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

            // Retourner l'ID de l'utilisateur créé
            return {
                success: true,
                userId: result.insertId,
                currentDateTime: currentDateTime,
            };
        } catch (error) {
            logger.error(
                "Erreur lors de la création de l'utilisateur:\n" + error.stack
            );
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
        logger.info("checkPassword for userId: " + existingUser[0].userId);
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
        await db
            .promise()
            .execute("INSERT INTO user_attempts (ip) VALUES (?)", [ip]);
    },

    getUserAttempts: async (ip) => {
        const [result] = await db
            .promise()
            .execute("SELECT * FROM user_attempts WHERE ip = ?", [ip]);
        return result;
    },

    deleteUserAttempt: async (ip) => {
        await db
            .promise()
            .execute("DELETE FROM user_attempts WHERE ip = ?", [ip]);
    },

    checkPendingFriendRequest: async (userId, friendId) => {
        const [result] = await db
            .promise()
            .execute(
                "SELECT * FROM friends WHERE userId = ? AND friendId = ? AND isPending = 1",
                [userId, friendId]
            );
        return result.length > 0;
    },

    addFriendRequest: async (userId, friendId) => {
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
        return { success: true };
    },

    getFriends: async (userId) => {
        const [result] = await db.promise().execute(
            `
          SELECT u.userId, u.userNickname, u.userImage, f.isPending, f.UserId = ? AS isSender
          FROM friends f
          JOIN users u ON (f.friendId = u.userId AND f.userId = ?) OR (f.userId = u.userId AND f.friendId = ?)
      `,
            [userId, userId, userId]
        );
        return result.map((r) => ({
            userId: r.userId,
            username: r.userNickname,
            userImage: r.userImage,
            isPending: r.isPending,
            isSender: r.isSender,
        }));
    },
    acceptFriendRequest: async (userId, friendId) => {
        const res = await db
            .promise()
            .execute(
                "UPDATE friends SET isPending = 0 WHERE userId = ? AND friendId = ?",
                [friendId, userId]
            );
        if (res[0].affectedRows === 0) {
            return { success: false, message: "Demande d'ami introuvable." };
        }
        const [rows] = await db
            .promise()
            .execute(
                "SELECT id FROM friends WHERE userId = ? AND friendId = ? AND isPending = 0",
                [friendId, userId]
            );
        await db
            .promise()
            .execute(
                "INSERT INTO channels(type, name, description, guildId, isPrivate, friendId) VALUES (?,?,?,?,?,?)",
                ["text", "Private chat", "Chat privé", null, 1, rows[0].id]
            );
        return { success: true };
    },

    refuseFriendRequest: async (userId, friendId) => {
        const res = await db
            .promise()
            .execute(
                "DELETE FROM friends WHERE userId = ? AND friendId = ? AND isPending = 1",
                [friendId, userId]
            );
        if (res[0].affectedRows === 0) {
            return { success: false, message: "Demande d'ami introuvable." };
        }
        return { success: true };
    },
    cancelFriendRequest: async (userId, friendId) => {
        const res = await db
            .promise()
            .execute(
                "DELETE FROM friends WHERE userId = ? AND friendId = ? AND isPending = 1",
                [userId, friendId]
            );
        if (res[0].affectedRows === 0) {
            return { success: false, message: "Demande d'ami introuvable." };
        }
        return { success: true };
    },
    RemoveFriend: async (userId, friendId) => {
        const connection = await db.promise().getConnection();
        try {
            await connection.beginTransaction();
            await connection.execute("SET foreign_key_checks = 0");
            const [res] = await connection.execute(
                "DELETE FROM friends WHERE ((userId = ? AND friendId = ?) OR ( userId = ? AND friendId = ? )) AND isPending = 0",
                [userId, friendId, friendId, userId]
            );
            await connection.execute("SET foreign_key_checks = 1");
            if (res.affectedRows === 0) {
                await connection.rollback();
                return { success: false, message: "Ami introuvable." };
            }
            await connection.commit();
            return { success: true };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    },
    AddUserInvite: async (invite, userId) => {
        await db.promise().execute(
            `
        INSERT INTO users_invited (invite, user, used_at) 
        VALUES (?, ?, NOW()) 
        ON DUPLICATE KEY UPDATE used_at = NOW()
      `,
            [invite.id, userId]
        );
    },
    getUserInfoById: async (userId,reqId) => {

        isOwn = userId == reqId ? 1 : 0;
        const [rows] = await db
        .promise()
        .execute(
            "SELECT userNickname, userImage, userId, aboutMe, notes, presence FROM users WHERE userId = ?",
            [reqId]
        );
        if (rows.length === 0) {
            return new Error("User not found");
        }

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
        const [rows] = await db
            .promise()
            .execute(
                "SELECT * FROM guilds_user WHERE guildId = ? AND userId = ?",
                [guildId, userId]
            );
        if (rows.length > 0) {
            return {
                success: false,
                message: "User already joined the guild.",
            };
        }
        await db
            .promise()
            .execute(
                "INSERT INTO guilds_joined (guildId, userId) VALUES (?, ?)",
                [guildId, userId]
            );
        return { success: true };
    },
};
