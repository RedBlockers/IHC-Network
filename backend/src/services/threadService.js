"use strict";

const threadRepository = require("../repositories/threadRepository");
const messageRepository = require("../repositories/messageRepository");
const notificationService = require("./notificationService");
const moderationService = require("./moderationService");
const threadContentService = require("./threadContentService");
const accessService = require("./accessService");
const realtime = require("../realtime");
const { withTransaction } = require("../db/pool");
const { BadRequest, Forbidden, NotFound } = require("../errors");
const { toMessage } = require("../domain/mappers");

const MAX_THREAD_MESSAGES = 200;

function isArchived(row, now = Date.now()) {
    const last = new Date(row.lastMessageAt).getTime();
    return now - last > Number(row.autoArchiveMinutes) * 60_000;
}

const toThread = (row, { following = false } = {}) => ({
    rootId: String(row.rootId),
    channelId: Number(row.channelId),
    title: row.title,
    createdBy: Number(row.createdBy),
    createdAt: row.createdAt,
    lastMessageAt: row.lastMessageAt,
    replyCount: Number(row.replyCount),
    archived: isArchived(row),
    autoArchiveMinutes: Number(row.autoArchiveMinutes),
    resolved: Boolean(row.resolvedAt),
    following,
    author:
        row.authorId == null
            ? null
            : {
                  userId: Number(row.authorId),
                  handle: row.authorHandle,
                  displayName: row.authorDisplayName,
                  avatar: row.authorAvatar,
                  avatarDecoration: row.authorDecoration || "none",
              },
    rootContent: row.rootContent ?? null,
});

async function open(channel, user, rootId, title) {
    const label = (title ?? "").trim();
    if (label.length === 0) throw new BadRequest("Un fil a besoin d'un titre.");

    const owner = await messageRepository.channelOf(rootId);
    if (Number(owner) !== Number(channel.channelId)) throw new NotFound("Message introuvable dans ce salon.");

    const existing = await threadRepository.findByRoot(rootId);
    if (existing) throw new BadRequest("Un fil est déjà ouvert sur ce message.");

    await withTransaction(async (connection) => {
        await threadRepository.create(
            { rootId, channelId: channel.channelId, title: label.slice(0, 100), createdBy: user.userId },
            connection
        );
        await threadRepository.follow(rootId, user.userId, connection);
    });

    const thread = toThread(await threadRepository.findByRoot(rootId), { following: true });
    realtime.emitToChannel(Number(channel.channelId), "thread:opened", thread);
    return thread;
}

async function list(channel, user, limit = 30) {
    const rows = await threadRepository.listByChannel(channel.channelId, Math.min(Math.max(limit, 1), 100));
    const following = await Promise.all(rows.map((row) => threadRepository.isFollowing(row.rootId, user.userId)));
    return rows.map((row, index) => toThread(row, { following: following[index] }));
}

async function messages(channel, rootId) {
    const thread = await threadRepository.findByRoot(rootId);
    if (!thread || Number(thread.channelId) !== Number(channel.channelId)) throw new NotFound("Fil introuvable.");
    const rows = await threadRepository.listMessages(rootId, MAX_THREAD_MESSAGES);
    return { thread: toThread(thread), messages: rows.map(toMessage) };
}

async function reply(channel, user, rootId, content) {
    if (channel.guildId && (await moderationService.isTimedOut(channel.guildId, user.userId))) {
        throw new Forbidden("Vous êtes temporairement réduit au silence dans cette communauté.", {
            details: { sanction: "timeout" },
        });
    }

    const thread = await threadRepository.findByRoot(rootId);
    if (!thread || Number(thread.channelId) !== Number(channel.channelId)) throw new NotFound("Fil introuvable.");
    const safeContent = await threadContentService.prepare(channel, user, content);

    const row = await withTransaction(async (connection) => {
        const created = await messageRepository.create(
            channel.channelId,
            user.userId,
            safeContent,
            null,
            connection,
            rootId
        );
        await threadRepository.touch(rootId, connection);
        await threadRepository.follow(rootId, user.userId, connection);
        return created;
    });

    const message = toMessage(row);
    realtime.emitToChannel(Number(channel.channelId), "thread:message", {
        channelId: Number(channel.channelId),
        rootId: String(rootId),
        message,
    });

    const followers = await threadRepository.listFollowers(rootId);
    await Promise.all(
        followers
            .map((follower) => Number(follower.userId))
            .filter((userId) => userId !== Number(user.userId))
            .map((userId) =>
                notificationService.createForUser({
                    userId,
                    actorId: Number(user.userId),
                    type: "thread",
                    channelId: Number(channel.channelId),
                    messageId: message.messageId,
                })
            )
    );

    return message;
}

async function setFollowing(channel, user, rootId, following) {
    const thread = await threadRepository.findByRoot(rootId);
    if (!thread || Number(thread.channelId) !== Number(channel.channelId)) throw new NotFound("Fil introuvable.");

    if (following) await threadRepository.follow(rootId, user.userId);
    else await threadRepository.unfollow(rootId, user.userId);

    return toThread(thread, { following });
}

async function update(channel, user, rootId, input) {
    const thread = await threadRepository.findByRoot(rootId);
    if (!thread || Number(thread.channelId) !== Number(channel.channelId)) throw new NotFound("Fil introuvable.");
    if (
        Number(thread.createdBy) !== Number(user.userId) &&
        !(await accessService.hasChannelPermission(user.userId, channel.channelId, "MANAGE_MESSAGES", channel))
    ) {
        throw new Forbidden("Seuls l’auteur ou l’équipe de modération peuvent modifier ce sujet.");
    }
    await threadRepository.update(rootId, {
        title: input.title ?? thread.title,
        resolvedAt: input.resolved === undefined ? (thread.resolvedAt ?? null) : input.resolved ? new Date() : null,
    });
    const updated = toThread(await threadRepository.findByRoot(rootId));
    realtime.emitToChannel(Number(channel.channelId), "thread:updated", {
        channelId: Number(channel.channelId),
        rootId: String(rootId),
    });
    return updated;
}

async function openTopic(channel, user, { title, content }) {
    if (channel.guildId && (await moderationService.isTimedOut(channel.guildId, user.userId))) {
        throw new Forbidden("Vous êtes temporairement réduit au silence dans cette communauté.", {
            details: { sanction: "timeout" },
        });
    }

    const label = (title ?? "").trim();
    if (label.length === 0) throw new BadRequest("Un sujet a besoin d'un titre.");
    const safeContent = await threadContentService.prepare(channel, user, content);

    const rootId = await withTransaction(async (connection) => {
        const root = await messageRepository.create(channel.channelId, user.userId, safeContent, null, connection);
        await threadRepository.create(
            {
                rootId: root.messageId,
                channelId: channel.channelId,
                title: label.slice(0, 100),
                createdBy: user.userId,
            },
            connection
        );
        await threadRepository.follow(root.messageId, user.userId, connection);
        return root.messageId;
    });

    const thread = toThread(await threadRepository.findByRoot(rootId), { following: true });
    realtime.emitToChannel(Number(channel.channelId), "thread:opened", thread);
    return thread;
}

module.exports = { open, openTopic, list, messages, reply, setFollowing, update, isArchived, MAX_THREAD_MESSAGES };
