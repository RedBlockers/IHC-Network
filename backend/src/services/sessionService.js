"use strict";

const crypto = require("node:crypto");
const { parse } = require("cookie");

const config = require("../config");
const { Unauthorized, Forbidden } = require("../errors");
const { withTransaction } = require("../db/pool");
const sessionRepository = require("../repositories/sessionRepository");
const userRepository = require("../repositories/userRepository");
const accountLifecycleService = require("./accountLifecycleService");
const tokenService = require("./tokenService");
const { toPrivateUser } = require("../domain/mappers");

const refreshCookieName = (secure) => (secure ? "__Host-qweillo.refresh" : "qweillo.refresh");
const REFRESH_COOKIE = refreshCookieName(config.secureCookies);

const generateRefreshToken = () => crypto.randomBytes(32).toString("base64url");
const digestRefreshToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
const hashUserAgent = (value) => (value ? crypto.createHash("sha256").update(value).digest("hex") : null);

function refreshCookieOptions(secure = config.secureCookies) {
    return {
        httpOnly: true,
        secure,
        sameSite: "strict",
        path: "/",
        maxAge: config.SESSION_TTL_DAYS * 86_400_000,
    };
}

function clearCookieOptions(secure = config.secureCookies) {
    const { maxAge: _, ...options } = refreshCookieOptions(secure);
    return options;
}

function readRefreshToken(req) {
    return parse(req.headers.cookie || "")[REFRESH_COOKIE] || null;
}

function deviceLabel(userAgent = "") {
    const agent = String(userAgent);
    const platform = /Windows/i.test(agent)
        ? "Windows"
        : /Macintosh|Mac OS/i.test(agent)
          ? "macOS"
          : /Android/i.test(agent)
            ? "Android"
            : /iPhone|iPad|iOS/i.test(agent)
              ? "iOS"
              : /Linux/i.test(agent)
                ? "Linux"
                : "Appareil inconnu";
    const browser = /Edg\//i.test(agent)
        ? "Edge"
        : /Firefox\//i.test(agent)
          ? "Firefox"
          : /Chrome\//i.test(agent)
            ? "Chrome"
            : /Safari\//i.test(agent)
              ? "Safari"
              : /qweillo/i.test(agent)
                ? "Application Windows"
                : "navigateur";
    return `${platform} · ${browser}`.slice(0, 120);
}

async function currentSession(req) {
    const token = readRefreshToken(req);
    if (!token) return null;
    return sessionRepository.findByToken(digestRefreshToken(token));
}

function newSession(userId, context, familyId = crypto.randomUUID()) {
    const refreshToken = generateRefreshToken();
    return {
        refreshToken,
        record: {
            sessionId: crypto.randomUUID(),
            familyId,
            userId,
            tokenHash: digestRefreshToken(refreshToken),
            userAgentHash: hashUserAgent(context.userAgent),
            deviceLabel: deviceLabel(context.userAgent),
            expiresAt: new Date(Date.now() + config.SESSION_TTL_DAYS * 86_400_000),
        },
    };
}

function response(user, refreshToken) {
    return {
        user: toPrivateUser(user),
        token: tokenService.sign(user),
        expiresIn: config.ACCESS_TOKEN_TTL_SECONDS,
        refreshToken,
    };
}

async function issue(user, context = {}, connection) {
    if (user.deletionRequestedAt) {
        if (await accountLifecycleService.purgeIfDue(user)) throw new Unauthorized("Compte introuvable.");
        await accountLifecycleService.cancelDeletion(user);
    }
    const session = newSession(user.userId, context);
    await sessionRepository.create(session.record, connection);
    return response({ ...user, deletionRequestedAt: null }, session.refreshToken);
}

async function rotate(refreshToken, context = {}) {
    if (!refreshToken) throw new Unauthorized("Session expirée.");
    const tokenHash = digestRefreshToken(refreshToken);

    const outcome = await withTransaction(async (connection) => {
        const current = await sessionRepository.findByTokenForUpdate(tokenHash, connection);
        if (!current) return { failure: "missing" };
        if (current.revokedAt) {
            await sessionRepository.revokeFamily(current.familyId, connection);
            return { failure: "reused" };
        }
        if (new Date(current.expiresAt) <= new Date()) {
            await sessionRepository.revoke(current.sessionId, connection);
            return { failure: "expired" };
        }

        const user = await userRepository.findById(current.userId, connection);
        if (!user) return { failure: "missing" };
        if (user.isBanned && (!user.bannedUntil || new Date(user.bannedUntil) > new Date())) {
            await sessionRepository.revokeFamily(current.familyId, connection);
            return { failure: "banned" };
        }

        const next = newSession(user.userId, context, current.familyId);
        await sessionRepository.revoke(current.sessionId, connection);
        await sessionRepository.create(next.record, connection);
        return { session: response(user, next.refreshToken) };
    });

    if (outcome.failure === "reused") throw new Unauthorized("Session réutilisée. Reconnectez-vous.");
    if (outcome.failure === "banned") throw new Forbidden("Ce compte est suspendu.");
    if (outcome.failure) throw new Unauthorized("Session expirée.");
    return outcome.session;
}

async function revoke(refreshToken) {
    if (!refreshToken) return;
    await sessionRepository.revokeByHash(digestRefreshToken(refreshToken));
}

module.exports = {
    refreshCookieName,
    deviceLabel,
    currentSession,
    REFRESH_COOKIE,
    generateRefreshToken,
    digestRefreshToken,
    refreshCookieOptions,
    clearCookieOptions,
    readRefreshToken,
    issue,
    rotate,
    revoke,
};
