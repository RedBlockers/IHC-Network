"use strict";

const config = require("../config");
const redis = require("../infra/redis");

const KEY = (userId) => `presence:${userId}`;
const TTL = config.PRESENCE_TTL_SECONDS;

const localCounts = new Map();

async function connect(userId) {
    const client = redis.getClient();
    if (!client) {
        const next = (localCounts.get(userId) ?? 0) + 1;
        localCounts.set(userId, next);
        return next === 1;
    }
    const count = await client.incr(KEY(userId));
    await client.expire(KEY(userId), TTL);
    return count === 1;
}

async function disconnect(userId) {
    const client = redis.getClient();
    if (!client) {
        const next = Math.max(0, (localCounts.get(userId) ?? 0) - 1);
        if (next === 0) localCounts.delete(userId);
        else localCounts.set(userId, next);
        return next === 0;
    }
    const count = await client.decr(KEY(userId));
    if (count <= 0) {
        await client.del(KEY(userId));
        return true;
    }
    await client.expire(KEY(userId), TTL);
    return false;
}

async function heartbeat(userId) {
    const client = redis.getClient();
    if (client) await client.expire(KEY(userId), TTL);
}

async function areOnline(userIds) {
    const result = new Map();
    if (userIds.length === 0) return result;

    const client = redis.getClient();
    if (!client) {
        for (const id of userIds) result.set(id, (localCounts.get(id) ?? 0) > 0);
        return result;
    }

    const pipeline = client.pipeline();
    for (const id of userIds) pipeline.exists(KEY(id));
    const replies = await pipeline.exec();
    userIds.forEach((id, index) => result.set(id, replies[index][1] === 1));
    return result;
}

async function isOnline(userId) {
    return (await areOnline([userId])).get(userId) === true;
}

module.exports = { connect, disconnect, heartbeat, areOnline, isOnline };
