"use strict";

const { RoomServiceClient, TrackSource } = require("livekit-server-sdk");
const config = require("../config");
const { query, withTransaction } = require("../db/pool");
const accessService = require("./accessService");
const guildRepository = require("../repositories/guildRepository");
const realtime = require("../realtime");
const { BadRequest, Forbidden, NotFound, ServiceUnavailable } = require("../errors");

async function setSpeaker(channel, actor, userId, speaking) {
    if (channel.type !== "stage") throw new BadRequest("Cette action concerne les scènes.");
    if (
        !(await accessService.hasChannelPermission(userId, channel.channelId, "VIEW_CHANNEL", channel)) ||
        !(await accessService.hasChannelPermission(userId, channel.channelId, "CONNECT", channel))
    )
        throw new NotFound("Participant introuvable.");
    const guild = await guildRepository.findById(channel.guildId);
    if (!guild) throw new NotFound("Communauté introuvable.");
    if (Number(guild.ownerId) === Number(userId) && Number(actor.userId) !== Number(userId))
        throw new Forbidden("Vous ne pouvez pas retirer les droits du propriétaire.");
    const client = new RoomServiceClient(
        (config.LIVEKIT_INTERNAL_URL || config.LIVEKIT_URL).replace(/^ws/, "http"),
        config.LIVEKIT_API_KEY,
        config.LIVEKIT_API_SECRET
    );
    const publish = { microphone: speaking, camera: false, screen: false };
    try {
        await client.updateParticipant(`channel:${channel.channelId}`, `user:${userId}`, {
            permission: {
                canPublish: speaking,
                canPublishSources: speaking ? [TrackSource.MICROPHONE] : [],
                canSubscribe: true,
                canPublishData: true,
                canUpdateMetadata: false,
            },
        });
    } catch (error) {
        if (error.status === 404 || error.code === "not_found")
            throw new NotFound("Cette personne n’est plus connectée à la scène.");
        throw new ServiceUnavailable(
            "La scène n’a pas pu être mise à jour. Réessayez lorsque la connexion est rétablie."
        );
    }
    await withTransaction(async (connection) => {
        for (const permission of ["SPEAK", "VIDEO", "STREAM"]) {
            await query(
                "stage.permission",
                `INSERT INTO channel_permission_overrides (channelId, targetType, targetId, permission, effect)
                VALUES (?, 'member', ?, ?, ?) ON DUPLICATE KEY UPDATE effect = VALUES(effect)`,
                [channel.channelId, userId, permission, permission === "SPEAK" && speaking ? "allow" : "deny"],
                connection
            );
        }
    });
    const result = { channelId: Number(channel.channelId), userId: Number(userId), publish };
    realtime.emitToUser(Number(userId), "media:permissions", result);
    realtime.emitToGuild(Number(channel.guildId), "channel:permissions", {
        channelId: Number(channel.channelId),
        guildId: Number(channel.guildId),
    });
    return result;
}

module.exports = { setSpeaker };
