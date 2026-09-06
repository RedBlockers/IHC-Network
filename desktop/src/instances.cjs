"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { resolveEndpoint } = require("./security.cjs");

function instanceEndpoint(value) {
    return resolveEndpoint({ configuredUrl: value, isPackaged: false });
}

function partitionFor(endpoint) {
    return `persist:qweillo-${crypto.createHash("sha256").update(instanceEndpoint(endpoint)).digest("hex").slice(0, 24)}`;
}

function readInstances(directory) {
    try {
        const saved = JSON.parse(fs.readFileSync(path.join(directory, "instances.json"), "utf8"));
        const entries = Array.isArray(saved.entries)
            ? saved.entries
                  .flatMap((entry) => {
                      try {
                          return [
                              {
                                  origin: instanceEndpoint(entry.origin),
                                  name: String(entry.name || new URL(entry.origin).host).slice(0, 80),
                              },
                          ];
                      } catch {
                          return [];
                      }
                  })
                  .slice(0, 8)
            : [];
        let active = null;
        try {
            if (saved.active) active = instanceEndpoint(saved.active);
        } catch {}
        return { active, entries };
    } catch {
        return { active: null, entries: [] };
    }
}

function rememberInstance(directory, value) {
    const endpoint = instanceEndpoint(value);
    const previous = readInstances(directory);
    const entries = [
        { origin: endpoint, name: new URL(endpoint).host },
        ...previous.entries.filter((entry) => entry.origin !== endpoint),
    ].slice(0, 8);
    fs.mkdirSync(directory, { recursive: true });
    const temporary = path.join(directory, "instances.json.tmp");
    fs.writeFileSync(temporary, JSON.stringify({ active: endpoint, entries }), { mode: 0o600 });
    fs.renameSync(temporary, path.join(directory, "instances.json"));
    return entries;
}

module.exports = { instanceEndpoint, partitionFor, readInstances, rememberInstance };
