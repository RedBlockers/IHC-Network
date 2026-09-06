"use strict";

const fs = require("node:fs");

const config = require("../config");

const CACHE_MS = 1000;

let cache = { at: 0, state: null };

function read() {
    const path = config.MAINTENANCE_FILE;
    if (!path) return null;

    try {
        const reason = fs.readFileSync(path, "utf8").trim();
        return {
            active: true,
            reason: reason || "Le service est en maintenance. Il revient d'ici peu.",
        };
    } catch {
        return null;
    }
}

function state({ now = Date.now() } = {}) {
    if (now - cache.at < CACHE_MS) return cache.state;
    cache = { at: now, state: read() };
    return cache.state;
}

const forget = () => {
    cache = { at: 0, state: null };
};

module.exports = { state, forget, CACHE_MS };
