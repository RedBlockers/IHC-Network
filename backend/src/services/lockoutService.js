"use strict";

const config = require("../config");
const redis = require("../infra/redis");

const WINDOW_SECONDS = 15 * 60;
const MAX_ATTEMPTS = 10;

const key = (ip, handle) => `lockout:${ip}:${String(handle).toLowerCase()}`;

const local = new Map();

function localGet(k) {
    const entry = local.get(k);
    if (!entry) return 0;
    if (entry.expiresAt <= Date.now()) {
        local.delete(k);
        return 0;
    }
    return entry.count;
}

async function isLocked(ip, handle) {
    const client = redis.getClient();
    if (!client) return localGet(key(ip, handle)) >= MAX_ATTEMPTS;
    const value = await client.get(key(ip, handle));
    return Number(value ?? 0) >= MAX_ATTEMPTS;
}

async function recordFailure(ip, handle) {
    const k = key(ip, handle);
    const client = redis.getClient();
    if (!client) {
        const current = localGet(k);
        local.set(k, { count: current + 1, expiresAt: Date.now() + WINDOW_SECONDS * 1000 });
        return;
    }
    const count = await client.incr(k);
    if (count === 1) await client.expire(k, WINDOW_SECONDS);
}

async function clear(ip, handle) {
    const k = key(ip, handle);
    const client = redis.getClient();
    if (!client) {
        local.delete(k);
        return;
    }
    await client.del(k);
}

module.exports = { isLocked, recordFailure, clear, WINDOW_SECONDS, MAX_ATTEMPTS, _config: config };
