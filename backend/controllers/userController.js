const userModel = require("../models/userModel");
const bcrypt = require("bcrypt");
const { getIo, connectedUsers } = require("../utils/sharedState");
const { logAPI } = require("../utils/helpers/logHelper");
const mappers = require("../utils/mappers");
const { CreateToken } = require("../utils/helpers/authHelper");
const db = require("../models/connDB");
const channelModel = require("../models/channelModel");
const { saveAvatar, saveTempAvatar } = require("../services/fileServices");

async function UpdateUsersFriendList(user1, user2) {
    let friends = await userModel.getFriends(user1.userId);
    const user1SocketId = connectedUsers.get(String(user1.userId));
    getIo().to(user1SocketId).emit("updateFriendList", friends);
    friends = await userModel.getFriends(user2.userId);
    const user2SocketId = connectedUsers.get(String(user2.userId));
    getIo().to(user2SocketId).emit("updateFriendList", friends);
}

module.exports = {
    register: async (req, res) => {
        const startTime = Date.now();

        const { handle, password, email, displayName, bio } = req.body;
        const file = req.file;
        try {
            const existingUser = await userModel.getUserByHandle(handle);

            if (existingUser) {
                logAPI(
                    req.method,
                    req.path,
                    409,
                    startTime,
                    false,
                    `Tentative d'inscription avec un nom d'utilisateur déjà existant: ${handle}`
                );
                return res.status(409).json({
                    error: "Cet utilisateur existe déjà.",
                });
            }
            const existingEmail = await userModel.getUserByEmail(email);

            if (existingEmail) {
                logAPI(
                    req.method,
                    req.path,
                    409,
                    startTime,
                    false,
                    `Tentative d'inscription avec un email déjà existant: ${email}`
                );
                return res.status(409).json({
                    error: "Cet Email est déjà associé à un compte.",
                });
            }

            let avatarUrl;

            if (file) {
                avatarUrl = await saveTempAvatar(file);
                if (!avatarUrl) {
                    logAPI(
                        req.method,
                        req.path,
                        503,
                        startTime,
                        false,
                        "Échec de l'upload de l'avatar sur S3"
                    );
                    return res.status(503).json({
                        error: "Le service de stockage est temporairement indisponible. Veuillez réessayer plus tard.",
                    });
                }
            } else {
                avatarUrl = "/assets/default-avatar.png";
            }

            const hashedPassword = await bcrypt.hash(password, 13);

            const result = await userModel.createUser({
                handle: handle,
                displayName: displayName,
                password: hashedPassword,
                email: email,
                avatar: avatarUrl,
                aboutMe: bio || "",
            });

            const token = CreateToken(result.userId, result.passwordUpdatedAt);

            const user = mappers.userPrivateMapper(result);

            if (file) {
                avatarUrl = await saveAvatar(
                    avatarUrl.split(`/${process.env.S3_BUCKET}/`)[1],
                    `users/${user.userId}/avatar/avatar.${file.mimetype.split("/")[1]}`
                );
                if (userModel.updateUserField(user.userId, "avatar", avatarUrl)) {
                    user.avatar = avatarUrl;
                }
            }

            if (result) {
                logAPI(req.method, req.path, 201, startTime, true);
                return res.status(201).json({
                    message: "Utilisateur créé avec succès.",
                    user: user,
                    token: token,
                });
            }
            logAPI(
                req.method,
                req.path,
                500,
                startTime,
                false,
                `Erreur lors de la création de l'utilisateur: ${handle}`
            );
            return res.status(500).json({
                message: "Erreur lors de l'inscription.",
            });
        } catch (error) {
            logAPI(req.method, req.path, 500, startTime, false, error);
            return res.status(500).json({
                message: "Erreur lors de l'inscription.",
            });
        }
    },

    checkFieldAvailability: async (req, res) => {
        const startTime = Date.now();
        try {
            const { handle, email } = req.query;
            let result = {};

            if (!handle && !email) {
                return res.status(400).json({
                    message:
                        "Vous devez fournir au moins un champ (handle ou email).",
                });
            }

            if (handle) {
                const user = await userModel.getUserByHandle(handle);
                if (user) {
                    result.handle = {
                        available: false,
                        message: "Ce Nom d'utilisateur est déjà utilisé.",
                    };
                } else {
                    result.handle = {
                        available: true,
                        message: "Ce Nom d'utilisateur est disponible.",
                    };
                }
            }
            if (email) {
                const user = await userModel.getUserByEmail(email);
                if (user) {
                    result.email = {
                        available: false,
                        message: "Cet email est déjà utilisé.",
                    };
                } else {
                    result.email = {
                        available: true,
                        message: "Cet email est disponible.",
                    };
                }
            }
            logAPI(req.method, req.path, 200, startTime, true);

            return res.status(200).json(result);
        } catch (error) {
            logAPI(req.method, req.path, 500, startTime, false, error);
            return res.status(500).json({
                message:
                    "Erreur lors de la vérification de l'unicité du handle ou de l'email.",
            });
        }
    },

    login: async (req, res) => {
        const startTime = Date.now();
        try {
            const { handle, password } = req.body;

            const attempts = await userModel.getUserAttempts(req.ip);
            if (attempts.length > 5) {
                logAPI(
                    req.method,
                    req.path,
                    429,
                    startTime,
                    false,
                    `Compte temporairement bloqué après tentative de connexion suspecte pour l'utilisateur: ${handle} depuis l'IP: ${req.ip}`
                );
                return res.status(429).json({
                    message:
                        "Trop de tentatives de connexion. Veuillez réessayer plus tard.",
                });
            }

            const user = await userModel.getUserByHandle(handle);

            if (!user || !(await bcrypt.compare(password, user.password))) {
                await userModel.addUserAttempt(req.ip);
                logAPI(
                    req.method,
                    req.path,
                    401,
                    startTime,
                    false,
                    `Tentative de connexion échouée pour l'utilisateur: ${handle} depuis l'IP: ${req.ip}`
                );
                return res.status(401).json({
                    message: "Nom d'utilisateur ou mot de passe incorrect.",
                });
            }

            await userModel.deleteUserAttempt(req.ip);

            const token = CreateToken(user.userId, user.passwordUpdatedAt);

            logAPI(req.method, req.path, 200, startTime, true);

            return res.status(200).json({
                token,
                user: mappers.userPrivateMapper(user),
            });
        } catch (error) {
            logAPI(req.method, req.path, 500, startTime, false, error);
            return res.status(500).json({
                message: "Erreur lors de la connexion.",
            });
        }
    },

    getMe: async (req, res) => {
        const startTime = Date.now();
        try {
            logAPI(req.method, req.path, 200, startTime, true);
            res.status(200).json({ user: mappers.userPrivateMapper(req.user) });
        } catch (error) {
            logAPI(req.method, req.path, 500, startTime, false, error);
            return res.status(500).json({
                message:
                    "Erreur lors de la récupération des informations de l'utilisateur.",
            });
        }
    },

    addFriendRequest: async (req, res) => {
        const startTime = Date.now();
        try {
            const { friendHandle } = req.params;
            const user = req.user;

            const friend = await userModel.getUserByHandle(friendHandle);
            if (!friend) {
                logAPI(
                    req.method,
                    req.path,
                    404,
                    startTime,
                    false,
                    `Utilisateur introuvable pour la demande d'ami: ${friendHandle}`
                );
                return res.status(404).json({
                    message: "Utilisateur introuvable.",
                });
            }

            if (
                await userModel.isAlreadyFriendOrPending(
                    user.userId,
                    friend.userId
                )
            ) {
                logAPI(
                    req.method,
                    req.path,
                    409,
                    startTime,
                    false,
                    `Demande d'ami déjà existante ou utilisateur déjà ami: ${friendHandle}`
                );
                return res.status(409).json({
                    message:
                        "Une demande d'ami existe déjà ou vous êtes déjà amis.",
                });
            }

            const resp = await userModel.addFriendRequest(
                user.userId,
                friend.userId
            );

            if (!resp) {
                logAPI(
                    req.method,
                    req.path,
                    500,
                    startTime,
                    false,
                    `Erreur lors de l'envoi de la demande d'ami à l'utilisateur: ${friendHandle}`
                );
                return res.status(500).json({
                    message: "Erreur lors de l'envoi de la demande d'ami.",
                });
            }

            logAPI(req.method, req.path, 200, startTime, true);
            return res.status(200).json({
                message: "Demande d'ami envoyée.",
                friend: mappers.userPublicMapper(friend),
            });
        } catch (error) {
            logAPI(req.method, req.path, 500, startTime, false, error);
            return res.status(500).json({
                message: "Erreur lors de l'envoi de la demande d'ami.",
            });
        }
    },

    getFriends: async (req, res) => {
        const startTime = Date.now();
        try {
            const friends = await userModel.getFriends(req.user.userId);
            logAPI(req.method, req.path, 200, startTime, true);
            return res.status(200).json({ friends: friends });
        } catch (error) {
            logAPI(req.method, req.path, 500, startTime, false, error);
            return res.status(500).json({
                message: "Erreur lors de la récupération de la liste des amis.",
            });
        }
    },

    acceptFriendRequest: async (req, res) => {
        const startTime = Date.now();
        const connection = await db.promise().getConnection();

        try {
            const { friendId } = req.params;
            const user = req.user;

            const friend = await userModel.getUserById(friendId);
            if (!friend) {
                logAPI(
                    req.method,
                    req.path,
                    404,
                    startTime,
                    false,
                    `Utilisateur introuvable pour l'acceptation de la demande d'ami: ${friendId}`
                );
                return res.status(404).json({
                    message: "Utilisateur introuvable.",
                });
            }

            await connection.beginTransaction();

            const friendRelationId = await userModel.acceptFriendRequest(
                user.userId,
                friendId,
                connection
            );
            if (!friendRelationId) {
                await connection.rollback();
                logAPI(
                    req.method,
                    req.path,
                    404,
                    startTime,
                    false,
                    `Demande d'ami introuvable ou déjà acceptée pour l'utilisateur: ${friendId}`
                );
                return res.status(404).json({
                    message: "Demande d'ami introuvable ou déjà acceptée.",
                });
            }

            await channelModel.createChannel(
                "text",
                "Private chat",
                "Chat privé",
                null,
                friendRelationId,
                connection
            );

            await connection.commit();
            await UpdateUsersFriendList(user, friend);

            logAPI(req.method, req.path, 200, startTime, true);
            return res.status(200).json({
                message: "Demande d'ami acceptée.",
            });
        } catch (error) {
            await connection.rollback();
            logAPI(req.method, req.path, 500, startTime, false, error);
            return res.status(500).json({
                message: "Erreur lors de l'acceptation de la demande d'ami.",
            });
        } finally {
            connection.release();
        }
    },

    removeFriend: async (req, res) => {
        const startTime = Date.now();
        try {
            const { friendId } = req.params;
            const user = req.user;

            const friend = await userModel.getUserById(friendId);
            if (!friend) {
                logAPI(
                    req.method,
                    req.path,
                    404,
                    startTime,
                    false,
                    `Utilisateur introuvable pour la suppression de l'ami: ${friendId}`
                );
                return res.status(404).json({
                    message: "Utilisateur introuvable.",
                });
            }

            if (
                !(await userModel.isAlreadyFriendOrPending(
                    user.userId,
                    friendId
                ))
            ) {
                logAPI(
                    req.method,
                    req.path,
                    404,
                    startTime,
                    false,
                    `Aucun lien d'amitié ou de demande d'ami existant pour la suppression avec l'utilisateur: ${friend.handle}`
                );
                return res.status(404).json({
                    message:
                        "Aucun lien d'amitié ou de demande d'ami existant.",
                });
            }

            const resp = await userModel.removeFriend(user.userId, friendId);
            if (!resp) {
                logAPI(
                    req.method,
                    req.path,
                    500,
                    startTime,
                    false,
                    `Erreur lors de la suppression de l'ami: ${friend.handle}`
                );
                return res.status(500).json({
                    message: "Erreur lors de la suppression de l'ami.",
                });
            }

            await UpdateUsersFriendList(user, friend);

            logAPI(req.method, req.path, 204, startTime, true);
            return res.status(204).end();
        } catch (error) {
            logAPI(req.method, req.path, 500, startTime, false, error);
            return res.status(500).json({
                message: "Erreur lors de la suppression de l'ami.",
            });
        }
    },

    getUser: async (req, res) => {
        const startTime = Date.now();
        try {
            const { userId } = req.params;
            const user = await userModel.getUserById(userId);
            if (!user) {
                logAPI(
                    req.method,
                    req.path,
                    404,
                    startTime,
                    false,
                    `Utilisateur introuvable pour l'ID: ${userId}`
                );
                return res
                    .status(404)
                    .json({ message: "Utilisateur introuvable" });
            }
            logAPI(req.method, req.path, 200, startTime, true);
            return res.status(200).json(mappers.userPublicMapper(user));
        } catch (error) {
            logAPI(req.method, req.path, 500, startTime, false, error);
            return res.status(500).json({
                message:
                    "Erreur lors de la récupération des informations de l'utilisateur",
            });
        }
    },

    getPrivateChannels: async (req, res) => {
        const startTime = Date.now();
        try {
            const channels = await channelModel.getPrivateChannelsByUserId(
                req.user.userId
            );
            logAPI(req.method, req.path, 200, startTime, true);
            return res.status(200).json({ channels: channels });
        } catch (error) {
            logAPI(req.method, req.path, 500, startTime, false, error);
            return res.status(500).json({
                message: "Erreur lors de la récupération des canaux privés.",
            });
        }
    },
};
