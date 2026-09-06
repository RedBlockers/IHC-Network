"use strict";

const crypto = require("node:crypto");

const emailTokenRepository = require("../repositories/emailTokenRepository");
const userRepository = require("../repositories/userRepository");
const sessionRepository = require("../repositories/sessionRepository");
const passwordService = require("./passwordService");
const mailService = require("./mailService");
const { withTransaction } = require("../db/pool");
const { BadRequest, TooManyRequests, ServiceUnavailable } = require("../errors");

const VERIFY_TTL_HOURS = 24;
const RESET_TTL_HOURS = 1;
const MAX_PER_HOUR = 5;

const newToken = () => crypto.randomBytes(32).toString("base64url");
const digest = (token) => crypto.createHash("sha256").update(token).digest("hex");

async function issue(user, purpose, ttlHours) {
    const { total } = await emailTokenRepository.countRecent(user.userId, purpose, 60);
    if (Number(total) >= MAX_PER_HOUR) {
        throw new TooManyRequests("Trop de demandes. Réessayez dans une heure.");
    }

    const token = newToken();
    await withTransaction(async (connection) => {
        await emailTokenRepository.invalidatePending(user.userId, purpose, connection);
        await emailTokenRepository.create(
            {
                userId: user.userId,
                purpose,
                tokenHash: digest(token),
                email: user.email,
                expiresAt: new Date(Date.now() + ttlHours * 3_600_000),
            },
            connection
        );
    });
    return token;
}

async function consume(token, purpose) {
    const row = await emailTokenRepository.findByHash(digest(String(token ?? "")), purpose);
    if (!row || row.usedAt || new Date(row.expiresAt).getTime() < Date.now()) {
        throw new BadRequest("Ce lien n'est plus valable.");
    }

    const user = await userRepository.findById(row.userId);
    if (!user || user.email !== row.email) throw new BadRequest("Ce lien n'est plus valable.");

    const consumed = await emailTokenRepository.consume(row.tokenId);
    if (!consumed) throw new BadRequest("Ce lien n'est plus valable.");
    return user;
}

async function sendVerification(user) {
    if (user.isEmailVerified) return { alreadyVerified: true };
    const token = await issue(user, "verify", VERIFY_TTL_HOURS);
    const delivery = await mailService.sendVerification(user, token);
    return { sent: true, delivered: delivery.delivered };
}

async function verify(token) {
    const user = await consume(token, "verify");
    await userRepository.markEmailVerified(user.userId);
    return { verified: true, userId: Number(user.userId) };
}

async function requestReset(email) {
    if (!mailService.smtpConfigured())
        throw new ServiceUnavailable("La récupération par e-mail n’est pas activée sur cette instance.");
    const user = await userRepository.findByEmail(
        String(email ?? "")
            .trim()
            .toLowerCase()
    );
    if (user) {
        const token = await issue(user, "reset", RESET_TTL_HOURS).catch(() => null);
        if (token) await mailService.sendPasswordReset(user, token);
    }
    return { sent: true };
}

async function resetPassword(token, newPassword) {
    const user = await consume(token, "reset");
    await userRepository.updatePasswordHash(user.userId, await passwordService.hash(newPassword));
    const revoked = await sessionRepository.revokeAllExceptFamily(user.userId, "");
    return { reset: true, revokedSessions: revoked };
}

module.exports = {
    sendVerification,
    verify,
    requestReset,
    resetPassword,
    VERIFY_TTL_HOURS,
    RESET_TTL_HOURS,
    MAX_PER_HOUR,
};
