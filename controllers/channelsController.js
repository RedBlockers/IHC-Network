const channelModel = require("../models/channelModel");
const userController = require("./userController");
const guildModel = require("../models/guildModel");
const guildController = require("./guildController");
const logger = require("../utils/logger");
const { get } = require("../routes/userRoutes");
let io;

module.exports = {
    getChannelsByGuildId: async (req, res) => {
        const { guildId, token } = req.body;

        const { valid, message, decodedToken } =
            await userController.AuthenticateAndDecodeToken(token);
        if (!valid) {
            return res.status(401).json({ error: message });
        }

        const userGuilds = await guildModel.getGuildsByUser(
            decodedToken.userId
        );
        const guild = userGuilds.find((guild) => guild.guildId === guildId);

        if (!userGuilds.find((guild) => guild.guildId === guildId)) {
            return res
                .status(401)
                .json({ error: "You are not part of this guild" });
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

    // A faire : reidiriger l'utilisateur vers le premier salon de la guilde si aucun n'est trouvé

    createChannel: async (req, res) => {
        try {
            // Récupération des données depuis le corps de la requête
            const { type, name, description, guildId, token } = req.body;

            // Authentification et validation du token
            const { valid, message, decodedToken } =
                await userController.AuthenticateAndDecodeToken(token);
            if (!valid) {
                return res.status(401).json({ error: message });
            }

            // Récupération des guilds de l'utilisateur
            const userGuilds = await guildModel.getGuildsByUser(
                decodedToken.userId
            );
            const guild = userGuilds.find((guild) => guild.guildId === guildId);

            // Vérification de l'appartenance à la guilde
            if (!guild) {
                return res
                    .status(401)
                    .json({ error: "You are not part of this guild" });
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
            return res.status(200);
        } catch (err) {
            // Gestion des erreurs
            logger.error("Erreur dans createChannel:", err);

            // Retourner une erreur HTTP avec statut 500 (Erreur Interne du Serveur)
            return res
                .status(500)
                .json({
                    error: "An unexpected error occurred",
                    details: err.message,
                });
        }
    },

    getPrivateChannelsByUserId: async (req, res) => {
        const { token } = req.body;

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
