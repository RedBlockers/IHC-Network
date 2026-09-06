"use strict";

const groupChannelRepository = require("../repositories/groupChannelRepository");
const friendshipRepository = require("../repositories/friendshipRepository");
const relationRepository = require("../repositories/relationRepository");
const { withTransaction } = require("../db/pool");
const realtime = require("../realtime");
const { BadRequest, Forbidden, NotFound } = require("../errors");

const MIN_PARTICIPANTS = 3;
const MAX_PARTICIPANTS = 10;

async function create(user, { name, userIds }) {
    const invited = [...new Set(userIds.map(Number))].filter((id) => id !== Number(user.userId));

    if (invited.length + 1 < MIN_PARTICIPANTS) {
        throw new BadRequest("Un groupe réunit au moins trois personnes. À deux, ouvrez une conversation privée.");
    }
    if (invited.length + 1 > MAX_PARTICIPANTS) throw new BadRequest("Dix personnes au maximum dans un groupe.");

    const friends = new Set((await friendshipRepository.listAcceptedIds(user.userId)).map((row) => Number(row.userId)));
    const strangers = invited.filter((id) => !friends.has(id));
    if (strangers.length > 0) {
        throw new BadRequest("Vous ne pouvez réunir que des personnes de votre liste d'amis.");
    }

    const channelId = await withTransaction(async (connection) => {
        const id = await groupChannelRepository.create((name ?? "").trim().slice(0, 50) || null, user.userId, connection);
        await groupChannelRepository.addParticipants(id, [user.userId, ...invited], connection);
        return id;
    });

    for (const userId of invited) {
        realtime.emitToUser(userId, "group:created", { channelId, name: name ?? null });
    }
    return { channelId, participants: invited.length + 1 };
}

async function addParticipant(channel, actor, userId) {
    if (!channel.isGroup) throw new BadRequest("Ce salon n'est pas un groupe.");

    const { total } = await groupChannelRepository.countParticipants(channel.channelId);
    if (Number(total) >= MAX_PARTICIPANTS) throw new BadRequest("Dix personnes au maximum dans un groupe.");

    const friends = new Set((await friendshipRepository.listAcceptedIds(actor.userId)).map((row) => Number(row.userId)));
    if (!friends.has(Number(userId))) throw new BadRequest("Vous ne pouvez ajouter que vos amis.");

    const blocked = await relationRepository.isBlockedEitherWay(actor.userId, userId).catch(() => null);
    if (blocked) throw new Forbidden("Cette personne ne peut pas être ajoutée.");

    await groupChannelRepository.addParticipants(channel.channelId, [Number(userId)]);
    realtime.emitToUser(Number(userId), "group:created", { channelId: channel.channelId, name: channel.name });
    return { channelId: Number(channel.channelId), userId: Number(userId) };
}

async function removeParticipant(channel, actor, userId) {
    if (!channel.isGroup) throw new BadRequest("Ce salon n'est pas un groupe.");

    const leaving = Number(userId) === Number(actor.userId);
    if (!leaving && Number(channel.groupOwnerId) !== Number(actor.userId)) {
        throw new Forbidden("Seule la personne qui a créé le groupe peut en retirer une autre.");
    }

    await groupChannelRepository.removeParticipant(channel.channelId, userId);
    realtime.emitToChannel(channel.channelId, "group:left", {
        channelId: Number(channel.channelId),
        userId: Number(userId),
    });
    return { channelId: Number(channel.channelId), userId: Number(userId) };
}

async function list(userId) {
    const rows = await groupChannelRepository.listForUser(userId);
    return rows.map((row) => {
        const others = typeof row.others === "string" ? JSON.parse(row.others) : row.others ?? [];
        return {
            channelId: Number(row.channelId),
            name: row.name || others.slice(0, 3).join(", "),
            named: Boolean(row.name),
            participants: Number(row.participants),
            isOwner: Number(row.groupOwnerId) === Number(userId),
        };
    });
}

async function participants(channel) {
    if (!channel.isGroup) throw new NotFound("Ce salon n'est pas un groupe.");
    const rows = await groupChannelRepository.listParticipants(channel.channelId);
    return rows.map((row) => ({
        userId: Number(row.userId),
        handle: row.handle,
        displayName: row.displayName,
        avatar: row.avatar,
    }));
}

module.exports = { create, addParticipant, removeParticipant, list, participants, MIN_PARTICIPANTS, MAX_PARTICIPANTS };
