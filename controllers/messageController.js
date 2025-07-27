const messageModel = require("../models/messageModel");
const channelController = require("./channelsController");
const { AuthenticateAndDecodeToken } = require("./userController");
const socketIo = require("socket.io");
const express = require("express");
const http = require("http");
const path = require("path");
const userRoutes = require("../routes/userRoutes");
const messageRoutes = require("../routes/messagesRoutes");
const logger = require("../utils/logger");
const userController = require("./userController");
const { getIo, connectedUsers } = require("../utils/sharedState");

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
            const { messageContent, channel } = req.body;
            const authHeader = req.headers["authorization"];
            if (!authHeader) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message: "Tentative d'ajout de message sans token",
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
                    message: "Tentative d'ajout de message sans token",
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 401,
                });
                return res.status(401).json({ message: "Token manquant" });
            }
            if (!channel || !messageContent) {
                logger.warn({
                    patrh: req.path,
                    method: req.method,
                    message:
                        "Tentative d'ajout de message sans channelId ou contenu",
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 400,
                });
                return res
                    .status(400)
                    .json({ error: "Le channelId ou le message est manquant" });
            }

            const { valid, message, decodedToken } =
                await AuthenticateAndDecodeToken(token);

            if (!valid) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    message:
                        "Tentative d'ajout de message avec un token invalide",
                    ip: req.ip,
                    duration: Date.now() - startTime,
                    status: 401,
                });
                return res.status(401).json({ error: message });
            }

            const result = await messageModel.insertMessage(
                decodedToken.userId,
                messageContent,
                channel
            );
            if (!result) {
                throw new Error(`Erreur lors de l'enregistrement du messages`);
            }
            const newMessage = await messageModel.getMessageById(
                result.insertId
            );
            getIo().emit(`newMessage/${channel}`, newMessage);
            logger.info({
                path: req.path,
                method: req.method,
                message: "Message ajouté avec succès",
                guildId: channel.guildId,
                channelId: channel.channelId,
                messageId: result.insertId,
                userId: decodedToken.userId,
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
