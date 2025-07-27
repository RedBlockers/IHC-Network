const userModel = require("../models/userModel");
const guildModel = require("../models/guildModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");
const { saveImage } = require("../services/fileServices");
const socketIo = require("socket.io");
const e = require("express");
const { getIo, connectedUsers } = require("../utils/sharedState");

function CreateToken(username, userId, passwordUpdatedAt, profilePicture) {
    return jwt.sign(
        {
            username: username,
            userId: userId,
            passwordUpdatedAt: passwordUpdatedAt,
            profilePicture: profilePicture,
        },
        process.env.SECRET_KEY
    );
}

async function AuthenticateAndDecodeToken(token) {
    if (!token) {
        return { valid: false, message: "Token manquant", decodedToken: null };
    }

    try {
        const decodedToken = jwt.verify(token, process.env.SECRET_KEY);
        const existingUser = await userModel.getUserByUsername(
            decodedToken.username
        );
        if (existingUser.length === 0) {
            return {
                valid: false,
                message: "Utilisateur introuvable",
                decodedToken: null,
            };
        }

        if (
            new Date(existingUser[0].passwordUpdatedAt).getTime() <=
            new Date(decodedToken.passwordUpdatedAt).getTime()
        ) {
            return { valid: true, message: "Token Valide", decodedToken };
        } else {
            return {
                valid: false,
                message: "Le token est invalide, le mot de passe a été changé",
                decodedToken: null,
            };
        }
    } catch (err) {
        return {
            valid: false,
            message: "Token invalide ou expiré",
            decodedToken: null,
        };
    }
}

async function UpdateUsersFriendList(user1, user2) {
    let friends = await userModel.getFriends(user1.userId);
    //io.emit(`user${user1.username}/updateFriendList`, friends);
    const user1SocketId = connectedUsers.get(String(user1.userId));
    getIo().to(user1SocketId).emit("updateFriendList", friends);
    friends = await userModel.getFriends(user2.userId);
    //io.emit(`user${user2.userNickname}/updateFriendList`, friends);
    const user2SocketId = connectedUsers.get(String(user2.userId));
    getIo().to(user2SocketId).emit("updateFriendList", friends);
}

module.exports = {
    register: async (req, res) => {
        const startTime = Date.now();
        const { username, password, mail, profileImage } = req.body;
        let imagePath;
        try {
            // Vérifier si l'utilisateur existe déjà
            const existingUser = await userModel.getUserByUsername(username);
            if (existingUser.length > 0) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: `Tentative d'inscription avec un nom d'utilisateur déjà existant: ${username}`,
                    user: username,
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 409,
                });
                return res.status(409).json({
                    error: "Cet utilisateur existe déjà.",
                });
            }
            const existingEmail = await userModel.getUserByMail(mail);
            if (existingEmail.length > 0) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: `Tentative d'inscription avec un email déjà existant: ${mail}`,
                    user: username,
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 409,
                });
                return res.status(409).json({
                    error: "Cet Email est déjà associer a un compte.",
                });
            }

            if (profileImage) {
                imagePath = await saveImage(profileImage, "profiles");
            } else {
                imagePath = "NoScord.jpg";
            }

            if (!imagePath) {
                logger.error({
                    path: req.path,
                    method: req.method,
                    message: `Erreur lors de l'écriture de l'image pour l'utilisateur: ${username}`,
                    user: username,
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 500,
                });
                return res.status(500).json({
                    success: false,
                    message: "Erreur lors de l'écriture de l'image.",
                });
            }

            const resp = await userModel.createUser(
                username,
                password,
                mail,
                imagePath
            );
            resp;
            if (!resp.success) {
                logger.error({
                    path: req.path,
                    method: req.method,
                    message: `Erreur lors de la création de l'utilisateur: ${username}`,
                    user: username,
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 500,
                });
                return res.status(500).json({
                    message: "Erreur lors de l'inscription.",
                });
            }
            const token = CreateToken(
                username,
                resp.userId,
                resp.currentDateTime,
                imagePath
            );

            logger.info({
                path: req.path,
                method: req.method,
                message: `Utilisateur créé avec succès: ${username}`,
                user: username,
                ip: req.ip,
                duration: Date.now() - startTime,
                status: 201,
            });
            res.status(201).json({ token: token });
        } catch (error) {
            logger.error({
                path: req.path,
                method: req.method,
                message: `Erreur lors de l'inscription de l'utilisateur: ${username}`,
                user: username,
                ip: req.ip,
                duration: Date.now() - startTime,
                status: 500,
            });
            res.json({
                success: false,
                message: "Erreur lors de l'inscription.",
            });
        }
    },
    connect: async (req, res) => {
        const startTime = Date.now();
        try {
            const { username, password } = req.body;
            const users = await userModel.getUserByUsername(username);
            const userAttempts = await userModel.getUserAttempts(req.ip);
            userAttempts.length;
            if (userAttempts.length > 5) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: `Compte temporairement bloqué après tentative de connexion suspecte.`,
                    user: username,
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 403,
                });
                return res.json({
                    message:
                        "Votre compte a été bloquer suite a une activité suspecte, veuillez rééssayer ultérieurement ",
                });
            }
            if (!(await userModel.checkPassword(users, password)).success) {
                await userModel.addUserAttempt(req.ip);
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: `Tentative de connexion échouée`,
                    user: username,
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 401,
                });
                return res.json({
                    success: false,
                    message: "Nom d'utilisateur ou mot de passe incorrect.",
                });
            }
            await userModel.deleteUserAttempt(req.ip);
            const token = CreateToken(
                username,
                users[0].userId,
                users[0].passwordUpdatedAt,
                users[0].userImage
            );
            logger.info({
                path: req.path,
                method: req.method,
                message: `Connexion réussie pour l'utilisateur`,
                user: username,
                userId: users[0].userId,
                ip: req.ip,
                duration: Date.now() - startTime,
                status: 200,
            });
            res.json({ success: true, token: token });
        } catch (error) {
            logger.error({
                path: req.path,
                method: req.method,
                message: `Erreur lors de la connexion de l'utilisateur`,
                err: error.stack,
                user: username,
                ip: req.ip,
                duration: Date.now() - startTime,
                status: 500,
            });
            res.json({
                success: false,
                message: "Erreur lors de la connexion.",
            });
        }
    },

    RequestFriend: async (req, res) => {
        const startTime = Date.now();
        try {
            const authHeader = req.headers["authorization"];

            if (!authHeader) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: "Tentative d'envoi de demande d'ami sans token",
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 401,
                });
                return res.status(401).json({ message: "Token manquant" });
            }

            const token = authHeader && authHeader.split(" ")[1];
            if (!token) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: "Tentative d'envoi de demande d'ami sans token",
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 401,
                });
                return res.status(401).json({ message: "Token manquant" });
            }
            const { valid, message, decodedToken } =
                await AuthenticateAndDecodeToken(token);
            if (!valid) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message:
                        "Tentative d'envoi de demande d'ami avec un token invalide",
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 401,
                });
                return res.status(401).json({ error: message });
            }
            const { username } = req.body;

            if (!username) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: "Nom d'utilisateur manquant dans la demande d'ami",
                    userId: decodedToken.userId,
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 400,
                });
                return res.status(400).json({
                    success: false,
                    message: "Nom d'utilisateur manquant.",
                });
            }

            const user = await userModel.getUserByUsername(username);
            if (!user) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: `Utilisateur introuvable pour la demande d'ami`,
                    userId: decodedToken.userId,
                    requestedUsername: username,
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 404,
                });
                return res.status(404).json({
                    success: false,
                    message: "Utilisateur introuvable.",
                });
            }

            const resp = await userModel.addFriendRequest(
                decodedToken.userId,
                user[0].userId
            );

            if (!resp.success) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: `Demande d'ami déjà existante ou conflit`,
                    userId: decodedToken.userId,
                    requestedUserId: user[0].userId,
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 409,
                });
                return res
                    .status(409)
                    .json({ success: false, message: resp.message });
            }
            await UpdateUsersFriendList(decodedToken, user[0]);

            logger.info({
                path: req.path,
                method: req.method,
                message: `Demande d'ami envoyée avec succès`,
                userId: decodedToken.userId,
                requestedUserId: user[0].userId,
                ip: req.ip,
                duration: Date.now() - startTime,
                status: 200,
            });
            return res.json({
                success: true,
                message: "Demande d'ami envoyée.",
            });
        } catch (error) {
            logger.error({
                path: req.path,
                method: req.method,
                message: `Erreur lors de l'envoi de la demande d'ami`,
                err: error.stack,
                ip: req.ip,
                duration: Date.now() - startTime,
                status: 500,
            });
            return res.status(500).json({
                success: false,
                message: "Erreur lors de l'envoi de la demande d'ami.",
            });
        }
    },

    getFriends: async (req, res) => {
        const startTime = Date.now();
        try {
            const authHeader = req.headers["authorization"];
            if (!authHeader) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: "Tenteative d'accès aux amis sans token",
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 401,
                });
                return res.status(401).json({ message: "Token manquant" });
            }
            const token = authHeader && authHeader.split(" ")[1];
            if (!token) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: "Tenteative d'accès aux amis sans token",
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 401,
                });
                return res.status(401).json({ message: "Token manquant" });
            }
            const { valid, message, decodedToken } =
                await AuthenticateAndDecodeToken(token);
            if (!valid) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message:
                        "Tentative d'accès aux amis avec un token invalide",
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 401,
                });
                return res.status(401).json({ error: message });
            }

            const friends = await userModel.getFriends(decodedToken.userId);
            if (!friends) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: "Aucun amis trouvé pour l'utilisateur",
                    userId: decodedToken.userId,
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 404,
                });
                return res
                    .status(404)
                    .json({ success: false, message: "Aucun amis trouvé." });
            }
            logger.info({
                path: req.path,
                method: req.method,
                message: "Liste des amis récupérée avec succès",
                userId: decodedToken.userId,
                ip: req.ip,
                duration: Date.now() - startTime,
                status: 200,
            });
            return res.status(200).json({ success: true, friends: friends });
        } catch (error) {}
    },

    authenticateToken: async (req, res) => {
        const startTime = Date.now();
        try {
            const authHeader = req.headers["authorization"];
            if (!authHeader) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: "Tentative d'authentification sans token",
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 401,
                });
                return res.status(401).json({ message: "Token manquant" });
            }
            const token = authHeader && authHeader.split(" ")[1];
            if (!token) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: "Tentative d'authentification sans token",
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 401,
                });
                return res.status(401).json({ message: "Token manquant" });
            }

            // Utiliser la fonction de vérification du token
            const { valid, message, decodedToken } =
                await AuthenticateAndDecodeToken(token);
            const user = await userModel.getUserById(decodedToken.userId);
            if (valid) {
                logger.info({
                    path: req.path,
                    method: req.method,
                    message: "Token authentifié avec succès",
                    userId: decodedToken.userId,
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 200,
                });
                res.status(200).json({
                    success: true,
                    message,
                    userId: decodedToken.userId,
                    username: user.userNickname,
                    avatar: user.userImage,
                });
            } else {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: "Token invalide ou expiré",
                    userId: decodedToken.userId,
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 401,
                });
                res.status(401).json({ success: false, message });
            }
        } catch (error) {
            logger.error({
                path: req.path,
                method: req.method,
                message: "Erreur lors de l'authentification du token",
                err: error.stack,
                ip: req.ip,
                duration: Date.now() - startTime,
                status: 500,
            });
            res.status(500).json({
                success: false,
                message: "Erreur lors de l'authentification du token.",
            });
        }
    },

    acceptFriend: async (req, res) => {
        const startTime = Date.now();
        try {
            const authHeader = req.headers["authorization"];
            if (!authHeader) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message:
                        "Tentative d'acceptation de demande d'ami sans token",
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 401,
                });
                return res.status(401).json({ message: "Token manquant" });
            }

            const token = authHeader && authHeader.split(" ")[1];
            if (!token) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message:
                        "Tentative d'acceptation de demande d'ami sans token",
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 401,
                });
                return res.status(401).json({ message: "Token manquant" });
            }

            const { valid, message, decodedToken } =
                await AuthenticateAndDecodeToken(token);
            if (!valid) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message:
                        "Tentative d'acceptation de demande d'ami avec un token invalide",
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 401,
                });

                return res.status(401).json({ success: false, message });
            }

            const { friendId } = req.body;

            if (!friendId) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: "ID d'ami manquant dans la demande d'acceptation",
                    userId: decodedToken.userId,
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 400,
                });
                return res.status(400).json({
                    success: false,
                    message: "ID d'ami manquant.",
                });
            }

            const resp = await userModel.acceptFriendRequest(
                decodedToken.userId,
                friendId
            );

            if (!resp.success) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: `Demande d'ami introuvable ou déjà acceptée pour l'utilisateur`,
                    userId: decodedToken.userId,
                    friendId: friendId,
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 409,
                });
                return res
                    .status(409)
                    .json({ success: false, message: resp.message });
            }

            const user = await userModel.getUserById(friendId);
            await UpdateUsersFriendList(decodedToken, user);
            logger.info({
                path: req.path,
                method: req.method,
                message: `Demande d'ami acceptée avec succès`,
                userId: decodedToken.userId,
                friendId: friendId,
                ip: req.ip,
                duration: Date.now() - startTime,
                status: 200,
            });
            return res.status(200).json({
                success: true,
                message: "Demande d'ami acceptée.",
            });
        } catch (error) {
            logger.error({
                path: req.path,
                method: req.method,
                message: "Erreur lors de l'acceptation de la demande d'ami",
                err: error.stack,
                ip: req.ip,
                duration: Date.now() - startTime,
                status: 500,
            });
            res.json({
                success: false,
                message: "Erreur lors de l'acceptation de la demande d'ami.",
            });
        }
    },

    removeFriend: async (req, res) => {
        const startTime = Date.now();
        try {
            const authHeader = req.headers["authorization"];
            if (!authHeader) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: "Tentative de suppression d'ami sans token",
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 401,
                });
                return res.status(401).json({ message: "Token manquant" });
            }
            const token = authHeader && authHeader.split(" ")[1];
            if (!token) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: "Tentative de suppression d'ami sans token",
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 401,
                });
                return res.status(401).json({ message: "Token manquant" });
            }

            const { friendId, isSender } = req.body;

            if (!friendId) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: "ID d'ami manquant dans la demande de suppression",
                    userId: req.userId,
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 400,
                });
                return res.status(400).json({
                    success: false,
                    message: "ID d'ami manquant.",
                });
            }

            const { valid, message, decodedToken } =
                await AuthenticateAndDecodeToken(token);
            if (!valid) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message:
                        "Tentative de suppression d'ami avec un token invalide",
                    ip: req.ip,
                    status: 401,
                    duration: Date.now() - startTime,
                });
                return res.status(401).json({ success: false, message });
            }

            if (isSender === undefined || isSender === null) {
                const userFriends = await userModel.getFriends(
                    decodedToken.userId
                );
                const isFriend = userFriends.some(
                    (friend) => friend.userId === friendId
                );
                if (isFriend) {
                    const resp = await userModel.RemoveFriend(
                        decodedToken.userId,
                        friendId
                    );
                    if (!resp.success) {
                        return res
                            .status(404)
                            .json({ success: false, message: resp.message });
                    }
                    const user = await userModel.getUserById(friendId);
                    await UpdateUsersFriendList(decodedToken, user);
                    return res.json({
                        success: true,
                        message: "Ami supprimé.",
                    });
                }
            } else {
                const action = isSender ? "cancel" : "refuse";
                const resp = isSender
                    ? await userModel.cancelFriendRequest(
                          decodedToken.userId,
                          friendId
                      )
                    : await userModel.refuseFriendRequest(
                          decodedToken.userId,
                          friendId
                      );

                if (!resp.success) {
                    return res
                        .status(409)
                        .json({ success: false, message: resp.message });
                }

                const user = await userModel.getUserById(friendId);
                await UpdateUsersFriendList(decodedToken, user);

                return res.json({
                    success: true,
                    message:
                        action === "cancel"
                            ? "Demande d'ami annulée."
                            : "Demande d'ami refusée.",
                });
            }
        } catch (error) {
            logger.error({
                path: req.path,
                method: req.method,
                message: "Erreur lors de la suppression d'ami",
                err: error.stack,
                ip: req.ip,
                duration: Date.now() - startTime,
                status: 500,
            });
            return res.status(500).json({
                success: false,
                message: "Erreur lors du traitement de la demande d'ami.",
            });
        }
    },

    getUserInfo: async (req, res) => {
        const startTime = Date.now();
        const authHeader = req.headers["authorization"];

        if (!authHeader) {
            logger.warn({
                path: req.path,
                method: req.method,
                message:
                    "Tentative de récupération des informations utilisateur sans token",
                ip: req.ip,
                duration: Date.now() - startTime,
                status: 401,
            });

            return res.status(401).json({ message: "Token manquant" });
        }
        const token = authHeader && authHeader.split(" ")[1];
        const { valid, message, decodedToken } =
            await AuthenticateAndDecodeToken(token);
        if (!valid) {
            logger.warn({
                path: req.path,
                method: req.method,
                message:
                    "Tentative de récupération des informations utilisateur avec un token invalide",
                ip: req.ip,
                duration: Date.now() - startTime,
                status: 401,
            });

            return res.status(401).json({ message: "Token invalide" });
        }
        const reqUserId = req.query.userId;
        if (!reqUserId) {
            logger.warn({
                path: req.path,
                method: req.method,
                message: "ID utilisateur manquant dans la requête",
                userId: decodedToken.userId,
                ip: req.ip,
                duration: Date.now() - startTime,
                status: 400,
            });
            return res.status(400).json({ message: "userId manquant" });
        }
        try {
            const user = await userModel.getUserInfoById(
                decodedToken.userId,
                reqUserId
            );
            if (!user) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: `Utilisateur introuvable pour l'ID: ${reqUserId}`,
                    userId: decodedToken.userId,
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 404,
                });
                return res
                    .status(404)
                    .json({ message: "Utilisateur introuvable" });
            }
            logger.info({
                path: req.path,
                method: req.method,
                message: `Informations utilisateur récupérées avec succès`,
                userId: decodedToken.userId,
                requestedUserId: reqUserId,
                ip: req.ip,
                duration: Date.now() - startTime,
                status: 200,
            });
            return res.status(200).json(user);
        } catch (error) {
            logger.error({
                path: req.path,
                method: req.method,
                message:
                    "Erreur lors de la récupération des informations utilisateur",
                err: error.stack,
                ip: req.ip,
                duration: Date.now() - startTime,
                status: 500,
            });
            return res.status(500).json({
                message:
                    "Erreur lors de la récupération des informations de l'utilisateur",
            });
        }
    },

    isUserInGuild: async (guildId, userId) => {
        // Récupération des guilds de l'utilisateur
        guildId = parseInt(guildId);
        const userGuilds = await guildModel.getGuildsByUser(userId);
        const guild = userGuilds.find((guild) => guild.guildId == guildId);

        // Vérification de l'appartenance à la guilde
        if (!guild) {
            logger.warn(
                `L'utilisateur n°${userId} n'est pas dans la guilde n°${guildId}`
            );
            return false;
        }
        return { userInGuild: true, guild };
    },

    AuthenticateAndDecodeToken,
};
