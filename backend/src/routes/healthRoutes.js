"use strict";

const { Router } = require("express");

const config = require("../config");
const db = require("../db/pool");
const redis = require("../infra/redis");
const metrics = require("../infra/metrics");
const turnHealth = require("../infra/turnHealth");
const { asyncHandler } = require("../errors");

const router = Router();

router.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok" });
});

router.get(
    "/readyz",
    asyncHandler(async (_req, res) => {
        const [dbOk, redisOk] = await Promise.all([
            db.ping().then(() => true).catch(() => false),
            redis.ping().then((ok) => ok).catch(() => false),
        ]);
        const ready = dbOk && redisOk;
        const turn = await turnHealth.describeTurn();
        res.status(ready ? 200 : 503).json({
            status: ready ? "ready" : "not_ready",
            checks: {
                database: dbOk,
                redis: redisOk,
                media: Boolean(config.mediaEnabled),
                turn,
            },
        });
    })
);

if (config.METRICS_ENABLED) {
    router.get(
        "/metrics",
        asyncHandler(async (_req, res) => {
            res.set("Content-Type", metrics.contentType);
            res.send(await metrics.render());
        })
    );
}

module.exports = router;
