const db = require("./connDB");
const logger = require("../utils/logger");

module.exports = {
    getChannelsByGuild: async (guild) => {
        logger.info(`Récupération des channels pour la guilde avec l'ID ${guild.guildId}`);
        const [rows] = await db.promise().execute("SELECT * FROM channels WHERE guildId = ?", [guild.guildId]);
        const channels = [];
        rows.forEach((row) => {
            const channel = {
                channelId: row.channelId,
                type: row.type,
                name: row.name,
                description: row.description,
                guild: guild
            };
            channels.push(channel);
        });
        logger.info(`Channels récupérés pour la guilde avec l'ID ${guild.id}`);
        return channels;
    },
    getChannelById: async (id, guild) => {
        logger.info(`Récupération du channels avec l'ID ${id}`);
        const [rows] = await db.promise().execute("SELECT * FROM channels WHERE channelId = ? LIMIT 1", [id]);
        const row = rows[0];
        const channel = {
            channelId: row.channelId,
            type: row.type,
            name: row.name,
            description: row.description,
            guild: guild
        };
        logger.info(`Channels récupérés pour la guilde avec l'ID ${guild.id}`);
        return channel;
    },
    createChannel: async (type, name, description, guildId) => {
        logger.info("Création d'un nouveau channel");
        try {
            console.log(type, name, description, guildId)
            const [result] = await db.promise().execute(
                "INSERT INTO channels (type, name, description, guildId) VALUES (?, ?, ?, ?)",
                [type, name, description, guildId]
            );
            logger.info("Nouveau channel créé avec succès");
            return result.insertId;
        } catch (err) {
            logger.error("Erreur lors de la création du channel :", err);
            throw err;
        }
    }
};