"use strict";

const redis = require("../infra/redis");

const RETENTION_SECONDS = 86400;
const keyFor = (channelId) => `voice:channel:${channelId}`;

function normalize(participant) {
    return {
        userId: Number(participant.userId),
        handle: String(participant.handle || "").slice(0, 20),
        displayName: String(participant.displayName || participant.handle || "Membre").slice(0, 32),
        avatar: typeof participant.avatar === "string" ? participant.avatar.slice(0, 512) : null,
        joinedAt: new Date(participant.joinedAt).toISOString(),
    };
}

function parseEntries(entries) {
    return Object.values(entries)
        .flatMap((value) => {
            try {
                const participant = JSON.parse(value);
                return Number.isInteger(participant.userId) && participant.userId > 0 ? [participant] : [];
            } catch {
                return [];
            }
        })
        .sort((left, right) => left.joinedAt.localeCompare(right.joinedAt) || left.userId - right.userId);
}

async function join(channelId, participant) {
    const client = redis.getClient();
    if (!client) return [];
    const value = normalize(participant);
    const key = keyFor(channelId);
    await client.hset(key, String(value.userId), JSON.stringify(value));
    await client.expire(key, RETENTION_SECONDS);
    return list(channelId);
}

async function leave(channelId, userId) {
    const client = redis.getClient();
    if (!client) return [];
    await client.hdel(keyFor(channelId), String(userId));
    return list(channelId);
}

async function clear(channelId) {
    const client = redis.getClient();
    if (client) await client.del(keyFor(channelId));
}

async function list(channelId) {
    const client = redis.getClient();
    if (!client) return [];
    return parseEntries(await client.hgetall(keyFor(channelId)));
}

async function listForChannels(channelIds) {
    const entries = await Promise.all(channelIds.map(async (channelId) => [String(channelId), await list(channelId)]));
    return Object.fromEntries(entries);
}

module.exports = { join, leave, clear, list, listForChannels, keyFor, RETENTION_SECONDS };
