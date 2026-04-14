const messageModel = require("../models/messageModel");
const channelController = require("./channelController");
const { AuthenticateAndDecodeToken } = require("./userController");
const logger = require("../utils/logger");
const userController = require("./userController");
const { getIo } = require("../utils/sharedState");
const channelModel = require("../models/channelModel");

module.exports = {
    getMessages: async (req, res) => {
        const startTime = Date.now();
        try {
            const { guildId, channelId } = req.params;
            const { limit = 50, offset = 0 } = req.query;

            const authHeader = req.headers["authorization"];
            if (!authHeader) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message:
                        "Tentative de récupération des messages sans token",
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
                    message:
                        "Tentative de récupération des messages sans token",
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 401,
                });
                return res.status(401).json({ message: "Token manquant" });
            }
            if (!guildId || !channelId) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message:
                        "Tentative de récupération des messages sans guildId ou channelId",
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 400,
                });
                return res.status(400).json({
                    error: "Le guildId ou le channelId est manquant",
                });
            }

            const { valid, message, decodedToken } =
                await userController.AuthenticateAndDecodeToken(token);
            if (!valid) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: "Token invalide ou expiré",
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 401,
                });

                return res.status(401).json({ error: message });
            }

            if (
                !(await channelController.isChannelInGuild(guildId, channelId))
            ) {
                const firstChannel =
                    await channelController.getFirstChannelByGuildId(guildId);

                logger.info({
                    path: req.path,
                    method: req.method,
                    message: `Redirection vers le premier channel de la guilde`,
                    guildId: guildId,
                    channelId: firstChannel.channelId,
                    userId: decodedToken.userId,
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 200,
                });
                return res.status(200).json({
                    redirect: true,
                    url: `/${guildId}/${firstChannel.channelId}`,
                });
            }

            const { messages, hasMoreMessages } =
                await messageModel.getMessagesByChannelId(
                    channelId,
                    guildId,
                    parseInt(limit),
                    parseInt(offset)
                );
            logger.info({
                path: req.path,
                method: req.method,
                message: `Messages récupérés pour le channel`,
                guildId: guildId,
                channelId: channelId,
                limit: limit,
                offset: offset,
                count: messages.length,
                userId: decodedToken.userId,
                ip: req.ip,
                duration: Date.now() - startTime,
                status: 200,
            });

            return res.status(200).json({
                messages,
                hasMoreMessages,
                limit: parseInt(limit),
                offset: parseInt(offset),
            });
        } catch (err) {
            logger.error({
                path: req.path,
                method: req.method,
                message: "Erreur lors de la récupération des messages",
                err: err.stack,
                ip: req.ip,
                duration: Date.now() - startTime,
                status: 500,
            });
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
            logger.info({
                path: req.path,
                method: req.method,
                message: "Message ajouté avec succès",
                guildId: channel.guildId,
                channelId: channel.channelId,
                messageId: result.insertId,
                userId: req.user.userId,
                ip: req.ip,
                duration: Date.now() - startTime,
                status: 200,
            });
            res.status(200).json({
                success: true,
                message: "Message ajouté avec succès",
                data: newMessage,
            });
        } catch (err) {
            logger.error({
                path: req.path,
                method: req.method,
                message: "Erreur lors de l'ajout du message",
                err: err.stack,
                ip: req.ip,
                duration: Date.now() - startTime,
                status: 500,
            });
            res.status(500).json({ error: "Erreur interne du serveur" });
        }
    },
    getPrivateMessages: async (req, res) => {
        const startTime = Date.now();
        try {
            const { channelId } = req.params;
            const { limit = 50, offset = 0 } = req.query;
            const authHeader = req.headers["authorization"];
            if (!authHeader) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message:
                        "Tentative de récupération des messages privés sans token",
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
                    message:
                        "Tentative de récupération des messages privés sans token",
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
                        "Tentative de récupération des messages privés avec un token invalide",
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 401,
                });

                return res.status(401).json({ error: message });
            }

            if (!channelId) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message:
                        "Tentative de récupération des messages privés sans channelId",
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 400,
                });

                return res
                    .status(400)
                    .json({ error: "Le channelId est manquant" });
            }

            const { messages, hasMoreMessages } =
                await messageModel.getPrivateMessages(
                    channelId,
                    parseInt(limit),
                    parseInt(offset)
                );
            logger.info({
                path: req.path,
                method: req.method,
                message: "Messages privés récupérés avec succès",
                channelId: channelId,
                limit: limit,
                offset: offset,
                count: messages.length,
                userId: decodedToken.userId,
                ip: req.ip,
                duration: Date.now() - startTime,
                status: 200,
            });

            return res.status(200).json({
                messages,
                hasMoreMessages,
                limit: parseInt(limit),
                offset: parseInt(offset),
            });
        } catch (err) {
            logger.error({
                path: req.path,
                method: req.method,
                message: "Erreur lors de la récupération des messages privés",
                err: err.stack,
                ip: req.ip,
                duration: Date.now() - startTime,
                status: 500,
            });
            return res.status(500).json({ error: "Erreur interne du serveur" });
        }
    },
};
