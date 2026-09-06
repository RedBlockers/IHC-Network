"use strict";

const moderationRepository = require("../repositories/moderationRepository");
const roleRepository = require("../repositories/roleRepository");
const guildRepository = require("../repositories/guildRepository");
const notificationService = require("./notificationService");
const realtime = require("../realtime");
const { withTransaction } = require("../db/pool");
const { BadRequest, Forbidden, NotFound } = require("../errors");

const APPEAL_WINDOW_DAYS = 14;
const MAX_TIMEOUT_MINUTES = 60 * 24 * 28;

const PERMISSION_FOR = { kick: "KICK_MEMBERS", ban: "BAN_MEMBERS", timeout: "MODERATE_MEMBERS" };

const toSanction = (row) => ({
    sanctionId: Number(row.sanctionId),
    guildId: Number(row.guildId),
    userId: Number(row.userId),
    type: row.type,
    reason: row.reason,
    issuedBy: Number(row.issuedBy),
    issuedAt: row.issuedAt,
    expiresAt: row.expiresAt ?? null,
    revokedAt: row.revokedAt ?? null,
    revokedBy: row.revokedBy == null ? null : Number(row.revokedBy),
    revokeReason: row.revokeReason ?? null,
    appeal: row.appealedAt ? { text: row.appealText, at: row.appealedAt } : null,
    appealDeadline: new Date(new Date(row.issuedAt).getTime() + APPEAL_WINDOW_DAYS * 86_400_000),
});

const toAuditEntry = (row) => ({
    entryId: Number(row.entryId),
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId ?? null,
    reason: row.reason ?? null,
    createdAt: row.createdAt,
    actor: row.actorId == null ? null : {
        userId: Number(row.actorId),
        handle: row.actorHandle,
        displayName: row.actorDisplayName,
        avatar: row.actorAvatar,
    },
});

async function requireAuthority(guild, actor, targetUserId) {
    if (Number(targetUserId) === Number(actor.userId)) {
        throw new BadRequest("Une sanction ne peut pas viser son auteur.");
    }
    if (Number(targetUserId) === Number(guild.ownerId)) {
        throw new Forbidden("Le propriétaire de la communauté ne peut pas être sanctionné.");
    }
    if (Number(guild.ownerId) === Number(actor.userId)) return;

    const [actorPosition, targetPosition] = await Promise.all([
        roleRepository.highestPositionForMember(guild.guildId, actor.userId),
        roleRepository.highestPositionForMember(guild.guildId, targetUserId),
    ]);
    if (targetPosition >= actorPosition) {
        throw new Forbidden("Vous ne pouvez sanctionner que les membres situés sous votre rôle le plus élevé.");
    }
}

async function sanction(guild, actor, targetUserId, { type, reason, durationMinutes = null }) {
    const motive = (reason ?? "").trim();
    if (motive.length === 0) throw new BadRequest("Une sanction exige un motif.");
    if (!PERMISSION_FOR[type]) throw new BadRequest("Type de sanction inconnu.");

    await requireAuthority(guild, actor, targetUserId);

    if (type === "timeout") {
        if (!durationMinutes || durationMinutes < 1 || durationMinutes > MAX_TIMEOUT_MINUTES) {
            throw new BadRequest("Un timeout exige une durée comprise entre 1 minute et 28 jours.");
        }
    }

    const expiresAt = type === "timeout" ? new Date(Date.now() + durationMinutes * 60_000) : null;

    const sanctionId = await withTransaction(async (connection) => {
        const id = await moderationRepository.createSanction(
            { guildId: guild.guildId, userId: targetUserId, type, reason: motive, issuedBy: actor.userId, expiresAt },
            connection
        );
        await moderationRepository.appendAudit(
            {
                guildId: guild.guildId,
                actorId: actor.userId,
                action: `member.${type}`,
                targetType: "user",
                targetId: String(targetUserId),
                reason: motive,
            },
            connection
        );
        if (type !== "timeout") await guildRepository.removeMember(guild.guildId, targetUserId, connection);
        return id;
    });

    const row = await moderationRepository.findSanction(guild.guildId, sanctionId);
    const result = toSanction(row);

    await notificationService.createForUser({
        userId: Number(targetUserId),
        actorId: Number(actor.userId),
        type: "sanction",
        channelId: null,
        messageId: null,
    });
    realtime.emitToUser(Number(targetUserId), "moderation:sanction", {
        guildId: Number(guild.guildId),
        guildName: guild.name,
        type,
        reason: motive,
        expiresAt,
        appealDeadline: result.appealDeadline,
    });
    realtime.emitToGuild(Number(guild.guildId), "moderation:audit", { action: `member.${type}` });

    return result;
}

async function revoke(guild, actor, sanctionId, reason) {
    const motive = (reason ?? "").trim();
    if (motive.length === 0) throw new BadRequest("La levée d'une sanction exige un motif.");

    const existing = await moderationRepository.findSanction(guild.guildId, sanctionId);
    if (!existing) throw new NotFound("Sanction introuvable.");

    await withTransaction(async (connection) => {
        const revoked = await moderationRepository.revokeSanction(
            guild.guildId,
            sanctionId,
            { revokedBy: actor.userId, reason: motive },
            connection
        );
        if (!revoked) throw new BadRequest("Cette sanction est déjà levée.");
        await moderationRepository.appendAudit(
            {
                guildId: guild.guildId,
                actorId: actor.userId,
                action: "sanction.revoke",
                targetType: "sanction",
                targetId: String(sanctionId),
                reason: motive,
            },
            connection
        );
    });

    realtime.emitToUser(Number(existing.userId), "moderation:revoked", {
        guildId: Number(guild.guildId),
        sanctionId: Number(sanctionId),
        reason: motive,
    });
    return toSanction(await moderationRepository.findSanction(guild.guildId, sanctionId));
}

async function appeal(guildId, user, sanctionId, text) {
    const body = (text ?? "").trim();
    if (body.length === 0) throw new BadRequest("Une contestation ne peut pas être vide.");

    const existing = await moderationRepository.findSanction(guildId, sanctionId);
    if (!existing || Number(existing.userId) !== Number(user.userId)) throw new NotFound("Sanction introuvable.");
    if (existing.appealedAt) throw new BadRequest("Cette sanction a déjà été contestée.");

    const deadline = new Date(new Date(existing.issuedAt).getTime() + APPEAL_WINDOW_DAYS * 86_400_000);
    if (Date.now() > deadline.getTime()) throw new BadRequest("Le délai de contestation de 14 jours est dépassé.");

    const recorded = await moderationRepository.recordAppeal(guildId, sanctionId, user.userId, body);
    if (!recorded) throw new BadRequest("Cette sanction a déjà été contestée.");

    await moderationRepository.appendAudit({
        guildId,
        actorId: user.userId,
        action: "sanction.appeal",
        targetType: "sanction",
        targetId: String(sanctionId),
        reason: body.slice(0, 500),
    });
    realtime.emitToGuild(Number(guildId), "moderation:appeal", { sanctionId: Number(sanctionId) });

    return toSanction(await moderationRepository.findSanction(guildId, sanctionId));
}

async function memberRecord(guildId, userId) {
    const [sanctions, notes] = await Promise.all([
        moderationRepository.listSanctionsForMember(guildId, userId),
        moderationRepository.listNotes(guildId, userId),
    ]);
    return {
        sanctions: sanctions.map(toSanction),
        notes: notes.map((row) => ({
            noteId: Number(row.noteId),
            body: row.body,
            createdAt: row.createdAt,
            author: { userId: Number(row.authorId), handle: row.authorHandle, displayName: row.authorDisplayName },
        })),
    };
}

async function addNote(guildId, actor, userId, body) {
    const text = (body ?? "").trim();
    if (text.length === 0) throw new BadRequest("Une note ne peut pas être vide.");
    await moderationRepository.createNote({ guildId, userId, authorId: actor.userId, body: text });
    await moderationRepository.appendAudit({
        guildId,
        actorId: actor.userId,
        action: "member.note",
        targetType: "user",
        targetId: String(userId),
        reason: null,
    });
    return memberRecord(guildId, userId);
}

async function auditLog(guildId, { limit = 50, action = null } = {}) {
    const rows = await moderationRepository.listAudit(guildId, { limit: Math.min(Math.max(limit, 1), 200), action });
    return rows.map(toAuditEntry);
}

async function isTimedOut(guildId, userId) {
    const active = await moderationRepository.findActiveSanction(guildId, userId, "timeout");
    return Boolean(active);
}

async function isBanned(guildId, userId) {
    const active = await moderationRepository.findActiveSanction(guildId, userId, "ban");
    return Boolean(active);
}

module.exports = {
    sanction,
    revoke,
    appeal,
    memberRecord,
    addNote,
    auditLog,
    isTimedOut,
    isBanned,
    PERMISSION_FOR,
    APPEAL_WINDOW_DAYS,
};
