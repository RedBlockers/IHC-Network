"use strict";

const friendGroupRepository = require("../repositories/friendGroupRepository");
const friendshipRepository = require("../repositories/friendshipRepository");
const { BadRequest, NotFound } = require("../errors");

const MAX_GROUPS = 20;

const toGroup = (row) => ({
    groupId: Number(row.groupId),
    name: row.name,
    position: Number(row.position),
    members: (typeof row.members === "string" ? JSON.parse(row.members) : row.members ?? []).map(Number),
});

async function list(userId) {
    return (await friendGroupRepository.list(userId)).map(toGroup);
}

async function create(user, name) {
    const existing = await friendGroupRepository.list(user.userId);
    if (existing.length >= MAX_GROUPS) throw new BadRequest("Vous avez atteint le nombre maximal de groupes.");

    const { position } = await friendGroupRepository.nextPosition(user.userId);
    const groupId = await friendGroupRepository.create(user.userId, { name: name.trim(), position });
    return { groupId, name: name.trim(), position: Number(position), members: [] };
}

async function rename(user, groupId, name) {
    const { affectedRows } = await friendGroupRepository.rename(groupId, user.userId, name.trim());
    if (!affectedRows) throw new NotFound("Groupe introuvable.");
    return { groupId: Number(groupId), name: name.trim() };
}

async function remove(user, groupId) {
    const { affectedRows } = await friendGroupRepository.delete(groupId, user.userId);
    if (!affectedRows) throw new NotFound("Groupe introuvable.");
    return { groupId: Number(groupId) };
}

async function setMember(user, groupId, friendId, inGroup) {
    const group = await friendGroupRepository.findById(groupId, user.userId);
    if (!group) throw new NotFound("Groupe introuvable.");

    if (inGroup) {
        const friends = await friendshipRepository.listAcceptedIds(user.userId);
        if (!friends.some((row) => Number(row.userId) === Number(friendId))) {
            throw new BadRequest("Vous ne pouvez ranger que vos amis.");
        }
        await friendGroupRepository.addMember(groupId, user.userId, friendId);
    } else {
        await friendGroupRepository.removeMember(groupId, user.userId, friendId);
    }

    return { groupId: Number(groupId), friendId: Number(friendId), inGroup: Boolean(inGroup) };
}

module.exports = { list, create, rename, remove, setMember, MAX_GROUPS };
