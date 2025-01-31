const guildModel = require("../models/guildModel");
const {AuthenticateAndDecodeToken} = require('./userController');
const logger = require("../utils/logger");
const {saveImage} = require("../services/fileServices");
const channelModel = require("../models/channelModel");
const { get } = require("../routes/userRoutes");



module.exports = {

    getGuildsByUser: async (req, res) => {
        try {
            const token = req.body.token;
            const { valid, message, decodedToken } = await AuthenticateAndDecodeToken(token);
            if (!valid) {
                return res.status(401).json({ error: message });
            }
            const guilds = await guildModel.getGuildsByUser(decodedToken.userId);
            return res.status(200).json(guilds);
        }
        catch(err) {
            logger.error(err);
            return res.status(500).json({ error: 'Erreur interne du serveur' });

        }
    },
    
    getGuildById: async (guildId) => {
        try {
            const guild = await guildModel.getGuildById(guildId);
            return guild;
        }
        catch(err) {
            logger.error(err);
            return false;
        }
    },

    createGuild: async (req, res) => {
        try {
            const {token, guildName, guildDescription, guildImage} = req.body;
            console.log(guildName, guildDescription);
            const { valid, message, decodedToken } = await AuthenticateAndDecodeToken(token);
            if (!valid) {
                return res.status(401).json({ error: message });
            }
            const imagePath = await saveImage(guildImage, "guilds");
            guild = await guildModel.createGuild(guildName, imagePath, guildDescription, decodedToken.userId);
            await channelModel.createChannel("text", "general", "Salon général", guild.insertId);
            return res.status(200).json({ success: 'Guild created successfully' });
        }
        catch(err) {
            logger.error(err);
            return res.status(500).json({ error: 'Erreur interne du serveur' });
        }
    }
}