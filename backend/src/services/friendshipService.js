"use strict";

const { Conflict, NotFound, BadRequest } = require("../errors");
const { withTransaction } = require("../db/pool");
const friendshipRepository = require("../repositories/friendshipRepository");
const channelRepository = require("../repositories/channelRepository");
const userRepository = require("../repositories/userRepository");
const relationService = require("./relationService");
const realtime = require("../realtime");
const { toFriendship, toPublicUser } = require("../domain/mappers");

async function pushFriendListTo(userId) {
    const rows = await friendshipRepository.listForUser(userId);
    realtime.emitToUser(userId, "friends:update", rows.map((row) => toFriendship(row, userId)));
}

async function sendRequest(requester, friendHandle) {
    const target = await userRepository.findByHandle(friendHandle);
    if (!target) throw new NotFound("Utilisateur introuvable.");
    if (target.userId === requester.userId) throw new BadRequest("Vous ne pouvez pas vous ajouter vous-même.");

    if (await relationService.isBlocked(requester.userId, target.userId)) {
        throw new NotFound("Utilisateur introuvable.");
    }

    const existing = await friendshipRepository.findBetween(requester.userId, target.userId);
    if (existing) throw new Conflict("Une relation ou une demande existe déjà avec cet utilisateur.");

    await friendshipRepository.create(requester.userId, target.userId);
    await Promise.all([pushFriendListTo(requester.userId), pushFriendListTo(target.userId)]);

    return toPublicUser(target);
}

async function acceptRequest(user, friendshipId) {
    const created = await withTransaction(async (connection) => {
        const friendship = await friendshipRepository.findById(friendshipId, connection);
        if (!friendship || friendship.status !== "pending") throw new NotFound("Demande d'ami introuvable.");

        const result = await friendshipRepository.accept(friendshipId, user.userId, connection);
        if (result.affectedRows === 0) throw new NotFound("Demande d'ami introuvable.");

        await channelRepository.createDirectChannel(friendshipId, connection);
        return friendship;
    });

    const otherUserId = created.requesterId === user.userId ? created.addresseeId : created.requesterId;
    await Promise.all([pushFriendListTo(user.userId), pushFriendListTo(otherUserId)]);
}

async function removeFriend(user, friendshipId) {
    const friendship = await friendshipRepository.findById(friendshipId);
    if (!friendship) throw new NotFound("Relation introuvable.");

    const isParty = friendship.requesterId === user.userId || friendship.addresseeId === user.userId;
    if (!isParty) throw new NotFound("Relation introuvable.");

    await friendshipRepository.remove(friendshipId);

    const otherUserId = friendship.requesterId === user.userId ? friendship.addresseeId : friendship.requesterId;
    await Promise.all([pushFriendListTo(user.userId), pushFriendListTo(otherUserId)]);
}

async function listFriends(userId) {
    const rows = await friendshipRepository.listForUser(userId);
    return rows.map((row) => toFriendship(row, userId));
}

module.exports = { sendRequest, acceptRequest, removeFriend, listFriends };
