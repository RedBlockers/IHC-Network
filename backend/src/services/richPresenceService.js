"use strict";

const presenceRepository = require("../repositories/presenceRepository");
const friendshipRepository = require("../repositories/friendshipRepository");
const realtime = require("../realtime");
const { BadRequest, NotFound } = require("../errors");

const KINDS = ["playing", "listening", "editing", "reviewing", "meeting", "custom"];
const MAX_MINUTES = 12 * 60;
const DEFAULT_MINUTES = 60;

function allows(visibility, { isSelf, isFriend }) {
    if (isSelf) return true;
    if (visibility === "nobody") return false;
    if (visibility === "friends") return isFriend;
    return true;
}

async function setActivity(user, { kind, name, detail, context, minutes }) {
    if (!KINDS.includes(kind)) throw new BadRequest("Type d'activité inconnu.");

    const span = Math.min(Math.max(Number(minutes) || DEFAULT_MINUTES, 1), MAX_MINUTES);
    const expiresAt = new Date(Date.now() + span * 60_000);

    await presenceRepository.setActivity(user.userId, { kind, name, detail, context, expiresAt });

    const activity = { kind, name, detail: detail ?? null, context: context ?? null, startedAt: new Date() };
    realtime.emitToUser(Number(user.userId), "presence:activity", activity);
    return activity;
}

async function clearActivity(user) {
    await presenceRepository.clearActivity(user.userId);
    return { activity: null };
}

async function activityFor(viewerId, ownerId) {
    const rows = await presenceRepository.listActivities([ownerId]);
    const row = rows[0];
    if (!row) throw new NotFound("Compte introuvable.");

    const isSelf = Number(viewerId) === Number(ownerId);
    const isFriend = isSelf ? true : await areFriends(viewerId, ownerId);

    return {
        presence: allows(row.presenceVisibility, { isSelf, isFriend }) ? undefined : "offline",
        activity:
            row.kind && allows(row.activityVisibility, { isSelf, isFriend })
                ? {
                      kind: row.kind,
                      name: row.name,
                      detail: row.detail,
                      context: row.context,
                      startedAt: row.startedAt,
                  }
                : null,
    };
}

async function activitiesFor(viewerId, ownerIds) {
    if (ownerIds.length === 0) return new Map();

    const [rows, friends] = await Promise.all([
        presenceRepository.listActivities(ownerIds),
        friendSet(viewerId),
    ]);

    const visible = new Map();
    for (const row of rows) {
        const ownerId = Number(row.userId);
        const isSelf = Number(viewerId) === ownerId;
        const context = { isSelf, isFriend: isSelf || friends.has(ownerId) };

        visible.set(ownerId, {
            presenceHidden: !allows(row.presenceVisibility, context),
            activity:
                row.kind && allows(row.activityVisibility, context)
                    ? { kind: row.kind, name: row.name, detail: row.detail, context: row.context, startedAt: row.startedAt }
                    : null,
        });
    }
    return visible;
}

async function setVisibility(user, { presence, activity }) {
    const values = ["everyone", "friends", "nobody"];
    if (!values.includes(presence) || !values.includes(activity)) {
        throw new BadRequest("Réglage de visibilité inconnu.");
    }
    await presenceRepository.setVisibility(user.userId, { presence, activity });
    return { presenceVisibility: presence, activityVisibility: activity };
}

async function friendSet(userId) {
    const rows = await friendshipRepository.listAcceptedIds(userId).catch(() => []);
    return new Set(rows.map((row) => Number(row.userId)));
}

const areFriends = async (a, b) => (await friendSet(a)).has(Number(b));

module.exports = { setActivity, clearActivity, activityFor, activitiesFor, setVisibility, allows, KINDS, MAX_MINUTES };
