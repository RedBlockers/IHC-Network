"use strict";

const crypto = require("node:crypto");

const { Unauthorized, Conflict, TooManyRequests, BadRequest, NotFound } = require("../errors");
const { withTransaction, DUPLICATE_ENTRY } = require("../db/pool");
const userRepository = require("../repositories/userRepository");
const loginAttemptRepository = require("../repositories/loginAttemptRepository");
const loginHistoryRepository = require("../repositories/loginHistoryRepository");
const twoFactorService = require("./twoFactorService");
const webauthnService = require("./webauthnService");
const mailService = require("./mailService");
const emailVerificationService = require("./emailVerificationService");
const sessionRepository = require("../repositories/sessionRepository");
const lockoutService = require("./lockoutService");
const storageService = require("./storageService");
const passwordService = require("./passwordService");
const sessionService = require("./sessionService");
const { logger, serializeError } = require("../logger");

const DEFAULT_AVATAR = "/assets/default-avatar.png";

const hashIp = (ip) => (ip ? crypto.createHash("sha256").update(String(ip)).digest("hex") : null);

async function register({ handle, email, password, displayName, bio, avatarBuffer, sessionContext }) {
    const passwordHash = await passwordService.hash(password);

    try {
        const result = await withTransaction(async (connection) => {
            const user = await userRepository.create(
                {
                    handle,
                    displayName: displayName ?? handle,
                    email,
                    password: passwordHash,
                    avatar: DEFAULT_AVATAR,
                    aboutMe: bio,
                },
                connection
            );

            if (avatarBuffer) {
                const avatarUrl = await storageService.saveAvatar(user.userId, avatarBuffer);
                if (avatarUrl) {
                    await userRepository.updateAvatar(user.userId, avatarUrl, connection);
                    user.avatar = avatarUrl;
                }
            }

            return sessionService.issue(user, sessionContext, connection);
        });
        if (mailService.smtpConfigured()) {
            emailVerificationService
                .sendVerification(result.user)
                .catch((error) =>
                    logger.warn("échec d’envoi de la vérification d’adresse", { error: serializeError(error) })
                );
        }
        return result;
    } catch (error) {
        if (error.code === DUPLICATE_ENTRY) {
            throw new Conflict("Un compte utilise déjà ce pseudo ou cette adresse email.");
        }
        throw error;
    }
}

async function login({ handle, password, code, recoveryCode, ip, sessionContext }) {
    if (await lockoutService.isLocked(ip, handle)) {
        throw new TooManyRequests("Trop de tentatives de connexion. Réessayez dans quelques minutes.");
    }

    const user = await userRepository.findByIdentifierWithSecret(handle);
    const passwordOk = user
        ? await passwordService.verify(user.password, password)
        : await passwordService.verifyUnknown(password);

    if (!user || !passwordOk) {
        await lockoutService.recordFailure(ip, handle);
        loginAttemptRepository
            .record(ip, handle)
            .catch((error) => logger.warn("échec d'écriture d'audit de connexion", { error: serializeError(error) }));
        if (user) {
            loginHistoryRepository
                .record({
                    userId: user.userId,
                    outcome: "failure",
                    deviceLabel: sessionService.deviceLabel(sessionContext?.userAgent),
                    ipHash: hashIp(ip),
                })
                .catch(() => {});
        }
        throw new Unauthorized("Identifiant ou mot de passe incorrect.");
    }

    const second = await twoFactorService.verifySecondFactor(user.userId, { code, recoveryCode });
    if (!second.ok) {
        await lockoutService.recordFailure(ip, handle);
        loginAttemptRepository
            .record(ip, handle)
            .catch((error) => logger.warn("échec d'écriture d'audit de connexion", { error: serializeError(error) }));
        loginHistoryRepository
            .record({
                userId: user.userId,
                outcome: "failure",
                deviceLabel: sessionService.deviceLabel(sessionContext?.userAgent),
                ipHash: hashIp(ip),
            })
            .catch(() => {});

        throw new Unauthorized("Code de vérification requis ou incorrect.", {
            details: { twoFactorRequired: true },
        });
    }

    await lockoutService.clear(ip, handle);

    if (passwordService.needsRehash(user.password)) {
        await userRepository.updatePasswordHash(user.userId, await passwordService.hash(password));
    }

    delete user.password;
    notifyNewDevice(user, sessionContext, ip).catch(() => {});
    loginHistoryRepository
        .record({
            userId: user.userId,
            outcome: "success",
            deviceLabel: sessionService.deviceLabel(sessionContext?.userAgent),
            ipHash: hashIp(ip),
        })
        .catch(() => {});
    return sessionService.issue(user, sessionContext);
}

async function loginWithSecurityKey({ response, ip, sessionContext }) {
    if (await lockoutService.isLocked(ip, "webauthn")) {
        throw new TooManyRequests("Trop de tentatives de connexion. Réessayez dans quelques minutes.");
    }

    let user;
    try {
        user = await webauthnService.verifyLogin(response);
    } catch (error) {
        await lockoutService.recordFailure(ip, "webauthn");
        loginAttemptRepository.record(ip, "webauthn").catch(() => {});
        throw error;
    }

    if (user.isBanned && (!user.bannedUntil || new Date(user.bannedUntil) > new Date())) {
        throw new Unauthorized("Ce compte est suspendu.");
    }

    await lockoutService.clear(ip, "webauthn");
    delete user.password;

    notifyNewDevice(user, sessionContext, ip).catch(() => {});
    loginHistoryRepository
        .record({
            userId: user.userId,
            outcome: "success",
            deviceLabel: sessionService.deviceLabel(sessionContext?.userAgent),
            ipHash: hashIp(ip),
        })
        .catch(() => {});

    return sessionService.issue(user, sessionContext);
}

async function changePassword(user, { currentPassword, newPassword }, { familyId } = {}) {
    const row = await userRepository.findByHandleWithSecret(user.handle);
    if (!row || !(await passwordService.verify(row.password, currentPassword))) {
        throw new Unauthorized("Mot de passe actuel incorrect.");
    }
    if (currentPassword === newPassword) {
        throw new BadRequest("Le nouveau mot de passe doit être différent de l'actuel.");
    }

    await userRepository.updatePasswordHash(user.userId, await passwordService.hash(newPassword));
    const revoked = familyId ? await sessionRepository.revokeAllExceptFamily(user.userId, familyId) : 0;
    return { revokedSessions: revoked };
}

async function listDevices(user, currentSessionId) {
    const rows = await sessionRepository.listActiveForUser(user.userId);
    return rows.map((row) => ({
        sessionId: row.sessionId,
        label: row.deviceLabel || "Appareil inconnu",
        createdAt: row.createdAt,
        lastUsedAt: row.lastUsedAt ?? null,
        expiresAt: row.expiresAt,
        current: row.sessionId === currentSessionId,
    }));
}

async function revokeDevice(user, sessionId) {
    const row = await sessionRepository.findForUser(user.userId, sessionId);
    if (!row) throw new NotFound("Appareil introuvable.");
    await sessionRepository.revokeFamily(row.familyId);
}

async function revokeOtherDevices(user, familyId) {
    return { revokedSessions: await sessionRepository.revokeAllExceptFamily(user.userId, familyId) };
}

async function notifyNewDevice(user, sessionContext, ip) {
    const deviceLabel = sessionService.deviceLabel(sessionContext?.userAgent);
    const seen = await loginHistoryRepository.hasSucceededOn(user.userId, deviceLabel);
    if (seen) return;

    await mailService
        .sendNewDeviceAlert(user, { deviceLabel, at: new Date(), ipHash: hashIp(ip) })
        .catch((error) => logger.warn("alerte de connexion non envoyée", { error: serializeError(error) }));
}

async function loginHistory(user, limit = 30) {
    const rows = await loginHistoryRepository.listForUser(user.userId, Math.min(Math.max(limit, 1), 100));
    return rows.map((row) => ({
        entryId: Number(row.entryId),
        outcome: row.outcome,
        label: row.deviceLabel || "Appareil inconnu",
        createdAt: row.createdAt,
    }));
}

async function isHandleAvailable(handle) {
    return !(await userRepository.existsByHandle(handle));
}

module.exports = {
    loginWithSecurityKey,
    notifyNewDevice,
    register,
    login,
    isHandleAvailable,
    changePassword,
    listDevices,
    revokeDevice,
    revokeOtherDevices,
    loginHistory,
};
