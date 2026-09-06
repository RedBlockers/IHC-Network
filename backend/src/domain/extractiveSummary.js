"use strict";

const tokenize = (text) =>
    String(text ?? "")
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .split(/[^a-z0-9àâäéèêëïîôùûüç]+/i)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3);

function summarize(texts, { maxSentences = 5 } = {}) {
    const usable = texts
        .map((text) => String(text ?? "").trim())
        .filter((text) => text && !text.startsWith("QW1:") && !text.startsWith("qw1:"));
    if (usable.length === 0) return { method: "extractive", body: "", messageCount: 0 };

    const freq = new Map();
    for (const text of usable) {
        for (const token of new Set(tokenize(text))) freq.set(token, (freq.get(token) ?? 0) + 1);
    }

    const sentences = usable
        .flatMap((text) => text.split(/(?<=[.!?])\s+/))
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence.length >= 20);

    const scored = sentences.map((sentence) => {
        const tokens = tokenize(sentence);
        const score = tokens.reduce((sum, token) => sum + (freq.get(token) ?? 0), 0) / Math.max(tokens.length, 1);
        return { sentence, score };
    });
    scored.sort((left, right) => right.score - left.score);

    const picked = [];
    const seen = new Set();
    for (const item of scored) {
        if (seen.has(item.sentence) || picked.length >= maxSentences) continue;
        seen.add(item.sentence);
        picked.push(item.sentence);
    }

    return { method: "extractive", body: picked.join(" "), messageCount: usable.length };
}

module.exports = { tokenize, summarize, METHOD: "extractive" };
