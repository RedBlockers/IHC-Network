"use strict";

const http = require("node:http");

const config = require("./config");
const { logger, serializeError } = require("./logger");
const db = require("./db/pool");
const redis = require("./infra/redis");
const realtime = require("./realtime");
const accountLifecycle = require("./services/accountLifecycleService");

async function start() {
    redis.init();

    const createApp = require("./app");
    const app = createApp();
    const server = http.createServer(app);

    server.headersTimeout = 20_000;
    server.requestTimeout = 30_000;
    server.keepAliveTimeout = 65_000;

    realtime.init(server);

    await new Promise((resolve) => server.listen(config.PORT, resolve));
    logger.info("qweillo démarré", { port: config.PORT, env: config.NODE_ENV, nodeId: config.NODE_ID });

    const stopCleanup = startAccountCleanup();
    installShutdown(server, stopCleanup);
    return server;
}

function startAccountCleanup() {
    let running = null;
    const run = () => {
        if (running) return;
        running = accountLifecycle
            .purgeExpired()
            .catch((error) => logger.error("échec du nettoyage des comptes", { error: serializeError(error) }))
            .finally(() => {
                running = null;
            });
    };
    const timer = setInterval(run, 60 * 60 * 1000);
    timer.unref();
    run();
    return async () => {
        clearInterval(timer);
        await running;
    };
}

function installShutdown(server, stopCleanup) {
    let shuttingDown = false;

    const shutdown = async (signal) => {
        if (shuttingDown) return;
        shuttingDown = true;
        logger.info("arrêt en cours", { signal });

        const forceTimer = setTimeout(() => {
            logger.error("arrêt gracieux dépassé — sortie forcée");
            process.exit(1);
        }, config.SHUTDOWN_TIMEOUT_MS);
        forceTimer.unref();

        try {
            await stopCleanup();
            await realtime.close();
            await new Promise((resolve) => server.close(resolve));
            await db.close();
            await redis.close();
            logger.info("arrêt propre terminé");
            process.exit(0);
        } catch (error) {
            logger.error("erreur pendant l'arrêt", { error: serializeError(error) });
            process.exit(1);
        }
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    process.on("unhandledRejection", (reason) => {
        logger.error("rejet non géré", { error: serializeError(reason) });
        shutdown("unhandledRejection");
    });
    process.on("uncaughtException", (error) => {
        logger.error("exception non capturée", { error: serializeError(error) });
        shutdown("uncaughtException");
    });
}

if (require.main === module) {
    start().catch((error) => {
        logger.error("échec du démarrage", { error: serializeError(error) });
        process.exit(1);
    });
}

module.exports = { start };
