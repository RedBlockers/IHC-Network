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
const { url } = require("inspector");
let io;

module.exports = {
    getMessages: async (req, res) => {
        try {
            const { guildId, channelId } = req.params;

            const authHeader = req.headers["authorization"];
            if (!authHeader) {
                return res.status(401).json({ message: "Token manquant" });
            }
            const token = authHeader && authHeader.split(" ")[1];
            if (!token) {
                return res.status(401).json({ message: "Token manquant" });
            }
            if (!guildId || !channelId) {
                return res.status(400).json({
                    error: "Le guildId ou le channelId est manquant",
                });
            }

            const { valid, message, decodedToken } =
                await userController.AuthenticateAndDecodeToken(token);
            if (!valid) {
                return res.status(401).json({ error: message });
            }

            if (!channelId) {
                return res
                    .status(400)
                    .json({ error: "Le channelId est manquant" });
            }

            if (
                !(await channelController.isChannelInGuild(guildId, channelId))
            ) {
                const firstChannel =
                    await channelController.getFirstChannelByGuildId(guildId);

                logger.info(
                    `Redirection de l'utilisateur vers le premier salon de la guilde n°${guildId}`
                );
                return res.status(200).json({
                    redirect: true,
                    url: `/${guildId}/${firstChannel.channelId}`,
                });
            }

            const messages = await messageModel.getMessagesByChannelId(
                channelId,
                guildId
            );
            return res.status(200).json(messages);
        } catch (err) {
            logger.error(
                "Erreur lors de la récupération des messages :" + err.stack
            );
            return res.status(500).json({ error: "Erreur interne du serveur" });
        }
    },

    postMessage: async (req, res) => {
        try {
            const { messageContent, channel } = req.body;
            const authHeader = req.headers["authorization"];
            if (!authHeader) {
                return res.status(401).json({ message: "Token manquant" });
            }
            const token = authHeader && authHeader.split(" ")[1];
            if (!token) {
                return res.status(401).json({ message: "Token manquant" });
            }
            if (!channel || !messageContent) {
                return res
                    .status(400)
                    .json({ error: "Le channelId ou le message est manquant" });
            }

            if (!messageContent) {
                return res
                    .status(400)
                    .json({ error: "Le contenu du message est manquant" });
            }

            const { valid, message, decodedToken } =
                await AuthenticateAndDecodeToken(token);

            if (!valid) {
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
            io.emit(`newMessage/${channel}`, newMessage);
            res.status(200).json({
                success: true,
                message: "Message ajouté avec succès",
                data: newMessage,
            });
        } catch (err) {
            logger.error("Erreur lors de l'ajout du message :", err);
            res.status(500).json({ error: "Erreur interne du serveur" });
        }
    },
    getPrivateMessages: async (req, res) => {
        try {
            const { channelId } = req.params;
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

            if (!channelId) {
                return res
                    .status(400)
                    .json({ error: "Le channelId est manquant" });
            }

            const messages = await messageModel.getPrivateMessages(channelId);
            return res.status(200).json(messages);
        } catch (err) {
            logger.error(
                "Erreur lors de la récupération des messages privés :" +
                    err.stack
            );
            return res.status(500).json({ error: "Erreur interne du serveur" });
        }
    },
    setIo: (socketIo) => {
        io = socketIo;
    },
};
