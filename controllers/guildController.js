const guildModel = require("../models/guildModel");
const logger = require("../utils/logger");
const { saveImage } = require("../services/fileServices");
const channelModel = require("../models/channelModel");
const crypto = require("crypto");
const userModel = require("../models/userModel");
const { getIo, connectedUsers } = require("../utils/sharedState");
const { emitToUser } = require("../utils/socketUtils");
const { logAPI } = require("../utils/helpers/logHelper");
const mappers = require("../utils/mappers");

module.exports = {
    getDefaultChannel: async (req, res) => {
        const startTime = Date.now();
        try {
            const { guildId } = req.params;

            if (!(await guildModel.doGuildExists(guildId))) {
                logAPI(
                    req.method,
                    req.path,
                    startTime,
                    false,
                    `Guilde ${guildId} non trouvée`
                );
                return res.status(404).json({ error: "Guilde non trouvée" });
            }

            const channel =
                await channelModel.getFirstChannelByGuildId(guildId);
            logAPI(req.method, req.path, startTime, true);
            return res.status(200).json(channel);
        } catch (err) {
            logger.error(req.method, req.path, startTime, false, err);
            return res.status(500).json({ error: "Erreur interne du serveur" });
        }
    },

    getGuildsByUser: async (req, res) => {
        const startTime = Date.now();
        try {
            const userId = req.user.userId;
            const guilds = await guildModel.getGuildsByUser(userId);
            logAPI(req.method, req.path, startTime, true);

            return res
                .status(200)
                .json(guilds.map((guild) => mappers.guildMapper(guild)));
        } catch (err) {
            logger.error(req.method, req.path, startTime, false, err);
            return res.status(500).json({ error: "Erreur interne du serveur" });
        }
    },

    getGuildById: async (req, res) => {
        const startTime = Date.now();
        try {
            const { guildId } = req.params;

            const guild = await guildModel.getGuildById(guildId);

            if (!guild) {
                logAPI(
                    req.method,
                    req.path,
                    startTime,
                    false,
                    `Guilde ${guildId} non trouvée`
                );
                return res.status(404).json({ error: "Guilde non trouvée" });
            }

            //On lance les deux requêtes en parallèle
            const [users, channels] = await Promise.all([
                userModel.getUsersByGuildId(guildId),
                channelModel.getChannelsByGuildId(guildId),
            ]);
            const guildMapped = mappers.guildMapper(guild);
            console.log(guildMapped);
            guildMapped.members = users.map((user) =>
                mappers.userPublicMapper(user)
            );
            guildMapped.channels = channels.map((channel) =>
                mappers.channelMapper(channel, guildId)
            );

            logAPI(req.method, req.path, startTime, true);
            return res.status(200).json(guildMapped);
        } catch (err) {
            logAPI(req.method, req.path, startTime, false, err);
            return res.status(500).json({ error: "Erreur interne du serveur" });
        }
    },

    createGuild: async (req, res) => {
        const startTime = Date.now();
        try {
            const { guildName, guildDescription, guildImage } = req.body;

            console.log(guildName, guildDescription, guildImage);
            if (guildImage != "NoScord.jpg") {
                guildImage = await saveImage(guildImage, "guilds");
            }

            const guild = await guildModel.createGuild(
                guildName,
                guildImage,
                guildDescription,
                req.user.userId
            );

            await channelModel.createChannel(
                "text",
                "general",
                "Salon général",
                guild.guildId
            );
            logAPI(req.method, req.path, startTime, true);
            return res.status(201).json({
                success: "Guild created successfully",
                guildId: guild.guildId,
            });
        } catch (err) {
            logger.error(req.method, req.path, startTime, false, err.message);
            return res.status(500).json({ error: "Erreur interne du serveur" });
        }
    },

    createInvite: async (req, res) => {
        const startTime = Date.now();
        try {
            const { guildId } = req.params;

            const UUID = crypto.randomUUID();
            const invite = await guildModel.CreateInvite(
                req.user.userId,
                guildId,
                UUID
            );

            logAPI(req.method, req.path, startTime, true);
            return res.status(201).json(UUID);
        } catch (err) {
            logger.error(req.method, req.path, startTime, false, err);
            return res.status(500).json({ error: "Erreur interne du serveur" });
        }
    },

    inviteByCode: async (req, res) => {
        const startTime = Date.now();
        try {
            const { inviteCode } = req.params;
            const invite = await guildModel.getGuildByInviteCode(inviteCode);
            if (!invite) {
                logAPI(
                    req.method,
                    req.path,
                    startTime,
                    false,
                    `Invitation ${inviteCode} invalide`
                );
                return res.status(404).json({ error: "Invitation invalide" });
            }

            await userModel.AddUserInvite(invite, req.user.userId);
            const result = await userModel.JoinGuild(
                req.user.userId,
                invite.guildId
            );

            const userSocketId = connectedUsers.get(String(req.user.userId));
            getIo().to(userSocketId).emit("requestRefresh");
            const members = await userModel.getUsersByGuildId(invite.guildId);
            emitToUser(guild.owner.userId, `guildJoined/${invite.guildId}`, {});
            members.forEach((member) => {
                emitToUser(member.userId, `guildJoined/${invite.guildId}`, {});
            });

            logAPI(req.method, req.path, startTime, true);
            return res.status(200).json(invite);
        } catch (err) {
            logger.error(req.method, req.path, startTime, false, err);
            return res.status(500).json({ error: "Erreur interne du serveur" });
        }
    },
};
