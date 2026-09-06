"use strict";

const path = require("node:path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");

const config = require("./config");
const metrics = require("./infra/metrics");
const requestContext = require("./middlewares/requestContext");
const trustedOrigin = require("./middlewares/trustedOrigin");
const { globalLimiter } = require("./middlewares/rateLimit");
const { notFoundHandler, errorHandler } = require("./middlewares/errorHandler");
const routes = require("./routes");
const health = require("./routes/healthRoutes");
const maintenanceGate = require("./middlewares/maintenance");
const mediaController = require("./controllers/mediaController");
const { asyncHandler } = require("./errors");
const { isInlineSafe } = require("./domain/filePreview");

function createApp() {
    const app = express();

    app.set("trust proxy", config.TRUST_PROXY);
    app.disable("x-powered-by");

    app.use(requestContext);

    app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
    app.use(cors({ origin: config.CORS_ORIGIN, credentials: true }));

    app.use("/api", globalLimiter);
    app.post(
        "/api/v1/media/webhook",
        express.raw({ type: "application/webhook+json", limit: "64kb" }),
        asyncHandler(mediaController.webhook)
    );

    if (config.localStorageEnabled) {
        app.use(
            "/media",
            express.static(config.LOCAL_STORAGE_DIR, {
                dotfiles: "deny",
                fallthrough: true,
                immutable: true,
                index: false,
                maxAge: "1y",
                setHeaders(res, filePath) {
                    res.type(path.extname(filePath) || "application/octet-stream");
                    const contentType = String(res.getHeader("Content-Type")).split(";")[0];
                    const inline = isInlineSafe(contentType, filePath);
                    res.setHeader("Content-Disposition", inline ? "inline" : "attachment");
                    res.setHeader("X-Content-Type-Options", "nosniff");
                    if (!inline) {
                        res.setHeader("Content-Type", "application/octet-stream");
                        res.setHeader(
                            "Content-Security-Policy",
                            "sandbox; default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
                        );
                    }
                },
            })
        );
    }

    app.use(express.json({ limit: "100kb" }));
    app.use(express.urlencoded({ extended: false, limit: "100kb" }));

    app.use(maintenanceGate);
    app.use(health);
    if (config.METRICS_ENABLED) {
        app.use(metrics.httpMetricsMiddleware);
    }

    app.use("/api/v1", (_req, res, next) => {
        res.set("Cache-Control", "no-store");
        next();
    });
    app.use("/api/v1", trustedOrigin, routes);

    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}

module.exports = createApp;
