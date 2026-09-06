"use strict";

const repository = require("../repositories/notificationSettingsRepository");
const messageRepository = require("../repositories/messageRepository");
const realtime = require("../realtime");
const { BadRequest } = require("../errors");

const LEVELS = ["all", "mentions", "none", "inherit"];
const DEFAULT_LEVEL = "all";
const DIGESTS = ["off", "daily", "weekly"];

function resolveLevel(rows, { channelId, guildId }) {
    const channel = rows.find((row) => row.scope === "channel" && Number(row.targetId) === Number(channelId));
    if (channel && channel.level !== "inherit") return { level: channel.level, from: "channel" };

    const guild = rows.find((row) => row.scope === "guild" && Number(row.targetId) === Number(guildId));
    if (guild && guild.level !== "inherit") return { level: guild.level, from: "guild" };

    return { level: DEFAULT_LEVEL, from: "default" };
}

function inQuietHours({ quietHoursStart, quietHoursEnd }, hour) {
    if (quietHoursStart == null || quietHoursEnd == null) return false;
    const start = Number(quietHoursStart);
    const end = Number(quietHoursEnd);
    if (start === end) return false;
    return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

async function levelFor(userId, { guildId, channelId }) {
    const rows = await repository.findForChannel(userId, guildId ?? null, channelId);
    return resolveLevel(rows, { channelId, guildId });
}

async function shouldInterrupt(userId, { guildId, channelId, isMention }, now = new Date()) {
    const [{ level }, preferences] = await Promise.all([
        levelFor(userId, { guildId, channelId }),
        repository.findQuietHours(userId),
    ]);

    if (level === "none") return { interrupt: false, reason: "muted" };
    if (level === "mentions" && !isMention) return { interrupt: false, reason: "mentions-only" };
    if (preferences && !preferences.desktopNotifications) return { interrupt: false, reason: "desktop-off" };
    if (preferences && inQuietHours(preferences, now.getHours())) return { interrupt: false, reason: "quiet-hours" };

    return { interrupt: true, reason: null };
}

async function setLevel(user, scope, targetId, level) {
    if (!LEVELS.includes(level)) throw new BadRequest("Niveau de notification inconnu.");
    await repository.upsert(user.userId, scope, targetId, level);
    realtime.emitToUser(Number(user.userId), "notification:settings", { scope, targetId: Number(targetId), level });
    return { scope, targetId: Number(targetId), level };
}

async function listSettings(user) {
    const [rows, preferences] = await Promise.all([
        repository.listForUser(user.userId),
        repository.findQuietHours(user.userId),
    ]);
    return {
        settings: rows.map((row) => ({ scope: row.scope, targetId: Number(row.targetId), level: row.level })),
        quietHours: {
            start: preferences?.quietHoursStart ?? null,
            end: preferences?.quietHoursEnd ?? null,
        },
        desktopNotifications: preferences ? Boolean(preferences.desktopNotifications) : true,
        digestFrequency: preferences?.digestFrequency ?? "daily",
    };
}

async function setQuietHours(user, { start, end, desktopNotifications, digestFrequency }) {
    const valid = (value) => value == null || (Number.isInteger(value) && value >= 0 && value <= 23);
    if (!valid(start) || !valid(end)) throw new BadRequest("Une heure calme se situe entre 0 et 23.");
    if ((start == null) !== (end == null)) throw new BadRequest("Indiquez un début et une fin, ou aucun des deux.");
    if (digestFrequency != null && !DIGESTS.includes(digestFrequency)) throw new BadRequest("Fréquence de résumé inconnue.");

    const current = await repository.findQuietHours(user.userId);
    await repository.updateQuietHours(user.userId, {
        start,
        end,
        desktop: desktopNotifications !== false,
        digest: digestFrequency ?? current?.digestFrequency ?? "daily",
    });
    return listSettings(user);
}

async function markChannelRead(user, channelId) {
    const row = await messageRepository.lastIdIn(channelId);
    if (!row?.messageId) return { channelId: Number(channelId), lastReadMessageId: null };
    return markRead(user, channelId, row.messageId);
}

async function markRead(user, channelId, messageId) {
    await repository.markRead(user.userId, channelId, messageId);
    realtime.emitToUser(Number(user.userId), "channel:read", {
        channelId: Number(channelId),
        lastReadMessageId: String(messageId),
    });
    return { channelId: Number(channelId), lastReadMessageId: String(messageId) };
}

async function unreadFor(userId, channelIds) {
    if (channelIds.length === 0) return {};
    const rows = await repository.unreadForUser(userId, channelIds);
    return Object.fromEntries(rows.map((row) => [Number(row.channelId), Number(row.unread)]));
}

module.exports = {
    DIGESTS,
    levelFor,
    shouldInterrupt,
    setLevel,
    listSettings,
    setQuietHours,
    markRead,
    markChannelRead,
    unreadFor,
    resolveLevel,
    inQuietHours,
    LEVELS,
    DEFAULT_LEVEL,
};
