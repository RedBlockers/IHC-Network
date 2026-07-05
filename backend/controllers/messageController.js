const messageModel = require("../models/messageModel");
const { getIo } = require("../utils/sharedState");
const channelModel = require("../models/channelModel");
const guildModel = require("../models/guildModel");
const { logAPI } = require("../utils/helpers/logHelper");

module.exports = {
    getMessages: async (req, res) => {
        const startTime = Date.now();
        try {
            const { guildId, channelId } = req.params;
            const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
            const offset = Math.max(parseInt(req.query.offset) || 0, 0);

            if (!(await guildModel.isChannelInGuild(guildId, channelId))) {
                logAPI(req.method, req.path, 404, startTime, false, "Channel non trouvé dans cette guilde");
                return res.status(404).json({ message: "Channel non trouvé dans cette guilde" });
            }

            const { messages, hasMoreMessages } = await messageModel.getMessagesByChannelId(
                channelId,
                guildId,
                limit,
                offset
            );
            logAPI(req.method, req.path, 200, startTime, true);

            return res.status(200).json({ messages, hasMoreMessages, limit, offset });
        } catch (err) {
            logAPI(req.method, req.path, 500, startTime, false, err.message);
            return res.status(500).json({ error: "Erreur interne du serveur" });
        }
    },

    postMessage: async (req, res) => {
        const startTime = Date.now();
        try {
            const { messageContent } = req.body;
            const { channelId } = req.params;

            const channel = await channelModel.getChannelById(channelId);
            if (!channel) {
                logAPI(req.method, req.path, 404, startTime, false, `Channel ${channelId} non trouvé`);
                return res.status(404).json({ error: "Canal non trouvé" });
            }

            const result = await messageModel.insertMessage(req.user.userId, messageContent, channelId);
            if (!result) {
                throw new Error("Erreur lors de l'enregistrement du message");
            }
            const newMessage = await messageModel.getMessageById(result.insertId);
            getIo().emit(`newMessage/${channelId}`, newMessage);
            logAPI(req.method, req.path, 201, startTime, true);
            return res.status(201).json({ newMessage });
        } catch (err) {
            logAPI(req.method, req.path, 500, startTime, false, err.message);
            return res.status(500).json({ error: "Erreur interne du serveur" });
        }
    },

    getPrivateMessages: async (req, res) => {
        const startTime = Date.now();
        try {
            const { channelId } = req.params;
            const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
            const offset = Math.max(parseInt(req.query.offset) || 0, 0);

            const { messages, hasMoreMessages } = await messageModel.getPrivateMessages(
                channelId,
                limit,
                offset
            );
            logAPI(req.method, req.path, 200, startTime, true);

            return res.status(200).json({ messages, hasMoreMessages, limit, offset });
        } catch (err) {
            logAPI(req.method, req.path, 500, startTime, false, err.message);
            return res.status(500).json({ error: "Erreur interne du serveur" });
        }
    },
};
