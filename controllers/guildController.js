const guildModel = require("../models/guildModel");
const isUserInGuild = require("./userController").isUserInGuild;
const { AuthenticateAndDecodeToken } = require("./userController");
const logger = require("../utils/logger");
const { saveImage } = require("../services/fileServices");
const channelModel = require("../models/channelModel");
const { get } = require("../routes/userRoutes");
const crypto = require("crypto");
const userModel = require("../models/userModel");
const { channel } = require("diagnostics_channel");
const path = require("path");

module.exports = {
    getGuildsByUser: async (req, res) => {
        const startTime = Date.now();
        try {
            const authHeader = req.headers["authorization"];
            if (!authHeader) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: "Tentative de récupération des guildes sans token",
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
                    message: "Tentative de récupération des guildes sans token",
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
                        "Token invalide lors de la récupération des guildes",
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 401,
                });
                return res.status(401).json({ error: message });
            }
            const guilds = await guildModel.getGuildsByUser(
                decodedToken.userId
            );
            logger.info({
                path: req.path,
                method: req.method,
                message: "Récupération des guildes réussie",
                userId: decodedToken.userId,
                ip: req.ip,
                duration: Date.now() - startTime,
                status: 200,
            });
            return res.status(200).json(guilds);
        } catch (err) {
            logger.error({
                path: req.path,
                method: req.method,
                message: "Erreur lors de la récupération des guildes",
                err: err.stack,
                ip: req.ip,
                duration: Date.now() - startTime,
                status: 500,
            });
            return res.status(500).json({ error: "Erreur interne du serveur" });
        }
    },

    getGuildById: async (req, res) => {
        const startTime = Date.now();
        try {
            const authHeader = req.headers["authorization"];
            if (!authHeader) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: "Tentative de récupération de guilde sans token",
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
                    message: "Tentative de récupération de guilde sans token",
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 401,
                });
                return res.status(401).json({ message: "Token manquant" });
            }
            const { guildId } = req.query;
            if (!guildId) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: "Tentative de récupération de guilde sans guildId",
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 400,
                });
                return res.status(400).json({ error: "Guild ID manquant" });
            }
            const { valid, message, decodedToken } =
                await AuthenticateAndDecodeToken(token);
            if (!valid) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: "Token invalide lors de la récupération de guilde",
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 401,
                });
                return res.status(401).json({ error: message });
            }
            const { userInGuild, guild } = await isUserInGuild(
                guildId,
                decodedToken.userId
            );
            if (userInGuild == false || !guild) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message:
                        "Utilisateur non membre de la guilde ou guilde inexistante",
                    userId: decodedToken.userId,
                    guildId: guildId,
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 404,
                });
                return res.status(404).json({
                    error: "Vous n'êtes pas sur le serveur ou il n'existe pas",
                });
            }
            const guildData = await guildModel.getGuildById(guildId);
            logger.info({
                path: req.path,
                method: req.method,
                message: "Récupération de la guilde réussie",
                guildId: guildId,
                userId: decodedToken.userId,
                ip: req.ip,
                duration: Date.now() - startTime,
                status: 200,
            });
            return res.status(200).json(guildData);
        } catch (err) {
            logger.error({
                path: req.path,
                method: req.method,
                message: "Erreur lors de la récupération de la guilde",
                err: err.stack,
                ip: req.ip,
                duration: Date.now() - startTime,
                status: 500,
            });
            return res.status(500).json({ error: "Erreur interne du serveur" });
        }
    },

    createGuild: async (req, res) => {
        const startTime = Date.now();
        try {
            const authHeader = req.headers["authorization"];
            if (!authHeader) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: "Tentative de création de guilde sans token",
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
                    message: "Tentative de création de guilde sans token",
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 401,
                });
                return res.status(401).json({ message: "Token manquant" });
            }
            const { guildName, guildDescription, guildImage } = req.body;
            if (!guildName || !guildDescription || !guildImage) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message:
                        "Tentative de création de guilde sans informations requises",
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 400,
                });
                return res.status(400).json({
                    error: "Nom, description et image de la guilde requis",
                });
            }
            const { valid, message, decodedToken } =
                await AuthenticateAndDecodeToken(token);
            if (!valid) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: "Token invalide lors de la création de guilde",
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 401,
                });

                return res.status(401).json({ error: message });
            }
            const imagePath = await saveImage(guildImage, "guilds");
            const guild = await guildModel.createGuild(
                guildName,
                imagePath,
                guildDescription,
                decodedToken.userId
            );
            await channelModel.createChannel(
                "text",
                "general",
                "Salon général",
                guild.insertId
            );
            logger.info({
                path: req.path,
                method: req.method,
                message: "Guilde créée avec succès",
                guildId: guild.insertId,
                userId: decodedToken.userId,
                ip: req.ip,
                duration: Date.now() - startTime,
                status: 201,
            });
            return res.status(201).json({
                success: "Guild created successfully",
                guild: guild.insertId,
            });
        } catch (err) {
            logger.error({
                path: req.path,
                method: req.method,
                message: "Erreur lors de la création de la guilde",
                err: err.stack,
                ip: req.ip,
                duration: Date.now() - startTime,
                status: 500,
            });
            return res.status(500).json({ error: "Erreur interne du serveur" });
        }
    },

    createInvite: async (req, res) => {
        const startTime = Date.now();
        try {
            const authHeader = req.headers["authorization"];
            if (!authHeader) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: "Tentative de création d'invitation sans token",
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
                    message: "Tentative de création d'invitation sans token",
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 401,
                });
                return res.status(401).json({ message: "Token manquant" });
            }

            const { guildId } = req.body;

            if (!guildId) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: "Tentative de création d'invitation sans guildId",
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 400,
                });
                return res.status(400).json({ error: "Guild ID manquant" });
            }

            const { valid, message, decodedToken } =
                await AuthenticateAndDecodeToken(token);
            if (!valid) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: "Token invalide lors de la création d'invitation",
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 401,
                });

                return res.status(401).json({ error: message });
            }

            // Vérification de l'appartenance à la guilde
            const { userInGuild, guild } = await isUserInGuild(
                guildId,
                decodedToken.userId
            );
            if (userInGuild == false || !guild) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message:
                        "Utilisateur non membre de la guilde ou guilde inexistante",
                    userId: decodedToken.userId,
                    guildId: guildId,
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 404,
                });
                return res.status(404).json({
                    error: "Vous n'êtes pas sur le serveur ou il n'existe pas",
                });
            }

            const UUID = crypto.randomUUID();
            const invite = await guildModel.CreateInvite(
                decodedToken.userId,
                guildId,
                UUID
            );

            logger.info({
                path: req.path,
                method: req.method,
                message: "Invitation créée avec succès",
                inviteCode: UUID,
                guildId: guildId,
                userId: decodedToken.userId,
                ip: req.ip,
                duration: Date.now() - startTime,
                status: 201,
            });
            return res.status(201).json(UUID);
        } catch (err) {
            logger.error({
                path: req.path,
                method: req.method,
                message: "Erreur lors de la création de l'invitation",
                err: err.stack,
                ip: req.ip,
                duration: Date.now() - startTime,
                status: 500,
            });
            return res.status(500).json({ error: "Erreur interne du serveur" });
        }
    },

    inviteByCode: async (req, res) => {
        const startTime = Date.now();
        try {
            const authHeader = req.headers["authorization"];
            if (!authHeader) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: "Tentative d'invitation sans token",
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
                    message: "Tentative d'invitation sans token",
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 401,
                });
                return res.status(401).json({ message: "Token manquant" });
            }

            const inviteCode = req.query.inviteCode;
            if (!inviteCode) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: "Tentative d'invitation sans code d'invitation",
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 400,
                });
                return res.status(400).json({ error: "Invite code manquant" });
            }

            const { valid, message, decodedToken } =
                await AuthenticateAndDecodeToken(token);
            if (!valid) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: "Token invalide lors de l'invitation par code",
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 401,
                });
                return res.status(401).json({ error: message });
            }
            const invite = await guildModel.getGuildByInviteCode(inviteCode);
            if (!invite) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: "Invitation invalide",
                    userId: decodedToken.userId,
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 404,
                });
                return res.status(404).json({ error: "Invitation invalide" });
            }
            await userModel.AddUserInvite(invite, decodedToken.userId);
            const result = await userModel.JoinGuild(
                decodedToken.userId,
                invite.guildId
            );
            if (!result.success) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: "L'utilisateur a déjà rejoint ce serveur",
                    userId: decodedToken.userId,
                    guildId: invite.guildId,
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 409,
                });
                return res
                    .status(409)
                    .json({ error: "Vous avez déjà rejoint ce serveur" });
            }

            logger.info({
                path: req.path,
                method: req.method,
                message: "Invitation acceptée avec succès",
                inviteCode: inviteCode,
                guildId: invite.guildId,
                userId: decodedToken.userId,
                ip: req.ip,
                duration: Date.now() - startTime,
                status: 200,
            });
            return res.status(200).json(invite);
        } catch (err) {
            logger.error({
                path: req.path,
                method: req.method,
                message: "Erreur lors de l'invitation par code",
                err: err.stack,
                ip: req.ip,
                duration: Date.now() - startTime,
                status: 500,
            });
            return res.status(500).json({ error: "Erreur interne du serveur" });
        }
    },
};
