"use strict";

const relationRepository = require("../repositories/relationRepository");
const userRepository = require("../repositories/userRepository");
const friendshipRepository = require("../repositories/friendshipRepository");
const realtime = require("../realtime");
const { BadRequest, NotFound } = require("../errors");
const { toPublicUser } = require("../domain/mappers");

async function block(user, targetUserId) {
    if (Number(targetUserId) === Number(user.userId)) throw new BadRequest("On ne peut pas se bloquer soi-même.");

    const target = await userRepository.findById(targetUserId);
    if (!target) throw new NotFound("Utilisateur introuvable.");

    await relationRepository.block(user.userId, targetUserId);

    const friendships = await friendshipRepository.listForUser(user.userId);
    const existing = friendships.find((row) => Number(row.userId) === Number(targetUserId));
    if (existing) await friendshipRepository.remove(existing.friendshipId).catch(() => {});

    realtime.emitToUser(Number(user.userId), "relation:blocked", { userId: Number(targetUserId) });
    return listBlocked(user);
}

async function unblock(user, targetUserId) {
    const removed = await relationRepository.unblock(user.userId, targetUserId);
    if (!removed) throw new NotFound("Cet utilisateur n'est pas bloqué.");
    realtime.emitToUser(Number(user.userId), "relation:unblocked", { userId: Number(targetUserId) });
    return listBlocked(user);
}

async function listBlocked(user) {
    const rows = await relationRepository.listBlocked(user.userId);
    return rows.map((row) => ({ ...toPublicUser(row), blockedAt: row.createdAt }));
}

async function isBlocked(a, b) {
    if (Number(a) === Number(b)) return false;
    return relationRepository.isBlockedEitherWay(a, b);
}

async function blockedIds(userId) {
    return relationRepository.listBlockedIds(userId);
}

async function setNote(user, subjectId, body) {
    const text = (body ?? "").trim();
    if (Number(subjectId) === Number(user.userId)) throw new BadRequest("Une note se prend sur quelqu'un d'autre.");

    if (text.length === 0) {
        await relationRepository.deleteNote(user.userId, subjectId);
        return { note: null };
    }

    await relationRepository.upsertNote(user.userId, subjectId, text.slice(0, 500));
    return getNote(user, subjectId);
}

async function getNote(user, subjectId) {
    const row = await relationRepository.findNote(user.userId, subjectId);
    return { note: row ? { body: row.body, updatedAt: row.updatedAt } : null };
}

module.exports = { block, unblock, listBlocked, isBlocked, blockedIds, setNote, getNote };
