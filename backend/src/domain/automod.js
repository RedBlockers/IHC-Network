"use strict";

const LEET = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", 8: "b", $: "s", "@": "a" };

function normalize(text) {
    return String(text ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[0135784$@]/g, (char) => LEET[char] ?? char)
        .replace(/(.)\1+/g, "$1")
        .replace(/[^a-z0-9\s.:/_-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function matchWord(haystack, term) {
    const normalized = normalize(term);
    if (normalized.length === 0) return null;
    const pattern = new RegExp(`(?:^|\\s)${escape(normalized).replace(/\s+/g, "\\s+")}(?:$|\\s)`, "i");
    return pattern.test(haystack) ? normalized : null;
}

const HOST = /\b(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?:[/?#][^\s]*)?/gi;

function hostsIn(text) {
    const found = new Set();
    for (const match of String(text ?? "").matchAll(HOST)) {
        found.add(match[1].toLowerCase().replace(/\.$/, ""));
    }
    return [...found];
}

function matchDomain(text, domain) {
    const target = String(domain ?? "").trim().toLowerCase().replace(/^\*?\./, "");
    if (target.length === 0) return null;
    return hostsIn(text).find((host) => host === target || host.endsWith(`.${target}`)) ?? null;
}

function evaluate(content, config = {}) {
    const haystack = normalize(content);

    for (const term of config.blockedWords ?? []) {
        const hit = matchWord(haystack, term);
        if (hit) {
            return {
                rule: "words",
                match: hit,
                reason: `Le message contient un terme filtré par la communauté (« ${term.trim()} »).`,
            };
        }
    }

    for (const domain of config.blockedDomains ?? []) {
        const hit = matchDomain(content, domain);
        if (hit) {
            return {
                rule: "domains",
                match: hit,
                reason: `Le message renvoie vers un domaine filtré par la communauté (${hit}).`,
            };
        }
    }

    return null;
}

function evaluateRate(count, { spamMessages, spamSeconds } = {}) {
    if (!spamMessages || !spamSeconds) return null;
    if (count <= spamMessages) return null;
    return {
        rule: "spam",
        match: String(count),
        reason: `Plus de ${spamMessages} messages en ${spamSeconds} secondes.`,
    };
}

function evaluateRaid(count, { raidJoins, raidSeconds } = {}) {
    if (!raidJoins || !raidSeconds) return null;
    if (count <= raidJoins) return null;
    return {
        rule: "raid",
        match: String(count),
        reason: `Plus de ${raidJoins} arrivées en ${raidSeconds} secondes.`,
    };
}

const parseList = (text) =>
    String(text ?? "")
        .split(/[\n,]/)
        .map((line) => line.trim())
        .filter(Boolean);

module.exports = { evaluate, evaluateRate, evaluateRaid, normalize, hostsIn, parseList };
