"use strict";

const { rateLimit } = require("express-rate-limit");

const config = require("../config");
const redis = require("../infra/redis");
const { TooManyRequests } = require("../errors");

function makeStore(prefix) {
    if (!config.redisEnabled) return undefined;
    const { RedisStore } = require("rate-limit-redis");
    return new RedisStore({
        prefix: `rl:${prefix}:`,
        sendCommand: (...args) => redis.getClient().call(...args),
    });
}

const handler = (_req, _res, next) => next(new TooManyRequests());

const keyOf = (req) => (req.user ? `u:${req.user.userId}` : `a:${req.ip}`);

const base = (prefix) => ({
    standardHeaders: true,
    legacyHeaders: false,
    handler,
    keyGenerator: keyOf,
    store: makeStore(prefix),
});

const globalLimiter = rateLimit({ ...base("global"), windowMs: 60_000, limit: 1800 });

const accountLimiter = rateLimit({ ...base("account"), windowMs: 60_000, limit: 1200 });

const strictLimiter = rateLimit({ ...base("strict"), windowMs: 60_000, limit: 20 });

const authLimiter = rateLimit({ ...base("auth"), windowMs: 15 * 60_000, limit: 30 });
const refreshLimiter = rateLimit({ ...base("refresh"), windowMs: 60_000, limit: 30 });

module.exports = {
    keyOf,
    accountLimiter, globalLimiter, strictLimiter, authLimiter, refreshLimiter };
