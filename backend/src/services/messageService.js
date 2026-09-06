"use strict";

const messageRepository = require("../repositories/messageRepository");
const realtime = require("../realtime");
const metrics = require("../infra/metrics");
const notificationService = require("./notificationService");
const accessService = require("./accessService");
const emojiService = require("./emojiService");
const roleService = require("./roleService");
const presenceService = require("./presenceService");
const { BadRequest, Forbidden, NotFound } = require("../errors");
const moderationService = require("./moderationService");
const relationService = require("./relationService");
const secretScanner = require("../domain/secretScanner");
const onboardingService = require("./onboardingService");
const automodService = require("./automodService");
const channelModes = require("../domain/channelModes");
const attachmentService = require("./attachmentService");
const { withTransaction, DUPLICATE_ENTRY } = require("../db/pool");
const friendshipRepository = require("../repositories/friendshipRepository");
const { toMessage } = require("../domain/mappers");

function groupReactions(rows) {
    const byMessage = new Map();
    for (const r of rows) {
        const list = byMessage.get(r.messageId) ?? [];
        list.push({ emoji: r.emoji, count: Number(r.count), me: Number(r.me) === 1 });
        byMessage.set(r.messageId, list);
    }
    return byMessage;
}

async function listMessages(channel, { limit, before }, userId) {
    const { rows, hasMore, nextCursor } = await messageRepository.listByChannel(
        channel.channelId,
        limit,
        before ?? null
    );
    const ids = rows.map((r) => r.messageId);
    const reactions = groupReactions(await messageRepository.reactionsForMessages(ids, userId));
    const emojis = await emojiService.resolveFor(
        channel?.guildId ?? null,
        rows.map((row) => row.content)
    );

    const attachments = await attachmentService.forMessages(ids.map(String));
    const messages = rows.map((row) => {
        const message = toMessage(row);
        message.reactions = reactions.get(message.messageId) ?? [];
        message.attachments = attachments.get(String(message.messageId)) ?? [];
        return message;
    });
    return { messages, hasMore, nextCursor, emojis };
}

async function postMessage(
    channel,
    author,
    { content, replyToId, threadRootId = null, attachmentIds = [], clientNonce = null },
    options = {}
) {
    if (clientNonce) {
        const existing = await messageRepository.findByNonce(channel.channelId, author.userId, clientNonce);
        if (existing) return { ...toMessage(existing), attachments: [], deduplicated: true };
    }

    if (channel.guildId && (await moderationService.isTimedOut(channel.guildId, author.userId))) {
        throw new Forbidden("Vous êtes temporairement réduit au silence dans cette communauté.", {
            details: { sanction: "timeout" },
        });
    }

    if (channel.friendshipId) {
        const friendship = await friendshipRepository.findById(channel.friendshipId);
        const other = friendship
            ? Number(friendship.requesterId) === Number(author.userId)
                ? Number(friendship.addresseeId)
                : Number(friendship.requesterId)
            : null;
        if (other && (await relationService.isBlocked(author.userId, other))) {
            throw new Forbidden("Cette conversation est fermée.");
        }
    }

    const mode = channelModes.resolveMode(channel.type, channel.customMode ?? null);
    const refusal = mode.refusal ?? channelModes.refusalFor(channel.type);

    if (mode.acceptsMessages === false) throw new BadRequest(refusal);
    if (mode.requiresPoll) throw new BadRequest(refusal);
    if (mode.requiresThread && !threadRootId) throw new BadRequest(refusal);
    if (mode.requiresAttachment && attachmentIds.length === 0) throw new BadRequest(refusal);

    const postPermission = mode.postPermission ?? null;
    if (
        postPermission &&
        !(await accessService.hasChannelPermission(author.userId, channel.channelId, postPermission, channel))
    ) {
        throw new Forbidden(refusal, { details: { mode: mode.id } });
    }

    if (channel.guildId) await onboardingService.assertMaySpeak(channel.guildId, author.userId);

    if (channel.guildId) await automodService.inspectMessage(channel.guildId, author.userId, content);

    const collective = channel.guildId ? collectiveMention(content) : null;
    if (
        collective &&
        !(await accessService.hasChannelPermission(author.userId, channel.channelId, "MENTION_EVERYONE", channel))
    ) {
        throw new Forbidden("Vous ne pouvez pas utiliser cette mention collective dans ce salon.", {
            details: { permission: "MENTION_EVERYONE", mention: collective },
        });
    }

    const roleIds = channel.guildId ? await allowedRoleMentions(channel, author, content) : [];

    let replyAuthorId = null;
    if (replyToId) {
        const targetChannel = await messageRepository.channelOf(replyToId);
        if (targetChannel !== channel.channelId) {
            throw new BadRequest("Le message cité n'appartient pas à ce salon.");
        }
        replyAuthorId = await messageRepository.authorOf(replyToId);
    }

    const secrets = secretScanner.scan(content);
    const safeContent = secrets.length > 0 ? secretScanner.redact(content, secrets) : content;

    const attachments = await attachmentService.verifyForMessage(channel, author, attachmentIds);
    if (mode.requiresAttachment && !attachments.some((file) => file.kind === "image")) {
        throw new BadRequest("Joignez au moins une image pour publier dans ce salon.");
    }

    let row;
    try {
        row = await withTransaction(async (connection) => {
            const created = await messageRepository.create(
                channel.channelId,
                author.userId,
                safeContent,
                replyToId,
                connection,
                null,
                clientNonce
            );
            await attachmentService.attachToMessage(attachmentIds, created.messageId, connection);
            return created;
        });
    } catch (error) {
        if (error.code === DUPLICATE_ENTRY && clientNonce) {
            const existing = await messageRepository.findByNonce(channel.channelId, author.userId, clientNonce);
            if (existing) return { ...toMessage(existing), attachments: [], deduplicated: true };
        }
        throw error;
    }
    const message = { ...toMessage(row), attachments };

    realtime.emitToChannel(channel.channelId, "message:new", message);
    await notifyRecipients(channel, author, message, safeContent, replyAuthorId, collective, roleIds);
    if (channel.guildId) {
        const botService = require("./botService");
        const automationService = require("./automationService");
        await botService
            .fanout(channel.guildId, "message.created", {
                channelId: Number(channel.channelId),
                messageId: message.messageId,
                authorId: Number(author.userId),
            })
            .catch(() => {});
        if (!options.skipAutomations) {
            await automationService.dispatch(channel, author, "message.created", message).catch(() => {});
        }
    }
    metrics.messagesSent.inc();
    return { ...message, redactedSecrets: secrets.length };
}

function mentionedHandles(content) {
    return [
        ...new Set(
            [...content.matchAll(/(^|[^\w])@([a-zA-Z0-9._-]{3,20})\b/g)]
                .map((match) => match[2].toLowerCase())
                .filter((handle) => !["everyone", "here"].includes(handle))
        ),
    ];
}

function roleMentions(content) {
    return [...new Set([...content.matchAll(/(^|[^\w])@&(\d{1,20})\b/g)].map((match) => Number(match[2])))];
}

function collectiveMention(content) {
    if (/(^|[^\w])@everyone\b/i.test(content)) return "everyone";
    if (/(^|[^\w])@here\b/i.test(content)) return "here";
    return null;
}

async function allowedRoleMentions(channel, author, content) {
    const cited = roleMentions(content);
    if (cited.length === 0) return [];

    const roles = await roleService.list(channel.guildId);
    const known = new Map(roles.map((role) => [Number(role.roleId), role]));
    const usable = cited.filter((roleId) => known.has(roleId));
    if (usable.length === 0) return [];

    const restricted = usable.filter((roleId) => !known.get(roleId).mentionable);
    if (restricted.length > 0) {
        const bypass = await accessService.hasChannelPermission(
            author.userId,
            channel.channelId,
            "MENTION_EVERYONE",
            channel
        );
        if (!bypass) {
            throw new Forbidden("Ce rôle ne peut pas être mentionné dans ce salon.", {
                details: { permission: "MENTION_EVERYONE", roles: restricted },
            });
        }
    }

    return usable;
}

async function notifyRecipients(channel, author, message, content, replyAuthorId, collective, roleIds = []) {
    const handles = mentionedHandles(content);
    const mentioned = handles.length
        ? await messageRepository.resolveMentions(channel.channelId, handles, author.userId)
        : [];
    const recipients = new Map(mentioned.map((row) => [Number(row.userId), "mention"]));
    if (replyAuthorId && replyAuthorId !== author.userId && !recipients.has(replyAuthorId))
        recipients.set(replyAuthorId, "reply");

    if (roleIds.length > 0) {
        const roleRecipients = await messageRepository.listRoleMentionRecipients(
            channel.channelId,
            roleIds,
            author.userId
        );
        for (const row of roleRecipients) recipients.set(Number(row.userId), "mention");
    }

    if (collective) {
        const guildRecipients = await messageRepository.listGuildMentionRecipients(channel.channelId, author.userId);
        if (collective === "everyone") {
            for (const row of guildRecipients) recipients.set(Number(row.userId), "mention");
        } else {
            const ids = guildRecipients.map((row) => Number(row.userId));
            const online = await presenceService.areOnline(ids);
            for (const userId of ids) {
                if (!online.get(userId)) continue;
                realtime.emitToUser(userId, "mention:here", {
                    channelId: channel.channelId,
                    messageId: message.messageId,
                    actor: {
                        userId: author.userId,
                        handle: author.handle,
                        displayName: author.displayName,
                        avatar: author.avatar,
                    },
                });
            }
        }
    }

    await Promise.all(
        [...recipients].map(([userId, type]) =>
            notificationService.createForUser({
                userId,
                actorId: author.userId,
                type,
                channelId: channel.channelId,
                messageId: message.messageId,
            })
        )
    );
}

async function editMessage(channel, author, messageId, content) {
    const targetChannel = await messageRepository.channelOf(messageId);
    if (targetChannel !== channel.channelId) throw new NotFound("Message introuvable ou non modifiable.");

    const ok = await messageRepository.updateContent(messageId, author.userId, content);
    if (!ok) throw new NotFound("Message introuvable ou non modifiable.");

    const row = await messageRepository.findById(messageId);
    const message = toMessage(row);
    realtime.emitToChannel(channel.channelId, "message:edit", message);
    return message;
}

async function deleteMessage(channel, user, messageId) {
    const targetChannel = await messageRepository.channelOf(messageId);
    if (targetChannel !== channel.channelId) throw new NotFound("Message introuvable ou non supprimable.");

    let removed = await messageRepository.deleteOwn(messageId, user.userId);
    if (
        !removed &&
        channel.guildId &&
        (await accessService.hasGuildPermission(user.userId, channel.guildId, "MANAGE_MESSAGES"))
    ) {
        removed = await messageRepository.deleteById(messageId);
    }
    if (!removed) throw new NotFound("Message introuvable ou non supprimable.");
    realtime.emitToChannel(channel.channelId, "message:delete", {
        channelId: channel.channelId,
        messageId: String(messageId),
    });
}

async function toggleReaction(channel, user, messageId, emoji, add) {
    const targetChannel = await messageRepository.channelOf(messageId);
    if (targetChannel !== channel.channelId) throw new NotFound("Message introuvable.");

    if (add && !(await emojiService.isUsableReaction(channel, emoji))) {
        throw new BadRequest("Cet emoji n'existe pas dans cette communauté.");
    }

    if (add) await messageRepository.addReaction(messageId, user.userId, emoji);
    else await messageRepository.removeReaction(messageId, user.userId, emoji);

    const rows = await messageRepository.reactionsForMessages([messageId], user.userId);
    const entry = rows.find((r) => r.emoji === emoji);
    const summary = entry ? { emoji, count: Number(entry.count) } : { emoji, count: 0 };
    realtime.emitToChannel(channel.channelId, "reaction:update", {
        channelId: channel.channelId,
        messageId: String(messageId),
        ...summary,
    });
    return summary;
}

async function reactionAuthors(channel, messageId, emoji) {
    const targetChannel = await messageRepository.channelOf(messageId);
    if (targetChannel !== channel.channelId) throw new NotFound("Message introuvable.");

    const rows = await messageRepository.reactionAuthors(messageId, emoji, 30);
    return {
        emoji,
        users: rows.map((row) => ({
            userId: Number(row.userId),
            handle: row.handle,
            displayName: row.displayName,
            avatar: row.avatar,
        })),
    };
}

async function favoriteReactions(userId) {
    const rows = await messageRepository.favoriteReactions(userId, 12);
    return rows.map((row) => ({ emoji: row.emoji, uses: Number(row.uses) }));
}

module.exports = {
    listMessages,
    postMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
    reactionAuthors,
    favoriteReactions,
};
