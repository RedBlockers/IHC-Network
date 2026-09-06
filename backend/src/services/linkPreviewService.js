"use strict";

const dns = require("node:dns/promises");
const net = require("node:net");

const urlGuard = require("../domain/urlGuard");
const cacheService = require("./cacheService");
const { BadRequest } = require("../errors");
const { logger, serializeError } = require("../logger");

const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 3;
const CACHE_SECONDS = 6 * 3600;
const FAILURE_CACHE_SECONDS = 600;

async function assertReachable(url) {
    const inspection = urlGuard.inspect(url);
    if (!inspection.ok) throw new BadRequest(`Lien refusé : ${inspection.reason}.`);

    const { hostname } = inspection.url;
    if (net.isIP(hostname)) return inspection.url;

    let resolved;
    try {
        resolved = await dns.lookup(hostname, { all: true });
    } catch {
        throw new BadRequest("Lien refusé : nom introuvable.");
    }
    if (!urlGuard.allPublic(resolved)) throw new BadRequest("Lien refusé : adresse interne.");

    return inspection.url;
}

async function readCapped(response) {
    const reader = response.body?.getReader?.();
    if (!reader) return "";

    const chunks = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        chunks.push(value);
        if (total >= MAX_BYTES) {
            await reader.cancel().catch(() => {});
            break;
        }
    }
    return Buffer.concat(chunks.map(Buffer.from)).toString("utf8");
}

const decode = (value) =>
    String(value ?? "")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .trim()
        .slice(0, 300);

function extract(html, url) {
    const meta = (property) => {
        const pattern = new RegExp(
            `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']`,
            "i"
        );
        const reversed = new RegExp(
            `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["']`,
            "i"
        );
        return pattern.exec(html)?.[1] ?? reversed.exec(html)?.[1] ?? null;
    };

    const title = meta("og:title") ?? meta("twitter:title") ?? /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ?? null;
    const image = meta("og:image") ?? meta("twitter:image") ?? null;

    return {
        url: url.toString(),
        site: decode(meta("og:site_name")) || url.hostname,
        title: decode(title) || null,
        description: decode(meta("og:description") ?? meta("description")) || null,
        image: image && /^https?:\/\//i.test(image) ? image.slice(0, 500) : null,
    };
}

async function preview(rawUrl) {
    const key = `link:${rawUrl}`;
    const cached = await cacheService.get(key).catch(() => null);
    if (cached) return cached;

    let result;
    try {
        let target = await assertReachable(rawUrl);

        let response;
        for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
            response = await fetch(target, {
                redirect: "manual",
                signal: AbortSignal.timeout(TIMEOUT_MS),
                headers: { "user-agent": "Qweillo/1.0 (aperçu de lien)", accept: "text/html" },
            });

            if (response.status < 300 || response.status >= 400) break;
            const location = response.headers.get("location");
            if (!location) break;
            target = await assertReachable(new URL(location, target).toString());
            if (hop === MAX_REDIRECTS) throw new BadRequest("Lien refusé : trop de redirections.");
        }

        if (!response.ok) throw new BadRequest("La page n'a pas répondu.");
        if (!/text\/html/i.test(response.headers.get("content-type") ?? "")) {
            result = { url: target.toString(), site: target.hostname, title: null, description: null, image: null };
        } else {
            result = extract(await readCapped(response), target);
        }
    } catch (error) {
        if (error instanceof BadRequest) throw error;
        logger.warn("aperçu de lien indisponible", { error: serializeError(error) });
        result = { url: rawUrl, site: null, title: null, description: null, image: null, unavailable: true };
        await cacheService.set(key, result, FAILURE_CACHE_SECONDS).catch(() => {});
        return result;
    }

    await cacheService.set(key, result, CACHE_SECONDS).catch(() => {});
    return result;
}

module.exports = { preview, extract, assertReachable, MAX_BYTES, TIMEOUT_MS };
