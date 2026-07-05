const guildModel = require("../models/guildModel");
const { saveGuildIcon } = require("../services/fileServices");
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
                logAPI(req.method, req.path, 404, startTime, false, `Guilde ${guildId} non trouvée`);
                return res.status(404).json({ error: "Guilde non trouvée" });
            }

            const channel = await channelModel.getFirstChannelByGuildId(guildId);
            logAPI(req.method, req.path, 200, startTime, true);
            return res.status(200).json(channel);
        } catch (err) {
            logAPI(req.method, req.path, 500, startTime, false, err);
            return res.status(500).json({ error: "Erreur interne du serveur" });
        }
    },

    getGuildsByUser: async (req, res) => {
        const startTime = Date.now();
        try {
            const userId = req.user.userId;
            const guilds = await guildModel.getGuildsByUser(userId);
            logAPI(req.method, req.path, 200, startTime, true);
            return res.status(200).json(guilds.map((guild) => mappers.guildMapper(guild)));
        } catch (err) {
            logAPI(req.method, req.path, 500, startTime, false, err);
            return res.status(500).json({ error: "Erreur interne du serveur" });
        }
    },

    getGuildById: async (req, res) => {
        const startTime = Date.now();
        try {
            const { guildId } = req.params;

            const guild = await guildModel.getGuildById(guildId);

            if (!guild) {
                logAPI(req.method, req.path, 404, startTime, false, `Guilde ${guildId} non trouvée`);
                return res.status(404).json({ error: "Guilde non trouvée" });
            }

            const [users, channels] = await Promise.all([
                userModel.getUsersByGuildId(guildId),
                channelModel.getChannelsByGuildId(guildId),
            ]);
            const guildMapped = mappers.guildMapper(guild);
            guildMapped.members = users.map((user) => mappers.userPublicMapper(user));
            guildMapped.channels = channels.map((channel) => mappers.channelMapper(channel, guildId));

            logAPI(req.method, req.path, 200, startTime, true);
            return res.status(200).json(guildMapped);
        } catch (err) {
            logAPI(req.method, req.path, 500, startTime, false, err);
            return res.status(500).json({ error: "Erreur interne du serveur" });
        }
    },

    createGuild: async (req, res) => {
        const startTime = Date.now();
        try {
            const { guildName, guildDescription } = req.body;
            const file = req.file;

            let guildImage = null;
            if (file) {
                guildImage = await saveGuildIcon(file);
                if (!guildImage) {
                    logAPI(req.method, req.path, 503, startTime, false, "Échec de l'upload de l'icône sur S3");
                    return res.status(503).json({ error: "Le service de stockage est temporairement indisponible." });
                }
            }

            const guild = await guildModel.createGuild(guildName, guildImage, guildDescription, req.user.userId);

            await channelModel.createChannel("text", "general", "Salon général", guild.guildId);
            logAPI(req.method, req.path, 201, startTime, true);
            return res.status(201).json({ success: "Guild created successfully", guildId: guild.guildId });
        } catch (err) {
            logAPI(req.method, req.path, 500, startTime, false, err);
            return res.status(500).json({ error: "Erreur interne du serveur" });
        }
    },

    createInvite: async (req, res) => {
        const startTime = Date.now();
        try {
            const { guildId } = req.params;
            const UUID = crypto.randomUUID();
            await guildModel.CreateInvite(req.user.userId, guildId, UUID);
            logAPI(req.method, req.path, 201, startTime, true);
            return res.status(201).json({ inviteCode: UUID });
        } catch (err) {
            logAPI(req.method, req.path, 500, startTime, false, err);
            return res.status(500).json({ error: "Erreur interne du serveur" });
        }
    },

    inviteByCode: async (req, res) => {
        const startTime = Date.now();
        try {
            const { inviteCode } = req.params;
            const invite = await guildModel.getInvite(inviteCode);
            if (!invite) {
                logAPI(req.method, req.path, 404, startTime, false, `Invitation ${inviteCode} invalide`);
                return res.status(404).json({ error: "Invitation invalide" });
            }

            const guildId = invite.guild;

            if (await guildModel.isUserInGuild(req.user.userId, guildId)) {
                return res.status(409).json({ error: "Vous êtes déjà membre de cette guilde." });
            }

            await userModel.AddUserInvite(invite, req.user.userId);
            await userModel.JoinGuild(req.user.userId, guildId);

            const userSocketId = connectedUsers.get(String(req.user.userId));
            if (userSocketId) getIo().to(userSocketId).emit("requestRefresh");

            const [members, guildData] = await Promise.all([
                userModel.getUsersByGuildId(guildId),
                guildModel.getGuildById(guildId),
            ]);

            if (guildData?.ownerId) {
                emitToUser(guildData.ownerId, `guildJoined/${guildId}`, {});
            }
            members.forEach((member) => {
                emitToUser(member.userId, `guildJoined/${guildId}`, {});
            });

            logAPI(req.method, req.path, 200, startTime, true);
            return res.status(200).json({ guildId });
        } catch (err) {
            logAPI(req.method, req.path, 500, startTime, false, err);
            return res.status(500).json({ error: "Erreur interne du serveur" });
        }
    },
};
