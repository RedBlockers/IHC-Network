"use strict";

const userRepository = require("../repositories/userRepository");
const sessionRepository = require("../repositories/sessionRepository");
const loginHistoryRepository = require("../repositories/loginHistoryRepository");
const organisationRepository = require("../repositories/organisationRepository");
const notificationSettingsRepository = require("../repositories/notificationSettingsRepository");
const guildRepository = require("../repositories/guildRepository");
const passwordService = require("./passwordService");
const mailService = require("./mailService");
const { BadRequest, Conflict, Unauthorized } = require("../errors");
const { logger, serializeError } = require("../logger");

const GRACE_DAYS = 30;
const POLICY_VERSION = "2026-08-01";

const deadlineOf = (requestedAt) => new Date(new Date(requestedAt).getTime() + GRACE_DAYS * 24 * 3600 * 1000);

async function requestDeletion(user, password, currentHash) {
    if (!(await passwordService.verify(currentHash, password))) {
        throw new Unauthorized("Mot de passe incorrect.");
    }
    const owned = await guildRepository.countOwnedByUser(user.userId);
    if (Number(owned?.total) > 0)
        throw new Conflict("Transférez ou supprimez vos communautés avant de supprimer votre compte.");

    const { affectedRows } = await userRepository.requestDeletion(user.userId);
    if (!affectedRows) throw new Conflict("Une suppression est déjà programmée.");

    await sessionRepository.revokeAllExceptFamily(user.userId, null).catch(() => {});

    const at = new Date();
    await mailService
        .sendDeletionScheduled(user, { deadline: deadlineOf(at) })
        .catch((error) => logger.warn("avis de suppression non envoyé", { error: serializeError(error) }));

    return { deletionRequestedAt: at, deletionAt: deadlineOf(at), graceDays: GRACE_DAYS };
}

async function cancelDeletion(user) {
    await userRepository.cancelDeletion(user.userId);
    return { deletionRequestedAt: null };
}

async function purgeIfDue(userRow, now = Date.now()) {
    if (!userRow?.deletionRequestedAt) return false;
    if (deadlineOf(userRow.deletionRequestedAt).getTime() > now) return false;

    await userRepository.hardDelete(userRow.userId);
    logger.info("compte effacé après son délai d'annulation", { userId: Number(userRow.userId) });
    return true;
}

async function purgeExpired() {
    const users = await userRepository.findDueDeletions();
    for (const user of users) await purgeIfDue(user);
    return users.length;
}

async function exportData(user) {
    const [sessions, history, folders, guildPrefs, channelPrefs, notificationSettings, guildIds] = await Promise.all([
        sessionRepository.listActiveForUser(user.userId).catch(() => []),
        loginHistoryRepository.listForUser(user.userId, 100).catch(() => []),
        organisationRepository.listFolders(user.userId).catch(() => []),
        organisationRepository.listGuildPrefs(user.userId).catch(() => []),
        organisationRepository.listChannelPrefs(user.userId).catch(() => []),
        notificationSettingsRepository.listForUser(user.userId).catch(() => []),
        guildRepository.listIdsForUser(user.userId).catch(() => []),
    ]);

    return {
        exportedAt: new Date().toISOString(),
        notice:
            "Cet export contient votre compte et vos préférences. Les messages des conversations ne sont pas inclus. " +
            "Demandez-les au responsable de la communauté concernée.",
        account: {
            handle: user.handle,
            displayName: user.displayName,
            email: user.email,
            createdAt: user.createdAt,
            aboutMe: user.aboutMe,
            policyVersion: user.policyVersion ?? null,
            policyAcceptedAt: user.policyAcceptedAt ?? null,
        },
        preferences: {
            theme: user.themePreference,
            density: user.densityPreference,
            accent: user.accentPreference,
            reduceMotion: Boolean(user.reduceMotion),
            highContrast: Boolean(user.highContrast),
        },
        communities: guildIds.map((row) => Number(row.guildId)),
        organisation: {
            folders: folders.map((row) => ({ name: row.name, color: row.color, position: Number(row.position) })),
            guilds: guildPrefs.map((row) => ({
                guildId: Number(row.guildId),
                folderId: row.folderId == null ? null : Number(row.folderId),
                isFavorite: Boolean(row.isFavorite),
            })),
            favoriteChannels: channelPrefs.map((row) => Number(row.channelId)),
        },
        notificationSettings: notificationSettings.map((row) => ({
            scope: row.scope,
            targetId: Number(row.targetId),
            level: row.level,
        })),
        devices: sessions.map((row) => ({
            deviceLabel: row.deviceLabel,
            createdAt: row.createdAt,
            lastSeenAt: row.lastSeenAt,
        })),
        loginHistory: history.map((row) => ({
            outcome: row.outcome,
            deviceLabel: row.deviceLabel,
            at: row.createdAt,
        })),
    };
}

async function acceptPolicy(user, version) {
    if (version !== POLICY_VERSION) {
        throw new BadRequest("Cette version de la politique n'est plus celle en vigueur.");
    }
    await userRepository.acceptPolicy(user.userId, version);
    return { policyVersion: version, policyAcceptedAt: new Date() };
}

function policyStatus(user) {
    return {
        currentVersion: POLICY_VERSION,
        acceptedVersion: user.policyVersion ?? null,
        acceptedAt: user.policyAcceptedAt ?? null,
        upToDate: user.policyVersion === POLICY_VERSION,
    };
}

module.exports = {
    requestDeletion,
    cancelDeletion,
    purgeIfDue,
    purgeExpired,
    exportData,
    acceptPolicy,
    policyStatus,
    deadlineOf,
    GRACE_DAYS,
    POLICY_VERSION,
};
