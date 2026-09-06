"use strict";

const config = require("../config");
const { Forbidden } = require("../errors");

const TOKEN_ROUTE = /\/api\/v1\/(webhooks|bots)\//;
const ACTIVITY_VERIFY = /\/api\/v1\/activities\/verify$/;

module.exports = function trustedOrigin(req, _res, next) {
    const path = (req.originalUrl || req.path || "").split("?")[0];
    if (TOKEN_ROUTE.test(path) || ACTIVITY_VERIFY.test(path)) return next();

    const origin = req.get("origin");
    const fetchSite = req.get("sec-fetch-site");

    if (fetchSite === "cross-site" || (origin && !config.CORS_ORIGIN.includes(origin))) {
        return next(new Forbidden("Origine de requête refusée."));
    }
    return next();
};
