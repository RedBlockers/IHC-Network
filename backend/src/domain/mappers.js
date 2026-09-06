"use strict";

const toPublicUser = (row) => {
    if (!row) return null;
    return {
        userId: Number(row.userId),
        handle: row.handle,
        displayName: row.displayName,
        avatar: row.avatar,
        avatarDecoration: row.avatarDecoration ?? "none",
        bannerImage: row.bannerImage ?? null,
        aboutMe: row.aboutMe,
        activityText: row.activityText ?? "",
        presence: row.presence,
        isBot: Boolean(row.isBot),
    };
};

const toPreferences = (row) => ({
    theme: row.themePreference ?? "dark",
    density: row.densityPreference ?? "comfortable",
    accent: row.accentPreference ?? null,
    reduceMotion: Boolean(row.reduceMotion),
    highContrast: Boolean(row.highContrast),
    hideBanners: Boolean(row.hideBanners),
    neutralizeCommunityThemes: Boolean(row.neutralizeCommunityThemes),
    bannerBehaviour: row.bannerBehaviour ?? "auto",
});

const toPrivateUser = (row) => {
    if (!row) return null;
    return {
        ...toPublicUser(row),
        email: row.email,
        preferences: toPreferences(row),
        statusPreference: row.statusPreference ?? "online",
        isEmailVerified: Boolean(row.isEmailVerified),
        isBanned: Boolean(row.isBanned),
        bannedUntil: row.bannedUntil ?? null,
        suspensionReason: row.suspensionReason ?? null,
        createdAt: row.createdAt,
    };
};

const toGuild = (row) => {
    if (!row) return null;
    return {
        guildId: Number(row.guildId),
        name: row.name,
        description: row.description,
        icon: row.icon ?? null,
        banner: row.banner ?? null,
        bannerImage: row.bannerImage ?? null,
        bannerFocusX: row.bannerFocusX == null ? 50 : Number(row.bannerFocusX),
        bannerFocusY: row.bannerFocusY == null ? 50 : Number(row.bannerFocusY),
        accent: row.accent ?? null,
        ownerId: Number(row.ownerId),
        suspendedAt: row.suspendedAt ?? null,
        suspendedReason: row.suspendedReason ?? null,
    };
};

const toChannel = (row) => {
    if (!row) return null;
    return {
        channelId: Number(row.channelId),
        type: row.type,
        name: row.name,
        description: row.description,
        guildId: row.guildId != null ? Number(row.guildId) : null,
        categoryId: row.categoryId != null ? Number(row.categoryId) : null,
        position: Number(row.position),
        e2eeEnabled: Boolean(row.e2eeEnabled),
        keyEpoch: Number(row.keyEpoch ?? 0),
        customModeId: row.customModeId == null ? null : Number(row.customModeId),
        expiresAt: row.expiresAt ?? null,
    };
};

const toCategory = (row) => {
    if (!row) return null;
    return {
        categoryId: Number(row.categoryId),
        guildId: Number(row.guildId),
        name: row.name,
        position: Number(row.position),
    };
};

const toMessage = (row) => {
    if (!row) return null;
    return {
        messageId: String(row.messageId),
        channelId: Number(row.channelId),
        content: row.content,
        encryptionEpoch: row.encryptionEpoch != null ? Number(row.encryptionEpoch) : null,
        hasPoll: Boolean(row.hasPoll),
        createdAt: row.createdAt,
        editedAt: row.editedAt ?? null,
        author: {
            userId: Number(row.userId),
            handle: row.handle,
            displayName: row.botName || row.webhookName || row.displayName,
            avatar: row.avatar,
            avatarDecoration: row.botName || row.webhookName ? "none" : (row.avatarDecoration ?? "none"),
            isWebhook: Boolean(row.webhookName) && !row.botName,
            isBot: Boolean(row.botName),
        },
        replyTo: row.replyToId
            ? {
                  messageId: String(row.replyToId),
                  author: row.replyAuthorName || row.replyAuthorHandle || null,
                  content: row.replyContent ?? null,
              }
            : null,
        reactions: row.reactions ?? [],
    };
};

const toFriendship = (row, currentUserId) => {
    if (!row) return null;
    const requesterId = Number(row.requesterId);
    return {
        friendshipId: Number(row.friendshipId),
        status: row.status,
        isOutgoing: requesterId === Number(currentUserId),
        user: toPublicUser(row),
    };
};

module.exports = {
    toPublicUser,
    toPrivateUser,
    toGuild,
    toChannel,
    toCategory,
    toMessage,
    toFriendship,
};
