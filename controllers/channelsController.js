const channelModel = require("../models/channelModel");
const userController = require("./userController");
const guildModel = require("../models/guildModel");
const logger = require("../utils/logger");
const { get } = require("../routes/userRoutes");
const isUserInGuild = require("./userController").isUserInGuild;
let io;

module.exports = {
    getChannelsByGuildId: async (req, res) => {
        const startTime = Date.now();
        const authHeader = req.headers["authorization"];
        if (!authHeader) {
            logger.warn({
                path: req.path,
                method: req.method,
                message: "Tentative d'accès aux canaux sans token",
                ip: req.ip,
                duration: Date.now() - startTime,
                status: 401,
            });
            return res.status(401).json({ message: "Token manquant" });
        }
        const token = authHeader && authHeader.split(" ")[1];
        const guildId = req.query.guildId;
        if (!guildId) {
            logger.warn({
                path: req.path,
                method: req.method,
                message: "Tentative d'accès aux canaux sans guildId",
                ip: req.ip,
                duration: Date.now() - startTime,
                status: 400,
            });
            return res.status(400).json({ error: "Guild ID is required" });
        }

        const { valid, message, decodedToken } =
            await userController.AuthenticateAndDecodeToken(token);
        if (!valid) {
            logger.warn({
                path: req.path,
                method: req.method,
                message: `Tentative d'accès aux canaux de la guilde ${guildId} par un utilisateur avec un token invalide.`,
                guildId: guildId,
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
                message: `L'utilisateur ${decodedToken.userId} a tenté d'accéder aux canaux de la guilde ${guildId} sans y être membre.`,
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

        const channels = await channelModel.getChannelsByGuild(guild);
        logger.info({
            path: req.path,
            method: req.method,
            message: `Récupération des canaux pour la guilde ${guildId} réussie.`,
            userId: decodedToken.userId,
            guildId: guildId,
            ip: req.ip,
            duration: Date.now() - startTime,
            status: 200,
        });
        return res.status(200).json(channels);
    },

    getFirstChannelByGuildId: async (guildId) => {
        const guild = await guildModel.getGuildById(guildId);
        const channel = await channelModel.getFirstChannelByGuild(guild);
        return channel;
    },

    isChannelInGuild: async (guildId, channelId) => {
        const guild = await guildModel.getGuildById(guildId);
        if (!guild || guild.length > 1) {
            throw new ReferenceError();
        }
        const channels = await channelModel.getChannelById(channelId, guild);

        if (!channels || channels === null) {
            return false;
        }
        return true;
    },

    createChannel: async (req, res) => {
        const startTime = Date.now();
        try {
            const authHeader = req.headers["authorization"];
            // Récupération des données depuis le corps de la requête
            const { type, name, description, guildId } = req.body;
            if (!authHeader) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: "Tentative de création de canal sans token",
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
                    message: "Tentative de création de canal sans token",
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 401,
                });
                return res.status(401).json({ message: "Token manquant" });
            }

            // Authentification et validation du token
            const { valid, message, decodedToken } =
                await userController.AuthenticateAndDecodeToken(token);
            if (!valid) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: `Tentative de création de canal par un utilisateur avec un token invalide.`,
                    guildId: guildId,
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 401,
                });
                return res.status(401).json({ error: message });
            }

            if (!type || !name || !description || !guildId) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message:
                        "Tentative de création de canal avec des paramètres manquants",
                    userId: decodedToken.userId,
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 400,
                });
                return res.status(400).json({ error: "Missing parameters" });
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
                    message: `Tentative de création de canal par un utilisateur non membre de la guilde`,
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

            // Création du canal
            const lastInsertId = await channelModel.createChannel(
                type,
                name,
                description,
                guildId
            );
            const channel = await channelModel.getChannelById(
                lastInsertId,
                guild
            );
            // Envoi de la réponse avec succès
            io.emit(`newChannel/${guild.guildId}`, channel);
            logger.info({
                path: req.path,
                method: req.method,
                message: `Canal créé avec succès dans la guilde`,
                userId: decodedToken.userId,
                guildId: guild.guildId,
                ip: req.ip,
                duration: Date.now() - startTime,
                status: 201,
            });
            return res.status(201).json({
                success: true,
                message: "Channel created successfully",
                data: channel,
            });
        } catch (err) {
            // Gestion des erreurs
            logger.error({
                path: req.path,
                method: req.method,
                message: `Erreur lors de la création du canal : ${err.message}`,
                err: err.stack,
                userId: req.userId || "unknown",
                guildId: req.body.guildId || "unknown",
                ip: req.ip,
                duration: Date.now() - startTime,
                status: 500,
            });
            // Retourner une erreur HTTP avec statut 500 (Erreur Interne du Serveur)
            return res.status(500).json({
                error: "An unexpected error occurred",
                details: err.message,
            });
        }
    },

    getPrivateChannelsByUserId: async (req, res) => {
        const startTime = Date.now();
        const authHeader = req.headers["authorization"];
        if (!authHeader) {
            logger.warn({
                path: req.path,
                method: req.method,
                message: "Tentative d'accès aux canaux privés sans token",
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
                message: "Tentative d'accès aux canaux privés sans token",
                ip: req.ip,
                duration: Date.now() - startTime,
                status: 401,
            });
            return res.status(401).json({ message: "Token manquant" });
        }

        const { valid, message, decodedToken } =
            await userController.AuthenticateAndDecodeToken(token);
        if (!valid) {
            logger.warn({
                path: req.path,
                method: req.method,
                message:
                    "Tentative d'accès aux canaux privés avec un token invalide",
                ip: req.ip,
                duration: Date.now() - startTime,
                status: 401,
            });
            return res.status(401).json({ error: message });
        }
        const channels = await channelModel.getPrivateChannelsByUserId(
            decodedToken.userId
        );
        logger.info({
            path: req.path,
            method: req.method,
            message: `Récupération des canaux privés pour l'utilisateur ${decodedToken.userId} réussie.`,
            userId: decodedToken.userId,
            ip: req.ip,
            duration: Date.now() - startTime,
            status: 200,
        });
        return res.status(200).json(channels);
    },

    setIo: (socketIo) => {
        io = socketIo;
    },
};
