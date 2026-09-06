"use strict";

const Redis = require("ioredis");

const config = require("../config");
const { logger, serializeError } = require("../logger");

let main = null;
let pubClient = null;
let subClient = null;

function build(role) {
    const client = new Redis(config.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
        retryStrategy: (times) => Math.min(times * 200, 5_000),
        connectionName: `qweillo-${role}`,
    });
    client.on("error", (error) => logger.error("erreur Redis", { role, error: serializeError(error) }));
    client.on("ready", () => logger.info("Redis connecté", { role }));
    return client;
}

function init() {
    if (!config.redisEnabled) {
        logger.warn("Redis désactivé — mode mémoire mono-nœud (développement uniquement)");
        return null;
    }
    main = build("main");
    pubClient = build("pub");
    subClient = pubClient.duplicate();
    subClient.options.connectionName = "qweillo-sub";
    return main;
}

const getClient = () => main;
const getAdapterClients = () => (pubClient && subClient ? { pubClient, subClient } : null);

async function ping() {
    if (!main) return true;
    const reply = await main.ping();
    return reply === "PONG";
}

async function close() {
    await Promise.allSettled([main?.quit(), pubClient?.quit(), subClient?.quit()]);
}

module.exports = { init, getClient, getAdapterClients, ping, close };
