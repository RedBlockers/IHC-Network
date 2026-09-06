"use strict";

const tokenize = (text) =>
    String(text ?? "")
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 2);

const scoreText = (text, tokens) => {
    if (!tokens.length) return 0;
    const hay = String(text ?? "").toLowerCase();
    if (!hay || hay.startsWith("qw1:")) return 0;
    const hits = tokens.filter((token) => hay.includes(token)).length;
    return hits / tokens.length;
};

const rank = (rows, tokens, limit) =>
    rows
        .map((row) => ({ row, score: scoreText(row.content, tokens) }))
        .filter((item) => item.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, limit);

module.exports = { tokenize, scoreText, rank, METHOD: "lexical-overlap" };
