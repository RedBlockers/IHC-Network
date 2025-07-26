const db = require("./connDB");
const logger = require("../utils/logger");

module.exports = {
    getGuilds: async () => {
        const startTime = Date.now();

        try {
            const [rows] = await db.promise().execute(`
            SELECT
                g.guildId,
                g.guildName,
                g.guildImage,
                g.guildDescription,
                g.ownerId,
                u.userNickname as ownerNickname,
                u.userImage as ownerImage,
                JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'userId', m.userId,
                        'nickname', m.userNickname,
                        'image', m.userImage,
                        'presence', m.presence
                    )
                ) as members
            FROM guilds g
            JOIN users u ON g.ownerId = u.userId
            LEFT JOIN (
                SELECT
                    gj.guildId,
                    gj.userId,
                    u.userNickname,
                    u.userImage,
                    u.presence
                FROM guilds_joined gj
                JOIN users u ON gj.userId = u.userId
            ) m ON g.guildId = m.guildId
            GROUP BY g.guildId
        `);

            const result = rows.map((row) => ({
                guildId: row.guildId,
                guildName: row.guildName,
                guildImage: row.guildImage,
                guildDescription: row.guildDescription,
                owner: {
                    userId: row.ownerId,
                    nickname: row.ownerNickname,
                    image: row.ownerImage,
                },
                members: row.members ? JSON.parse(row.members) : [],
            }));

            logger.debug({
                event: "DBQuery",
                operation: "SELECT",
                table: "guilds",
                querySummary: "Complex guilds query with JSON aggregation",
                duration: Date.now() - startTime,
                success: true,
                guildsCount: result.length,
            });

            return result;
        } catch (error) {
            logger.error({
                event: "DBQueryError",
                operation: "SELECT",
                table: "guilds",
                error: error.message,
                stack: error.stack,
                duration: Date.now() - startTime,
            });
            throw error;
        }
    },
    getGuildsByUser: async (userId) => {
        const startTime = Date.now();

        try {
            // Récupération des guildes où l'utilisateur est membre
            const [guildsRows] = await db.promise().execute(
                `
            SELECT
                g.guildId,
                g.guildName,
                g.guildImage,
                g.guildDescription,
                g.ownerId,
                u.userNickname as ownerNickname,
                u.userImage as ownerImage
            FROM guilds_joined gj
            JOIN guilds g ON gj.guildId = g.guildId
            JOIN users u ON g.ownerId = u.userId
            WHERE gj.userId = ?
            ORDER BY g.guildName
        `,
                [userId]
            );

            // Récupération des guildes où l'utilisateur est propriétaire
            const [ownedGuildsRows] = await db.promise().execute(
                `
            SELECT
                g.guildId,
                g.guildName,
                g.guildImage,
                g.guildDescription,
                g.ownerId,
                u.userNickname as ownerNickname,
                u.userImage as ownerImage
            FROM guilds g
            JOIN users u ON g.ownerId = u.userId
            WHERE g.ownerId = ?
        `,
                [userId]
            );

            // Fusion des résultats
            const guildsMap = new Map();

            // Ajout des guildes où l'utilisateur est membre
            guildsRows.forEach((row) => {
                if (!guildsMap.has(row.guildId)) {
                    guildsMap.set(row.guildId, {
                        guildId: row.guildId,
                        guildName: row.guildName,
                        guildImage: row.guildImage,
                        guildDescription: row.guildDescription,
                        isOwner: false,
                        owner: {
                            userId: row.ownerId,
                            nickname: row.ownerNickname,
                            image: row.ownerImage,
                        },
                    });
                }
            });

            // Ajout des guildes où l'utilisateur est propriétaire
            ownedGuildsRows.forEach((row) => {
                guildsMap.set(row.guildId, {
                    guildId: row.guildId,
                    guildName: row.guildName,
                    guildImage: row.guildImage,
                    guildDescription: row.guildDescription,
                    isOwner: true,
                    owner: {
                        userId: row.ownerId,
                        nickname: row.ownerNickname,
                        image: row.ownerImage,
                    },
                });
            });

            const result = Array.from(guildsMap.values());

            logger.debug({
                event: "DBQuery",
                operation: "SELECT",
                table: "guilds_joined, guilds",
                querySummary: `Complex query for user guilds (userId: ${userId})`,
                duration: Date.now() - startTime,
                success: true,
                guildsCount: result.length,
            });

            return result;
        } catch (error) {
            logger.error({
                event: "DBQueryError",
                operation: "SELECT",
                table: "guilds_joined",
                error: error.message,
                stack: error.stack,
                duration: Date.now() - startTime,
                userId: userId,
            });
            return []; // Retourne un tableau vide en cas d'erreur
        }
    },

    getGuildById: async (guildId) => {
        const startTime = Date.now();

        try {
            // Récupération des informations de base de la guilde
            const [guildRows] = await db.promise().execute(
                `
            SELECT
                g.guildId,
                g.guildName,
                g.guildImage,
                g.guildDescription,
                g.ownerId,
                u.userNickname as ownerNickname,
                u.userImage as ownerImage
            FROM guilds g
            JOIN users u ON g.ownerId = u.userId
            WHERE g.guildId = ?
        `,
                [guildId]
            );

            if (guildRows.length === 0) {
                return null;
            }

            const guildData = guildRows[0];

            // Récupération des membres de la guilde
            const [membersRows] = await db.promise().execute(
                `
            SELECT
                u.userId,
                u.userNickname,
                u.userImage,
                u.presence
            FROM guilds_joined gj
            JOIN users u ON gj.userId = u.userId
            WHERE gj.guildId = ?
            ORDER BY u.userNickname
        `,
                [guildId]
            );

            const result = {
                guildId: guildData.guildId,
                guildName: guildData.guildName,
                guildImage: guildData.guildImage,
                guildDescription: guildData.guildDescription,
                owner: {
                    userId: guildData.ownerId,
                    nickname: guildData.ownerNickname,
                    image: guildData.ownerImage,
                },
                members: membersRows.map((member) => ({
                    userId: member.userId,
                    nickname: member.userNickname,
                    image: member.userImage,
                    presence: member.presence,
                })),
            };

            logger.debug({
                event: "DBQuery",
                operation: "SELECT",
                table: "guilds, guilds_joined",
                querySummary: `Detailed guild query (guildId: ${guildId})`,
                duration: Date.now() - startTime,
                success: true,
                membersCount: result.members.length,
            });

            return result;
        } catch (error) {
            logger.error({
                event: "DBQueryError",
                operation: "SELECT",
                table: "guilds",
                error: error.message,
                stack: error.stack,
                duration: Date.now() - startTime,
                guildId: guildId,
            });
            return null; // Retourne null en cas d'erreur
        }
    },
    createGuild: async (guildName, guildImage, guildDescription, ownerId) => {
        const startTime = Date.now();
        logger.info("Creating new guild");
        try {
            const [result] = await db
                .promise()
                .execute(
                    "INSERT INTO guilds (guildName, guildImage, guildDescription, ownerId) " +
                        "VALUES (?, ?, ?, ?)",
                    [guildName, guildImage, guildDescription, ownerId]
                );
            logger.info("Created guild");
            logger.debug({
                event: "DBQuery",
                operation: "INSERT",
                table: "guilds",
                querySummary:
                    "INSERT INTO guilds (guildName, guildImage, guildDescription, ownerId) VALUES (?, ?, ?, ?)",
                parameters: [guildName, guildImage, guildDescription, ownerId],
                duration: Date.now() - startTime,
                success: true,
            });
            return result;
        } catch (err) {
            logger.error({
                event: "DBError",
                message: error.message,
                stack: error.stack,
                duration: `${Date.now() - startTime}ms`,
            });
            logger.error(err);
        }
    },

    CreateInvite: async (userId, guildId, invite) => {
        const startTime = Date.now();
        try {
            const [result] = await db
                .promise()
                .execute(
                    "INSERT INTO invites (guild, author, invite) VALUES (?, ?, ?)",
                    [guildId, userId, invite]
                );
            logger.debug({
                event: "DBQuery",
                operation: "INSERT",
                table: "invites",
                querySummary:
                    "INSERT INTO invites (guild, author, invite) VALUES (?, ?, ?)",
                parameters: [guildId, userId, invite],
                duration: Date.now() - startTime,
                success: true,
            });
            return result;
        } catch (err) {
            logger.error({
                event: "DBError",
                message: err.message,
                stack: err.stack,
                duration: `${Date.now() - startTime}ms`,
            });
        }
    },

    getGuildByInviteCode: async (inviteCode) => {
        const startTime = Date.now();
        try {
            const [rows] = await db
                .promise()
                .execute("SELECT * FROM invites WHERE invite = ?", [
                    inviteCode,
                ]);
            const invites = [];
            rows.forEach((row) => {
                const invite = {
                    id: row.id,
                    guildId: row.guild,
                    authorId: row.author,
                };
                invites.push(invite);
            });
            logger.debug({
                event: "DBQuery",
                operation: "SELECT",
                table: "invites",
                querySummary: `SELECT * FROM invites WHERE invite = ${inviteCode}`,
                duration: Date.now() - startTime,
                success: true,
            });
            return invites[0];
        } catch (err) {
            logger.error({
                event: "DBError",
                message: err.message,
                stack: err.stack,
                duration: `${Date.now() - startTime}ms`,
            });
            return null;
        }
    },
};
