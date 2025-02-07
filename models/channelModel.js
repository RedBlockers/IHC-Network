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
        logger.info(`Récupération du channel avec l'ID ${id}`);
        const [rows] = await db.promise().execute("SELECT * FROM channels WHERE channelId = ? LIMIT 1", [id]);
        if (rows.length === 0) {
            logger.info(`Aucun channel trouvé avec l'ID ${id}`);
            return null;
        }
        const row = rows[0];
        const channel = {
            channelId: row.channelId,
            type: row.type,
            name: row.name,
            description: row.description,
            guild: guild
        };
        logger.info(`Channel récupéré avec l'ID ${id}`);
        return channel;
    },
    getFirstChannelByGuild: async (guild) => {
        logger.info(`Récupération du premier channel pour la guilde avec l'ID ${guild.guildId}`);
        const [rows] = await db.promise().execute("SELECT * FROM channels WHERE guildId = ? LIMIT 1", [guild.guildId]);
        const row = rows[0];
        const channel = {
            channelId: row.channelId,
            type: row.type,
            name: row.name,
            description: row.description,
            guild: guild
        };
        logger.info(`Premier channel récupéré pour la guilde avec l'ID ${guild.guildId}`);
        return channel;
    },
    createChannel: async (type, name, description, guildId) => {
        logger.info("Création d'un nouveau channel");
        try {
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
    },
    getPrivateChannelsByUserId: async(userId) => {
        logger.info(`Récupération des channels privés pour l'utilisateur avec l'ID ${userId}`);
        const [rows] = await db.promise().execute("SELECT u.userNickname, u.userId, u.userImage, c.* FROM users as u INNER JOIN friends as f ON (f.friendId = u.userId AND f.userId = ?) OR (f.userId = u.userId AND f.friendId = ?) INNER JOIN channels as c ON f.id = c.friendId ", [userId, userId]);
        const channels = [];
        rows.forEach((row) => {
            const channel = {
                channelId: row.channelId,
                type: row.type,
                name: row.userNickname,
                description: row.description,
                user: {
                    userId: row.userId,
                    username: row.userNickname,
                    userImage: row.userImage
                }
            };
            channels.push(channel);
        });
        logger.info(`Channels privés récupérés pour l'utilisateur avec l'ID ${userId}`);
        return channels;
    }
};