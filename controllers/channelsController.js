const channelModel = require("../models/channelModel");
const userController = require("./userController");
const guildModel = require("../models/guildModel");
const guildController = require("./guildController");
const logger = require("../utils/logger");
const { get } = require("../routes/userRoutes");
const isUserInGuild = require("./userController").isUserInGuild;
let io;

module.exports = {
    getChannelsByGuildId: async (req, res) => {
        //const { guildId, token } = req.body;

        const authHeader = req.headers["authorization"];
        if (!authHeader) {
            return res.status(401).json({ message: "Token manquant" });
        }
        const token = authHeader && authHeader.split(" ")[1];
        const guildId = req.query.guildId;
        if (!guildId) {
            return res.status(400).json({ error: "Guild ID is required" });
        }

        const { valid, message, decodedToken } =
            await userController.AuthenticateAndDecodeToken(token);
        if (!valid) {
            return res.status(401).json({ error: message });
        }

        // Vérification de l'appartenance à la guilde

        const { userInGuild, guild } = await isUserInGuild(
            guildId,
            decodedToken.userId
        );

        if (userInGuild == false || !guild) {
            return res.status(404).json({
                error: "Vous n'êtes pas sur le serveur ou il n'existe pas",
            });
        }

        const channels = await channelModel.getChannelsByGuild(guild);
        return res.status(200).json(channels);
    },

    getFirstChannelByGuildId: async (guildId) => {
        const guild = await guildController.getGuildById(guildId);
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
        try {
            // Récupération des données depuis le corps de la requête
            const { type, name, description, guildId } = req.body;

            const authHeader = req.headers["authorization"];
            if (!authHeader) {
                return res.status(401).json({ message: "Token manquant" });
            }
            const token = authHeader && authHeader.split(" ")[1];
            if (!token) {
                return res.status(401).json({ message: "Token manquant" });
            }
            if (!type || !name || !description || !guildId) {
                return res.status(400).json({ error: "Missing parameters" });
            }

            // Authentification et validation du token
            const { valid, message, decodedToken } =
                await userController.AuthenticateAndDecodeToken(token);
            if (!valid) {
                return res.status(401).json({ error: message });
            }

            // Vérification de l'appartenance à la guilde

            const { userInGuild, guild } = await isUserInGuild(
                guildId,
                decodedToken.userId
            );

            if (userInGuild == false || !guild) {
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
            return res.status(201).json({
                success: true,
                message: "Channel created successfully",
                data: channel,
            });
        } catch (err) {
            // Gestion des erreurs
            logger.error("Erreur dans createChannel:", err);

            // Retourner une erreur HTTP avec statut 500 (Erreur Interne du Serveur)
            return res.status(500).json({
                error: "An unexpected error occurred",
                details: err.message,
            });
        }
    },

    getPrivateChannelsByUserId: async (req, res) => {
        const authHeader = req.headers["authorization"];
        if (!authHeader) {
            return res.status(401).json({ message: "Token manquant" });
        }
        const token = authHeader && authHeader.split(" ")[1];
        if (!token) {
            return res.status(401).json({ message: "Token manquant" });
        }

        const { valid, message, decodedToken } =
            await userController.AuthenticateAndDecodeToken(token);
        if (!valid) {
            return res.status(401).json({ error: message });
        }
        const channels = await channelModel.getPrivateChannelsByUserId(
            decodedToken.userId
        );
        return res.status(200).json(channels);
    },

    setIo: (socketIo) => {
        io = socketIo;
    },
};
