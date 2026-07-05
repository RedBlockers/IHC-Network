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
            const { limit = 50, offset = 0 } = req.query;

            if (
                !(await guildModel.doGuildExists(guildId)) ||
                !(await guildModel.isChannelInGuild(guildId, channelId))
            ) {
                logAPI(
                    req.method,
                    req.path,
                    404,
                    startTime,
                    false,
                    "Guild ou channel non trouvé"
                );
                return res
                    .status(404)
                    .json({ message: "Guild ou channel non trouvé" });
            }

            const { messages, hasMoreMessages } =
                await messageModel.getMessagesByChannelId(
                    channelId,
                    guildId,
                    parseInt(limit),
                    parseInt(offset)
                );
            logAPI(req.method, req.path, 200, startTime, true);

            return res.status(200).json({
                messages,
                hasMoreMessages,
                limit: parseInt(limit),
                offset: parseInt(offset),
            });
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

            const result = await messageModel.insertMessage(
                req.user.userId,
                messageContent,
                channelId
            );
            if (!result) {
                throw new Error(`Erreur lors de l'enregistrement du messages`);
            }
            const newMessage = await messageModel.getMessageById(
                result.insertId
            );
            getIo().emit(`newMessage/${channelId}`, newMessage);
            logAPI(req.method, req.path, 200, startTime, true);
            res.status(200).json({
                newMessage,
            });
        } catch (err) {
            logAPI(req.method, req.path, 500, startTime, false, err.message);
            res.status(500).json({ error: "Erreur interne du serveur" });
        }
    },
    getPrivateMessages: async (req, res) => {
        const startTime = Date.now();
        try {
            const { channelId } = req.params;
            const { limit = 50, offset = 0 } = req.query;

            const { messages, hasMoreMessages } =
                await messageModel.getPrivateMessages(
                    channelId,
                    parseInt(limit),
                    parseInt(offset)
                );
            logAPI(req.method, req.path, 200, startTime, true);

            return res.status(200).json({
                messages,
                hasMoreMessages,
                limit: parseInt(limit),
                offset: parseInt(offset),
            });
        } catch (err) {
            logAPI(req.method, req.path, 500, startTime, false, err.message);
            return res.status(500).json({ error: "Erreur interne du serveur" });
        }
    },
};
