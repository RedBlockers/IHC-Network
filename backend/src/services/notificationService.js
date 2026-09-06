"use strict";

const notificationRepository = require("../repositories/notificationRepository");
const realtime = require("../realtime");
const pushService = require("./pushService");
const { logger, serializeError } = require("../logger");
const settingsService = require("./notificationSettingsService");

function mapNotification(row) {
    return {
        notificationId: Number(row.notificationId),
        type: row.type,
        channelId: row.channelId == null ? null : Number(row.channelId),
        messageId: row.messageId ?? null,
        readAt: row.readAt ?? null,
        createdAt: row.createdAt,
        actor: row.actorId == null ? null : {
            userId: Number(row.actorId),
            handle: row.actorHandle,
            displayName: row.actorDisplayName,
            avatar: row.actorAvatar,
        },
        context: {
            channelName: row.channelName ?? null,
            guildId: row.guildId == null ? null : Number(row.guildId),
            guildName: row.guildName ?? null,
        },
    };
}

async function createForUser(data) {
    const id = await notificationRepository.create(data);
    if (!id) return null;
    const row = await notificationRepository.findByIdForUser(id, data.userId);
    if (!row) return null;
    const notification = mapNotification(row);

    const { interrupt, reason } = await settingsService
        .shouldInterrupt(data.userId, {
            guildId: notification.context.guildId,
            channelId: data.channelId,
            isMention: data.type === "mention",
        })
        .catch(() => ({ interrupt: true, reason: null }));

    realtime.emitToUser(data.userId, "notification:new", { ...notification, interrupt, suppressedBy: reason });

    if (interrupt) {
        pushService
            .deliver(data.userId, pushPayload(notification))
            .catch((error) => logger.warn("poussée non délivrée", { error: serializeError(error) }));
    }

    return notification;
}

function pushPayload(notification) {
    const who = notification.actor?.displayName ?? notification.actor?.handle ?? "Quelqu'un";
    const place = notification.context.channelName ? `#${notification.context.channelName}` : "une conversation";

    const summary =
        notification.type === "mention"
            ? `${who} vous a mentionné dans ${place}`
            : notification.type === "reply"
              ? `${who} a répondu dans ${place}`
              : `${who} · ${place}`;

    return {
        title: notification.context.guildName ?? "qweillo",
        summary,
        type: notification.type,
        url: notification.channelId ? `/?channel=${notification.channelId}` : "/",
    };
}

const FILTERS = ["all", "mentions", "threads"];

const WINDOWS = { daily: 24 * 3600 * 1000, weekly: 7 * 24 * 3600 * 1000 };

async function list(userId, { limit, filter = "all", before = null } = {}) {
    const take = Math.min(Math.max(limit ?? 30, 1), 100);
    const wanted = FILTERS.includes(filter) ? filter : "all";

    const [rows, counts] = await Promise.all([
        notificationRepository.listForUser(userId, take, { filter: wanted, before }),
        notificationRepository.countUnread(userId),
    ]);

    const hasMore = rows.length > take;
    const notifications = (hasMore ? rows.slice(0, take) : rows).map(mapNotification);

    return {
        notifications,
        filter: wanted,
        unreadCount: Number(counts?.total ?? 0),
        counts: {
            total: Number(counts?.total ?? 0),
            mentions: Number(counts?.mentions ?? 0),
            threads: Number(counts?.threads ?? 0),
        },
        hasMore,
        nextCursor: hasMore ? String(notifications.at(-1).notificationId) : null,
    };
}

async function digest(userId, frequency, now = new Date()) {
    if (frequency === "off") return { enabled: false, frequency, since: null, channels: [], total: 0, mentions: 0 };

    const span = WINDOWS[frequency] ?? WINDOWS.daily;
    const since = new Date(now.getTime() - span);
    const rows = await notificationRepository.digestSince(userId, since);

    const channels = rows
        .filter((row) => row.channelId != null)
        .map((row) => ({
            channelId: Number(row.channelId),
            channelName: row.channelName,
            guildId: row.guildId == null ? null : Number(row.guildId),
            guildName: row.guildName ?? null,
            total: Number(row.total),
            mentions: Number(row.mentions ?? 0),
            lastAt: row.lastAt,
        }));

    return {
        enabled: true,
        frequency: frequency ?? "daily",
        since: since.toISOString(),
        channels,
        total: channels.reduce((sum, row) => sum + row.total, 0),
        mentions: channels.reduce((sum, row) => sum + row.mentions, 0),
    };
}

async function markRead(userId, notificationId) {
    await notificationRepository.markRead(notificationId, userId);
}

async function markAllRead(userId, filter = "all") {
    await notificationRepository.markAllRead(userId, FILTERS.includes(filter) ? filter : "all");
}

module.exports = { createForUser, list, digest, markRead, markAllRead, mapNotification, FILTERS };
