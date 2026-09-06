"use strict";

const maintenance = require("../infra/maintenance");
const { ServiceUnavailable } = require("../errors");

const RETRY_AFTER_SECONDS = 120;

const ALWAYS_ALLOWED = new Set(["/healthz", "/readyz", "/metrics"]);

module.exports = function maintenanceGate(req, res, next) {
    const state = maintenance.state();
    if (!state?.active) return next();

    if (ALWAYS_ALLOWED.has(req.path)) return next();
    if (req.path === "/api/v1/status" || req.path === "/api/v1/status/") return next();
    if (req.method === "POST" && req.path === "/api/v1/auth/logout") return next();

    res.set("Retry-After", String(RETRY_AFTER_SECONDS));
    return next(
        new ServiceUnavailable(state.reason, {
            code: "maintenance",
            details: { retryAfterSeconds: RETRY_AFTER_SECONDS },
        })
    );
};

module.exports.RETRY_AFTER_SECONDS = RETRY_AFTER_SECONDS;
