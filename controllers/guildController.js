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

module.exports = {
    getGuildsByUser: async (req, res) => {
        try {
            const authHeader = req.headers["authorization"];
            if (!authHeader) {
                return res.status(401).json({ message: "Token manquant" });
            }
            const token = authHeader && authHeader.split(" ")[1];
            if (!token) {
                return res.status(401).json({ message: "Token manquant" });
            }
            const { valid, message, decodedToken } =
                await AuthenticateAndDecodeToken(token);
            if (!valid) {
                return res.status(401).json({ error: message });
            }
            const guilds = await guildModel.getGuildsByUser(
                decodedToken.userId
            );
            return res.status(200).json(guilds);
        } catch (err) {
            logger.error(err);
            return res.status(500).json({ error: "Erreur interne du serveur" });
        }
    },

    getGuildById: async (guildId) => {
        try {
            const guild = await guildModel.getGuildById(guildId);
            return guild;
        } catch (err) {
            logger.error(err);
            return false;
        }
    },

    createGuild: async (req, res) => {
        try {
            const authHeader = req.headers["authorization"];
            if (!authHeader) {
                return res.status(401).json({ message: "Token manquant" });
            }
            const token = authHeader && authHeader.split(" ")[1];
            if (!token) {
                return res.status(401).json({ message: "Token manquant" });
            }
            const { guildName, guildDescription, guildImage } = req.body;
            if (!guildName || !guildDescription || !guildImage) {
                return res.status(400).json({
                    error: "Nom, description et image de la guilde requis",
                });
            }
            const { valid, message, decodedToken } =
                await AuthenticateAndDecodeToken(token);
            if (!valid) {
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
            return res.status(201).json({
                success: "Guild created successfully",
                guild: guild.insertId,
            });
        } catch (err) {
            logger.error(err);
            return res.status(500).json({ error: "Erreur interne du serveur" });
        }
    },

    createInvite: async (req, res) => {
        try {
            const authHeader = req.headers["authorization"];
            if (!authHeader) {
                return res.status(401).json({ message: "Token manquant" });
            }
            const token = authHeader && authHeader.split(" ")[1];
            if (!token) {
                return res.status(401).json({ message: "Token manquant" });
            }

            const { guildId } = req.body;

            if (!guildId) {
                return res.status(400).json({ error: "Guild ID manquant" });
            }

            const { valid, message, decodedToken } =
                await AuthenticateAndDecodeToken(token);
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

            const UUID = crypto.randomUUID();
            const invite = await guildModel.CreateInvite(
                decodedToken.userId,
                guildId,
                UUID
            );
            return res.status(201).json(UUID);
        } catch (err) {
            logger.error(err);
            return res.status(500).json({ error: "Erreur interne du serveur" });
        }
    },

    inviteByCode: async (req, res) => {
        try {
            const authHeader = req.headers["authorization"];
            if (!authHeader) {
                return res.status(401).json({ message: "Token manquant" });
            }
            const token = authHeader && authHeader.split(" ")[1];
            if (!token) {
                return res.status(401).json({ message: "Token manquant" });
            }

            const inviteCode = req.query.inviteCode;
            if (!inviteCode) {
                return res.status(400).json({ error: "Invite code manquant" });
            }

            const { valid, message, decodedToken } =
                await AuthenticateAndDecodeToken(token);
            if (!valid) {
                return res.status(401).json({ error: message });
            }
            const invite = await guildModel.getGuildByInviteCode(inviteCode);
            if (!invite) {
                return res.status(404).json({ error: "Invitation invalide" });
            }
            await userModel.AddUserInvite(invite, decodedToken.userId);
            const result = await userModel.JoinGuild(
                decodedToken.userId,
                invite.guildId
            );
            if (!result.success) {
                return res
                    .status(409)
                    .json({ error: "Vous avez déjà rejoint ce serveur" });
            }

            return res.status(200).json(invite);
        } catch (err) {
            logger.error(err.stack);
            return res.status(500).json({ error: "Erreur interne du serveur" });
        }
    },
};
