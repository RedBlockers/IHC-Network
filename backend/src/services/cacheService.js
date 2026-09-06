"use strict";

const redis = require("../infra/redis");
const userRepository = require("../repositories/userRepository");
const { logger, serializeError } = require("../logger");

const TTL_SECONDS = 10;
const key = (userId) => `user:${userId}`;

async function getUserById(userId) {
    const client = redis.getClient();
    if (!client) return userRepository.findById(userId);

    try {
        const cached = await client.get(key(userId));
        if (cached) return reviveDates(JSON.parse(cached));
    } catch (error) {
        logger.warn("lecture de cache échouée", { error: serializeError(error) });
    }

    const user = await userRepository.findById(userId);
    if (user) {
        client.set(key(userId), JSON.stringify(user), "EX", TTL_SECONDS).catch(() => {});
    }
    return user;
}

async function invalidate(userId) {
    const client = redis.getClient();
    if (client) await client.del(key(userId)).catch(() => {});
}

async function get(cacheKey) {
    const client = redis.getClient();
    if (!client) return null;
    try {
        const cached = await client.get(cacheKey);
        return cached ? JSON.parse(cached) : null;
    } catch (error) {
        logger.warn("lecture de cache échouée", { error: serializeError(error) });
        return null;
    }
}

async function set(cacheKey, value, ttlSeconds) {
    const client = redis.getClient();
    if (!client) return;
    await client.set(cacheKey, JSON.stringify(value), "EX", ttlSeconds).catch(() => {});
}

function reviveDates(user) {
    if (user.passwordUpdatedAt) user.passwordUpdatedAt = new Date(user.passwordUpdatedAt);
    if (user.bannedUntil) user.bannedUntil = new Date(user.bannedUntil);
    if (user.createdAt) user.createdAt = new Date(user.createdAt);
    return user;
}

module.exports = { getUserById, invalidate, get, set, TTL_SECONDS };
