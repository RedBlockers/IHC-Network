module.exports = {
    userPublicMapper: (dbRow) => {
        if (!dbRow) return null;
        return {
            userId: Number(dbRow.userId),
            handle: dbRow.handle,
            displayName: dbRow.displayName,
            avatar: dbRow.avatar,
            aboutMe: dbRow.aboutMe,
            notes: dbRow.notes,
            status: dbRow.presence,
            isBot: dbRow.isBot === 1,
        };
    },

    userPrivateMapper: (dbRow) => {
        if (!dbRow) return null;
        return {
            userId: Number(dbRow.userId),
            handle: dbRow.handle,
            displayName: dbRow.displayName,
            avatar: dbRow.avatar,
            aboutMe: dbRow.aboutMe,
            notes: dbRow.notes,
            status: dbRow.presence,
            isBot: dbRow.isBot === 1,
            email: dbRow.email,
            isEmailVerified: dbRow.isEmailVerified === 1,
            isBanned: dbRow.isBanned === 1,
            banDuration: dbRow.banDayDuration,
        };
    },

    friendshipMapper: (dbRow) => {
        if (!dbRow) return null;
        return {
            user: module.exports.userPublicMapper(dbRow),
            isPending: dbRow.isPending === 1,
            isSender: dbRow.isSender === 1,
        };
    },

    channelMapper: (dbRow, guildId) => {
        if (!dbRow) return null;
        return {
            channelId: Number(dbRow.channelId),
            type: dbRow.type,
            name: dbRow.name,
            description: dbRow.description,
            guildId: Number(guildId),
        };
    },
    privateChannelMapper: (dbRow) => {
        if (!dbRow) return null;
        return {
            channelId: Number(dbRow.channelId),
            type: dbRow.type,
            name: dbRow.name,
            description: dbRow.description,
            user: {
                userId: Number(dbRow.userId),
                username: dbRow.userNickname,
                avatar: dbRow.userImage,
            },
        };
    },

    guildMapper: (dbRow) => {
        if (!dbRow) return null;
        return {
            guildId: Number(dbRow.guildId),
            name: dbRow.guildName,
            description: dbRow.guildDescription,
            image: dbRow.guildImage,
            ownerId: Number(dbRow.ownerId),
        };
    },
};
