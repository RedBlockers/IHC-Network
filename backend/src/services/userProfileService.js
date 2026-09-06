"use strict";

const { Conflict, NotFound } = require("../errors");
const { DUPLICATE_ENTRY } = require("../db/pool");
const userRepository = require("../repositories/userRepository");
const guildRepository = require("../repositories/guildRepository");
const friendshipRepository = require("../repositories/friendshipRepository");
const storageService = require("./storageService");
const cacheService = require("./cacheService");
const presenceService = require("./presenceService");
const realtime = require("../realtime");
const { toPrivateUser, toPublicUser } = require("../domain/mappers");
const decorations = require("../domain/profileDecorations");

const DEFAULT_AVATAR = "/assets/default-avatar.png";

async function update(user, fields, { avatarBuffer, bannerImageBuffer } = {}) {
    const next = { ...fields };
    delete next.removeAvatar;
    delete next.removeBannerImage;

    if (avatarBuffer) next.avatar = await storageService.saveAvatar(user.userId, avatarBuffer);
    else if (fields.removeAvatar) next.avatar = DEFAULT_AVATAR;

    if (bannerImageBuffer) next.bannerImage = await storageService.saveUserBanner(user.userId, bannerImageBuffer);
    else if (fields.removeBannerImage) next.bannerImage = null;

    if (next.avatarDecoration !== undefined && !decorations.isKnown(next.avatarDecoration)) {
        next.avatarDecoration = "none";
    }

    try {
        const changed = await userRepository.updateProfile(user.userId, next);
        if (!changed) throw new NotFound("Compte introuvable.");
    } catch (error) {
        if (error.code === DUPLICATE_ENTRY) throw new Conflict("Ce pseudo est déjà utilisé.");
        throw error;
    }

    await cacheService.invalidate(user.userId);
    const updated = await userRepository.findById(user.userId);
    const publicUser = toPublicUser(updated);
    delete publicUser.presence;
    const online = await presenceService.isOnline(user.userId);
    const presence = !online || updated.statusPreference === "invisible" ? "offline" : updated.statusPreference;
    const [guilds, friendships] = await Promise.all([
        guildRepository.listIdsForUser(user.userId),
        friendshipRepository.listForUser(user.userId),
    ]);
    for (const guild of guilds) {
        realtime.emitToGuild(Number(guild.guildId), "user:profile", publicUser);
        realtime.emitToGuild(Number(guild.guildId), "presence:update", { userId: user.userId, status: presence });
    }
    for (const friendship of friendships) {
        if (friendship.status === "accepted") {
            realtime.emitToUser(Number(friendship.userId), "user:profile", publicUser);
            realtime.emitToUser(Number(friendship.userId), "presence:update", { userId: user.userId, status: presence });
        }
    }
    realtime.emitToUser(user.userId, "user:profile", publicUser);
    return toPrivateUser(updated);
}

async function updatePreferences(user, preferences) {
    const changed = await userRepository.updatePreferences(user.userId, preferences);
    if (!changed) throw new NotFound("Compte introuvable.");

    await cacheService.invalidate(user.userId);
    const updated = await userRepository.findById(user.userId);
    const next = toPrivateUser(updated).preferences;
    realtime.emitToUser(user.userId, "user:preferences", next);
    return next;
}

module.exports = { update, updatePreferences };
