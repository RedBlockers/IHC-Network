const channelModel = require('../models/channelModel');
const userController = require('./userController');
const guildModel = require('../models/guildModel');

module.exports = {
    getChannelsByGuildId: async (req, res) => {
        const { guildId, token } = req.body;

        const { valid, message, decodedToken } = await userController.AuthenticateAndDecodeToken(token);
        if (!valid) {
            return res.status(401).json({ error: message });
        }

        const userGuilds = await guildModel.getGuildsByUser(decodedToken.userId);
        const guild = userGuilds.find(guild => guild.guildId === guildId);

        if (!userGuilds.find(guild => guild.guildId === guildId)) {
            return res.status(401).json({'error': 'You are not part of this guild'})
        }


        const channels = await channelModel.getChannelsByGuild(guild);
        return res.status(200).json(channels);
    },
    createChannel: async (req, res) => {
        const { type, name, description, guildId, token } = req.body;
        const { valid, message, decodedToken } = await userController.AuthenticateAndDecodeToken(token);
        if (!valid) {
            console.log(message);
            return res.status(401).json({ error: message });
        }

        const userGuilds = await guildModel.getGuildsByUser(decodedToken.userId);
        const guild = userGuilds.find(guild => guild.guildId === guildId);
        if (!userGuilds.find(guild => guild.guildId === guildId)) {
            return res.status(401).json({'error': 'You are not part of this guild'})
        }

        const channel = await channelModel.createChannel(type, name, description, guildId);
        return res.status(200).json(channel);
    }
}