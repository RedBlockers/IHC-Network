const guildModel = require("../models/guildModel");
const { AuthenticateAndDecodeToken } = require("./userController");
const logger = require("../utils/logger");
const { saveImage } = require("../services/fileServices");
const channelModel = require("../models/channelModel");
const { get } = require("../routes/userRoutes");
const crypto = require("crypto");
const userModel = require("../models/userModel");

module.exports = {
    getGuildsByUser: async (req, res) => {
        try {
            const token = req.body.token;
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
            const { token, guildName, guildDescription, guildImage } = req.body;
            guildName, guildDescription;
            const { valid, message, decodedToken } =
                await AuthenticateAndDecodeToken(token);
            if (!valid) {
                return res.status(401).json({ error: message });
            }
            const imagePath = await saveImage(guildImage, "guilds");
            guild = await guildModel.createGuild(
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
            return res
                .status(200)
                .json({ success: "Guild created successfully" });
        } catch (err) {
            logger.error(err);
            return res.status(500).json({ error: "Erreur interne du serveur" });
        }
    },

    createInvite: async (req, res) => {
        try {
            const { token, guildId } = req.body;
            const { valid, message, decodedToken } =
                await AuthenticateAndDecodeToken(token);
            if (!valid) {
                return res.status(401).json({ error: message });
            }
            const UUID = crypto.randomUUID();
            const invite = await guildModel.CreateInvite(
                decodedToken.userId,
                guildId,
                UUID
            );
            return res.status(200).json(UUID);
        } catch (err) {
            logger.error(err);
            return res.status(500).json({ error: "Erreur interne du serveur" });
        }
    },

    inviteByCode: async (req, res) => {
        try {
            const { token, inviteCode } = req.body;

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
                    .status(400)
                    .json({ error: "Vous avez déjà rejoint ce serveur" });
            }

            return res.status(200).json(invite);
        } catch (err) {
            logger.error(err.stack);
            return res.status(500).json({ error: "Erreur interne du serveur" });
        }
    },
};
