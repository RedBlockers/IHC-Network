const userModel = require("../models/userModel");
const guildModel = require("../models/guildModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");
const { saveImage } = require("../services/fileServices");
const socketIo = require("socket.io");
let io;

function CreateToken(username, userId, passwordUpdatedAt, profilePicture) {
    logger.info(`Création d'un token pour l'utilisateur n°${userId}`);
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
        logger.info(
            `Authentification du token pour l'utilisateur n°${decodedToken.userId}`
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
            logger.info(
                `Authentification du token réussi pour l'utilisateur n°${decodedToken.userId}`
            );
            return { valid: true, message: "Token Valide", decodedToken };
        } else {
            logger.warn(
                `échec de l'authentification du token pour l'utilisateur n°${decodedToken.userId}`
            );
            return {
                valid: false,
                message: "Le token est invalide, le mot de passe a été changé",
                decodedToken: null,
            };
        }
    } catch (err) {
        logger.error(
            `Erreur lors le l'authentification du token de l'utilisateur \n ${err}`
        );
        return {
            valid: false,
            message: "Token invalide ou expiré",
            decodedToken: null,
        };
    }
}

async function UpdateUsersFriendList(user1, user2) {
    let friends = await userModel.getFriends(user1.userId);
    io.emit(`user${user1.username}/updateFriendList`, friends);
    friends = await userModel.getFriends(user2.userId);
    io.emit(`user${user2.userNickname}/updateFriendList`, friends);
}

module.exports = {
    register: async (req, res) => {
        const { username, password, mail, profileImage } = req.body;
        let imagePath;
        try {
            // Vérifier si l'utilisateur existe déjà
            const existingUser = await userModel.getUserByUsername(username);
            if (existingUser.length > 0) {
                return res.json({
                    success: false,
                    message: "Cet utilisateur existe déjà.",
                });
            }
            const existingEmail = await userModel.getUserByMail(mail);
            if (existingEmail.length > 0) {
                return res.json({
                    success: false,
                    message: "Cet Email est déjà associer a un compte.",
                });
            }

            if (profileImage) {
                imagePath = await saveImage(profileImage, "profiles");
            } else {
                imagePath = "NoScord.jpg";
            }

            if (!imagePath) {
                return res.json({
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
                return res.json({
                    success: false,
                    message: "Erreur lors de l'inscription.",
                });
            }
            const token = CreateToken(
                username,
                resp.userId,
                resp.currentDateTime,
                imagePath
            );

            res.json({ success: true, token: token });
        } catch (error) {
            logger.error(
                "Erreur lors de la création de l'utilisateur:\n" + error
            );
            res.json({
                success: false,
                message: "Erreur lors de l'inscription.",
            });
        }
    },
    connect: async (req, res) => {
        try {
            const { username, password } = req.body;
            const users = await userModel.getUserByUsername(username);
            logger.info(`Connexion de l'utilisateur n°${users[0].userId}`);
            const userAttempts = await userModel.getUserAttempts(req.ip);
            userAttempts.length;
            if (userAttempts.length > 5) {
                return res.json({
                    success: false,
                    message:
                        "Votre compte a été bloquer suite a une activité suspecte, veuillez rééssayer ultérieurement ",
                });
            }
            if (!(await userModel.checkPassword(users, password)).success) {
                await userModel.addUserAttempt(req.ip);
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
            res.json({ success: true, token: token });
        } catch (error) {
            logger.error("Erreur lors de la connexion :\n" + error);
            res.json({
                success: false,
                message: "Erreur lors de la connexion.",
            });
        }
    },

    RequestFriend: async (req, res) => {
        try {
            const { token, username } = req.body;
            const { valid, message, decodedToken } =
                await AuthenticateAndDecodeToken(token);
            if (!valid) {
                return res.status(401).json({ success: false, message });
            }

            const user = await userModel.getUserByUsername(username);
            if (!user) {
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
                return res
                    .status(409)
                    .json({ success: false, message: resp.message });
            }
            await UpdateUsersFriendList(decodedToken, user[0]);
            return res.json({
                success: true,
                message: "Demande d'ami envoyée.",
            });
        } catch (error) {}
    },

    getFriends: async (req, res) => {
        try {
            const { token } = req.body;
            const { valid, message, decodedToken } =
                await AuthenticateAndDecodeToken(token);
            if (!valid) {
                return res.status(401).json({ success: false, message });
            }

            const friends = await userModel.getFriends(decodedToken.userId);
            if (!friends) {
                return res
                    .status(404)
                    .json({ success: false, message: "Aucun amis trouvé." });
            }

            return res.json({ success: true, friends: friends });
        } catch (error) {}
    },

    authenticateToken: async (req, res) => {
        const token = req.body.token;

        try {
            // Utiliser la fonction de vérification du token
            const { valid, message, decodedToken } =
                await AuthenticateAndDecodeToken(token);
            const user = await userModel.getUserById(decodedToken.userId);
            if (valid) {
                res.json({
                    success: true,
                    message,
                    userId: decodedToken.userId,
                    username: user.userNickname,
                    avatar: user.userImage,
                });
            } else {
                res.json({ success: false, message });
            }
        } catch (error) {
            logger.error(
                "Erreur lors de l'authentification du token :\n" + error
            );
            res.json({
                success: false,
                message: "Erreur lors de l'authentification du token.",
            });
        }
    },

    acceptFriend: async (req, res) => {
        try {
            const { token, friendId } = req.body;
            const { valid, message, decodedToken } =
                await AuthenticateAndDecodeToken(token);
            if (!valid) {
                return res.status(401).json({ success: false, message });
            }

            const resp = await userModel.acceptFriendRequest(
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
                message: "Demande d'ami acceptée.",
            });
        } catch (error) {
            logger.error(
                "Erreur lors de l'acceptation de la demande d'ami :\n" + error
            );
            res.json({
                success: false,
                message: "Erreur lors de l'acceptation de la demande d'ami.",
            });
        }
    },

    refuseFriend: async (req, res) => {
        try {
            const { token, friendId } = req.body;
            const { valid, message, decodedToken } =
                await AuthenticateAndDecodeToken(token);
            if (!valid) {
                return res.status(401).json({ success: false, message });
            }

            const resp = await userModel.refuseFriendRequest(
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
                message: "Demande d'ami refusée.",
            });
        } catch (error) {
            logger.error(
                "Erreur lors du refus de la demande d'ami :\n" + error.stack
            );
            res.json({
                success: false,
                message: "Erreur lors du refus de la demande d'ami.",
            });
        }
    },

    cancelFriendRequest: async (req, res) => {
        try {
            const { token, friendId } = req.body;
            const { valid, message, decodedToken } =
                await AuthenticateAndDecodeToken(token);
            if (!valid) {
                return res.status(401).json({ success: false, message });
            }

            const resp = await userModel.cancelFriendRequest(
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
                message: "Demande d'ami annulée.",
            });
        } catch (error) {
            logger.error(
                "Erreur lors de l'annulation de la demande d'ami :\n" +
                    error.stack
            );
            res.json({
                success: false,
                message: "Erreur lors de l'annulation de la demande d'ami.",
            });
        }
    },

    removeFriend: async (req, res) => {
        const { token, friendId } = req.body;
        const { valid, message, decodedToken } =
            await AuthenticateAndDecodeToken(token);
        if (!valid) {
            return res.status(401).json({ success: false, message });
        }
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

        res.json({ success: true, message: "amis supprimé" });
    },

    getUserInfo: async (req, res) => {
        const authHeader = req.headers["authorization"];

        if (!authHeader) {
            return res.status(401).json({ message: "Token manquant" });
        }
        const token = authHeader && authHeader.split(" ")[1];
        const { valid, message, decodedToken } =
            await AuthenticateAndDecodeToken(token);
        if (!valid) {
            return res.status(401).json({ message: "Token invalide" });
        }
        const reqUserId = req.query.userId;
        if (!reqUserId) {
            return res.status(400).json({ message: "userId manquant" });
        }
        try {
            const user = await userModel.getUserInfoById(
                decodedToken.userId,
                reqUserId
            );
            if (!user) {
                return res
                    .status(404)
                    .json({ message: "Utilisateur introuvable" });
            }
            return res.status(200).json(user);
        } catch (error) {
            logger.error(
                "Erreur lors de la récupération des informations de l'utilisateur :\n" +
                    error.stack
            );
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
    setIo: (socketIo) => {
        io = socketIo;
    },
};
