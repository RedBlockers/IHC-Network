const guildModel = require("../models/guildModel");
const {AuthenticateAndDecodeToken} = require('./userController');
const logger = require("../utils/logger");

module.exports = {
    getGuilds: async (req, res) => {
        try {
            const token = req.body.token;
            const { valid, message, decodedToken } = await AuthenticateAndDecodeToken(token);
            if (!valid) {
                return res.status(401).json({ error: message });
            }
            const results = await guildModel.getGuildsUserIsIn(decodedToken.userId);
            res.status(200).json(results);
        }
        catch(err) {
            logger.error(err);
            res.status(500).json({ error: 'Erreur interne du serveur' });

        }
    }
}