"use strict";

const crypto = require("node:crypto");

const accessTokenRepository = require("../repositories/accessTokenRepository");
const cacheService = require("./cacheService");
const { BadRequest, NotFound, Unauthorized } = require("../errors");

const PREFIX = "qwp_";
const MAX_ACTIVE = 20;
const TOUCH_INTERVAL_MS = 60_000;

const hash = (token) => crypto.createHash("sha256").update(token).digest("hex");

const toPublic = (row) => ({
    tokenId: Number(row.tokenId),
    label: row.label,
    prefix: row.prefix,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt ?? null,
    expiresAt: row.expiresAt ?? null,
});

const isAccessToken = (value) => typeof value === "string" && value.startsWith(PREFIX);

async function issue(user, { label, expiresInDays } = {}) {
    if (!label || !label.trim()) throw new BadRequest("Donnez un nom au jeton.");
    if ((await accessTokenRepository.countActive(user.userId)) >= MAX_ACTIVE) {
        throw new BadRequest(`Vous avez déjà ${MAX_ACTIVE} jetons actifs. Révoquez-en un avant d'en créer un autre.`);
    }
    const token = `${PREFIX}${crypto.randomBytes(30).toString("base64url")}`;
    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 86_400_000) : null;
    const tokenId = await accessTokenRepository.create({
        userId: user.userId,
        label: label.trim().slice(0, 80),
        prefix: token.slice(0, 12),
        tokenHash: hash(token),
        expiresAt,
    });
    const row = (await accessTokenRepository.findById(tokenId)) ?? {
        tokenId,
        label: label.trim().slice(0, 80),
        prefix: token.slice(0, 12),
        createdAt: new Date(),
        expiresAt,
    };
    return { token, item: toPublic(row) };
}

async function list(user) {
    const rows = await accessTokenRepository.listByUser(user.userId);
    return rows.map(toPublic);
}

async function revoke(user, tokenId) {
    const revoked = await accessTokenRepository.revoke(tokenId, user.userId);
    if (!revoked) throw new NotFound("Jeton introuvable.");
}

async function authenticate(token) {
    if (!isAccessToken(token)) throw new Unauthorized("Jeton invalide.");
    const row = await accessTokenRepository.findByHash(hash(token));
    if (!row || row.revokedAt) throw new Unauthorized("Jeton révoqué ou inconnu.");
    if (row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now()) throw new Unauthorized("Jeton expiré.");
    const user = await cacheService.getUserById(row.userId);
    if (!user) throw new Unauthorized("Compte introuvable.");
    const lastUsed = row.lastUsedAt ? new Date(row.lastUsedAt).getTime() : 0;
    if (Date.now() - lastUsed > TOUCH_INTERVAL_MS) {
        accessTokenRepository.touch(row.tokenId).catch(() => {});
    }
    return { user, payload: { userId: Number(user.userId), kind: "token", tokenId: Number(row.tokenId) } };
}

module.exports = { PREFIX, MAX_ACTIVE, isAccessToken, issue, list, revoke, authenticate };
