"use strict";

const config = require("../config");

function hostOf(origin) {
    try {
        return new URL(origin).hostname;
    } catch {
        return null;
    }
}

const origins = () => {
    const list = config.PUBLIC_URL ? [config.PUBLIC_URL, ...config.CORS_ORIGIN] : [...config.CORS_ORIGIN];
    return [...new Set(list.filter(Boolean))];
};

const IP_LITERAL = /^(\d{1,3}\.){3}\d{1,3}$|^\[?[0-9a-f:]+\]?$/i;

const rpId = () => hostOf(origins()[0]) ?? "localhost";

const rpName = "qweillo";

function isUsable() {
    const origin = origins()[0];
    if (!origin) return false;

    const host = hostOf(origin);
    if (!host || IP_LITERAL.test(host)) return false;
    return origin.startsWith("https://") || host === "localhost";
}

module.exports = { rpId, rpName, origins, isUsable };
