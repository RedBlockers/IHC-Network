"use strict";

const channelRepository = require("../repositories/channelRepository");
const { query } = require("../db/pool");
const storageService = require("./storageService");
const { toChannel } = require("../domain/mappers");
const { BadRequest, NotFound } = require("../errors");
const { logger, serializeError } = require("../logger");
const realtime = require("../realtime");

async function update(channel, input) {
    if (!channel.guildId) throw new BadRequest("Cette opération concerne les salons de communauté.");
    const fields = { ...input };
    if (fields.expiresAt !== undefined) {
        if (channel.type !== "ephemeral")
            throw new BadRequest("Seuls les salons temporaires ont une date de fermeture.");
        fields.expiresAt = fields.expiresAt ? new Date(fields.expiresAt) : null;
        if (fields.expiresAt && fields.expiresAt.getTime() <= Date.now())
            throw new BadRequest("Choisissez une date de fermeture future.");
    }
    await channelRepository.update(channel.channelId, fields);
    const updated = toChannel(await channelRepository.findById(channel.channelId));
    realtime.emitToGuild(Number(channel.guildId), "channel:updated", updated);
    return updated;
}

async function remove(channel, confirm) {
    if (!channel.guildId) throw new BadRequest("Cette opération concerne les salons de communauté.");
    if (confirm !== channel.name) throw new BadRequest("Recopiez le nom du salon pour confirmer sa suppression.");
    const files = await query("channels.files", "SELECT storageKey FROM message_attachments WHERE channelId = ?", [
        channel.channelId,
    ]);
    const result = await channelRepository.remove(channel.channelId);
    if (!result.affectedRows) throw new NotFound("Salon introuvable.");
    await Promise.all(
        files.map(({ storageKey }) =>
            storageService
                .removeObject(storageKey)
                .catch((error) => logger.warn("fichier du salon non effacé", { error: serializeError(error) }))
        )
    );
    realtime.getIo()?.in(realtime.channelRoom(channel.channelId)).socketsLeave(realtime.channelRoom(channel.channelId));
    realtime.emitToGuild(Number(channel.guildId), "channel:deleted", {
        channelId: Number(channel.channelId),
        guildId: Number(channel.guildId),
    });
    return { channelId: Number(channel.channelId) };
}

module.exports = { update, remove };
