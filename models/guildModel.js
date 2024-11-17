const db = require("./connDB");
const logger = require("../utils/logger");

module.exports = {
    getGuildsUserIsIn: async (userId) => {
        const [rows] = await db.promise().execute("SELECT * FROM guilds_User");
        return rows;
    },
    createGuild: async (guildName, guildImage, guildDescription, ownerId) => {
        logger.info("Creating new guild");
        try {
            await db.promise().execute("INSERT INTO guilds (guildName, guildImage, guildDescription, ownerId) VALUES (?, ?, ?, ?)",[guildName, guildImage, guildDescription, guildDescription, ownerId]);
            logger.info("Created guild");
        }catch(err) {
            logger.error(err);
        }
    }
}