"use strict";

const searchRepository = require("../repositories/searchRepository");
const channelRepository = require("../repositories/channelRepository");
const messageRepository = require("../repositories/messageRepository");
const guildRepository = require("../repositories/guildRepository");
const attachmentService = require("./attachmentService");
const accessService = require("./accessService");
const realtime = require("../realtime");
const { BadRequest, Forbidden, NotFound } = require("../errors");
const { toMessage } = require("../domain/mappers");
const lexicalOverlap = require("../domain/lexicalOverlap");

const MAX_PINS = 50;

const toResult = (row) => ({
    ...toMessage(row),
    channel: {
        channelId: Number(row.channelId),
        name: row.channelName,
        type: row.channelType,
    },
});

async function readableChannels(userId, guildId) {
    const channels = await channelRepository.listByGuild(guildId);
    const allowed = await Promise.all(
        channels.map(async (channel) => {
            const canView = await accessService.hasChannelPermission(userId, channel.channelId, "VIEW_CHANNEL", channel);
            if (!canView) return null;
            const canRead = await accessService.hasChannelPermission(
                userId,
                channel.channelId,
                "READ_MESSAGE_HISTORY",
                channel
            );
            return canRead ? channel : null;
        })
    );
    return allowed.filter(Boolean);
}

const splitEncrypted = (channels) => ({
    searchable: channels.filter((channel) => !channel.e2eeEnabled),
    encrypted: channels.filter((channel) => channel.e2eeEnabled),
});

function normalize(term) {
    const value = (term ?? "").trim();
    if (value.length < 2) throw new BadRequest("Saisissez au moins 2 caractères.");
    return value.slice(0, 100);
}

async function searchGuild(user, guildId, { q, limit = 30 }) {
    const term = normalize(q);
    const channels = await readableChannels(user.userId, guildId);
    const { searchable, encrypted } = splitEncrypted(channels);

    if (searchable.length === 0) {
        return { results: [], excludedEncrypted: encrypted.map((channel) => channel.name) };
    }

    const rows = await searchRepository.searchMessages(
        searchable.map((channel) => Number(channel.channelId)),
        term,
        Math.min(Math.max(limit, 1), 100)
    );

    return {
        results: rows.map(toResult),
        excludedEncrypted: encrypted.map((channel) => channel.name),
    };
}

async function allReadableChannels(userId) {
    const [guildIds, directChannels] = await Promise.all([
        guildRepository.listIdsForUser(userId),
        channelRepository.listDirectForUser(userId),
    ]);

    const perGuild = await Promise.all(
        guildIds.map((row) => readableChannels(userId, Number(row.guildId)))
    );

    return [...perGuild.flat(), ...directChannels];
}

async function searchAll(user, { q, limit = 30 }) {
    const term = normalize(q);
    const channels = await allReadableChannels(user.userId);
    const { searchable, encrypted } = splitEncrypted(channels);

    if (searchable.length === 0) {
        return { results: [], excludedEncrypted: encrypted.map((channel) => channel.name) };
    }

    const rows = await searchRepository.searchMessages(
        searchable.map((channel) => Number(channel.channelId)),
        term,
        Math.min(Math.max(limit, 1), 100)
    );

    const guildOf = new Map(searchable.map((channel) => [Number(channel.channelId), channel.guildId]));

    return {
        results: rows.map((row) => ({
            ...toResult(row),
            guildId: guildOf.get(Number(row.channelId)) ?? null,
        })),
        excludedEncrypted: encrypted.map((channel) => channel.name),
        scannedChannels: searchable.length,
    };
}

async function searchFiles(user, { q, limit = 30 }) {
    const term = normalize(q);
    const channels = await allReadableChannels(user.userId);
    if (channels.length === 0) return { results: [] };

    const rows = await searchRepository.searchFiles(
        channels.map((channel) => Number(channel.channelId)),
        term,
        Math.min(Math.max(limit, 1), 100)
    );

    return {
        results: rows.map((row) => ({
            ...attachmentService.toAttachment(row),
            channel: {
                channelId: Number(row.channelId),
                name: row.channelName,
                guildId: row.guildId == null ? null : Number(row.guildId),
            },
            author: {
                userId: Number(row.userId),
                handle: row.handle,
                displayName: row.displayName,
                avatar: row.avatar,
            },
        })),
    };
}

async function searchChannel(user, channel, { q, limit = 30 }) {
    const term = normalize(q);
    if (channel.e2eeEnabled) {
        return { results: [], excludedEncrypted: [channel.name] };
    }
    const rows = await searchRepository.searchMessages([Number(channel.channelId)], term, Math.min(Math.max(limit, 1), 100));
    return { results: rows.map(toResult), excludedEncrypted: [] };
}

async function listPins(channelId) {
    const rows = await searchRepository.listPins(channelId);
    return rows.map((row) => ({ ...toResult(row), pinnedAt: row.pinnedAt }));
}

async function pin(channel, user, messageId) {
    const owner = await messageRepository.channelOf(messageId);
    if (Number(owner) !== Number(channel.channelId)) throw new NotFound("Message introuvable dans ce salon.");

    const { total } = await searchRepository.countPins(channel.channelId);
    if (Number(total) >= MAX_PINS) {
        throw new Forbidden(`Un salon ne peut pas dépasser ${MAX_PINS} messages épinglés.`);
    }

    const pinned = await searchRepository.pin(channel.channelId, messageId, user.userId);
    if (!pinned) throw new BadRequest("Ce message est déjà épinglé.");

    realtime.emitToChannel(Number(channel.channelId), "message:pinned", {
        channelId: Number(channel.channelId),
        messageId: String(messageId),
        pinnedBy: Number(user.userId),
    });
    return listPins(channel.channelId);
}

async function unpin(channel, messageId) {
    const removed = await searchRepository.unpin(channel.channelId, messageId);
    if (!removed) throw new NotFound("Ce message n'est pas épinglé.");
    realtime.emitToChannel(Number(channel.channelId), "message:unpinned", {
        channelId: Number(channel.channelId),
        messageId: String(messageId),
    });
    return listPins(channel.channelId);
}

async function searchSemantic(user, { q, limit = 30 }) {
    const term = normalize(q);
    const tokens = lexicalOverlap.tokenize(term);
    const channels = await allReadableChannels(user.userId);
    const { searchable, encrypted } = splitEncrypted(channels);
    if (searchable.length === 0 || tokens.length === 0) {
        return {
            results: [],
            excludedEncrypted: encrypted.map((channel) => channel.name),
            method: lexicalOverlap.METHOD,
        };
    }

    const cap = Math.min(Math.max(limit, 1), 100);
    const rows = await searchRepository.searchRecent(
        searchable.map((channel) => Number(channel.channelId)),
        Math.min(400, Math.max(cap * 8, 80))
    );

    return {
        method: lexicalOverlap.METHOD,
        results: lexicalOverlap.rank(rows, tokens, cap).map(({ row, score }) => ({ ...toResult(row), score })),
        excludedEncrypted: encrypted.map((channel) => channel.name),
    };
}

module.exports = {
    searchGuild,
    searchAll,
    searchFiles,
    searchChannel,
    searchSemantic,
    listPins,
    pin,
    unpin,
    readableChannels,
    MAX_PINS,
};
