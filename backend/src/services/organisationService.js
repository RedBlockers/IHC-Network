"use strict";

const repository = require("../repositories/organisationRepository");
const guildRepository = require("../repositories/guildRepository");
const { BadRequest, NotFound } = require("../errors");
const { canAccessChannel } = require("./accessService");

const MAX_FOLDERS = 30;

async function overview(userId) {
    const [folders, guildPrefs, channelPrefs, display] = await Promise.all([
        repository.listFolders(userId),
        repository.listGuildPrefs(userId),
        repository.listChannelPrefs(userId),
        repository.findDisplayPrefs(userId),
    ]);

    return {
        folders: folders.map((row) => ({
            folderId: Number(row.folderId),
            name: row.name,
            color: row.color ?? null,
            position: Number(row.position),
        })),
        guilds: guildPrefs.map((row) => ({
            guildId: Number(row.guildId),
            folderId: row.folderId == null ? null : Number(row.folderId),
            isFavorite: Boolean(row.isFavorite),
            position: Number(row.position),
        })),
        favoriteChannels: channelPrefs.map((row) => Number(row.channelId)),
        hideReadChannels: Boolean(display?.hideReadChannels),
    };
}

async function createFolder(userId, { name, color = null }) {
    const folders = await repository.listFolders(userId);
    if (folders.length >= MAX_FOLDERS) {
        throw new BadRequest("Vous avez atteint le nombre maximal de dossiers.");
    }

    const { position } = await repository.nextFolderPosition(userId);
    const folderId = await repository.createFolder(userId, { name: name.trim(), color, position });
    return { folderId, name: name.trim(), color, position: Number(position) };
}

async function updateFolder(userId, folderId, { name, color }) {
    const existing = (await repository.listFolders(userId)).find(
        (row) => Number(row.folderId) === Number(folderId)
    );
    if (!existing) throw new NotFound("Dossier introuvable.");

    const nextName = name === undefined ? existing.name : name.trim();
    const nextColor = color === undefined ? existing.color : color;
    await repository.updateFolder(userId, folderId, { name: nextName, color: nextColor });
    return { folderId: Number(folderId), name: nextName, color: nextColor ?? null };
}

async function deleteFolder(userId, folderId) {
    const { affectedRows } = await repository.deleteFolder(userId, folderId);
    if (!affectedRows) throw new NotFound("Dossier introuvable.");
    return { folderId: Number(folderId) };
}

async function placeGuild(userId, guildId, patch) {
    const membership = await guildRepository.getMembership(guildId, userId);
    if (!membership) throw new NotFound("Communauté introuvable.");

    if (patch.folderId != null) {
        const owned = (await repository.listFolders(userId)).some(
            (row) => Number(row.folderId) === Number(patch.folderId)
        );
        if (!owned) throw new NotFound("Dossier introuvable.");
    }

    const current = await repository.findGuildPref(userId, guildId);
    const next = {
        folderId: patch.folderId === undefined ? current?.folderId ?? null : patch.folderId,
        isFavorite: patch.isFavorite === undefined ? Boolean(current?.isFavorite) : patch.isFavorite,
        position: patch.position === undefined ? Number(current?.position ?? 0) : patch.position,
    };

    await repository.setGuildPref(userId, guildId, next);
    return { guildId: Number(guildId), ...next, isFavorite: Boolean(next.isFavorite) };
}

async function setChannelFavorite(userId, channelId, isFavorite) {
    if (!(await canAccessChannel(userId, channelId))) throw new NotFound("Salon introuvable.");
    await repository.setChannelFavorite(userId, channelId, isFavorite);
    return { channelId: Number(channelId), isFavorite: Boolean(isFavorite) };
}

async function setHideReadChannels(userId, hide) {
    await repository.setHideReadChannels(userId, hide);
    return { hideReadChannels: Boolean(hide) };
}

module.exports = {
    overview,
    createFolder,
    updateFolder,
    deleteFolder,
    placeGuild,
    setChannelFavorite,
    setHideReadChannels,
    MAX_FOLDERS,
};
