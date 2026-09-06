"use strict";

const { AccessToken, TrackSource, WebhookReceiver } = require("livekit-server-sdk");

const config = require("../config");
const { BadRequest, Unauthorized, ServiceUnavailable } = require("../errors");
const channelRepository = require("../repositories/channelRepository");
const voicePresenceService = require("./voicePresenceService");
const { hasChannelPermission } = require("./accessService");
const { isVoice } = require("../domain/channelModes");
const realtime = require("../realtime");

const webhookReceiver = new WebhookReceiver(config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET);

async function createRoomToken(user, channel) {
    if (!isVoice(channel.type)) {
        throw new BadRequest("Le média temps réel est réservé aux salons vocaux, vidéo et scène.");
    }
    if (!config.mediaEnabled) {
        throw new ServiceUnavailable("Le service vocal n'est pas configuré.");
    }

    const token = new AccessToken(config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET, {
        identity: `user:${user.userId}`,
        name: user.displayName || user.handle,
        metadata: JSON.stringify({
            userId: Number(user.userId),
            handle: user.handle,
            displayName: user.displayName,
            avatar: user.avatar,
        }),
        ttl: `${config.LIVEKIT_TOKEN_TTL_SECONDS}s`,
    });

    const [canSpeak, canShowVideo, canStream] = await Promise.all([
        hasChannelPermission(user.userId, channel.channelId, "SPEAK", channel),
        hasChannelPermission(user.userId, channel.channelId, "VIDEO", channel),
        hasChannelPermission(user.userId, channel.channelId, "STREAM", channel),
    ]);

    const sources = [];
    if (canSpeak) sources.push(TrackSource.MICROPHONE);
    if (canShowVideo) sources.push(TrackSource.CAMERA);
    if (canStream) sources.push(TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO);

    token.addGrant({
        roomJoin: true,
        room: `channel:${channel.channelId}`,
        canPublish: sources.length > 0,
        canPublishSources: sources,
        canSubscribe: true,
        canPublishData: true,
        canUpdateOwnMetadata: false,
    });

    return {
        url: config.LIVEKIT_URL,
        token: await token.toJwt(),
        expiresIn: config.LIVEKIT_TOKEN_TTL_SECONDS,
        publish: { microphone: canSpeak, camera: canShowVideo, screen: canStream },
        e2eeRequired: Boolean(channel.e2eeEnabled),
    };
}

function channelIdFromRoom(roomName) {
    const match = /^channel:(\d+)$/.exec(roomName || "");
    if (!match) return null;
    const channelId = Number(match[1]);
    return Number.isSafeInteger(channelId) && channelId > 0 ? channelId : null;
}

function participantFromEvent(participant, fallbackTimestamp) {
    const identity = /^user:(\d+)$/.exec(participant?.identity || "");
    if (!identity) return null;

    let metadata;
    try {
        metadata = JSON.parse(participant.metadata || "{}");
    } catch {
        return null;
    }

    const userId = Number(identity[1]);
    if (Number(metadata.userId) !== userId) return null;

    const joinedAtMs = Number(participant.joinedAtMs || 0);
    const joinedAtSeconds = Number(participant.joinedAt || fallbackTimestamp || 0);
    const joinedAt = joinedAtMs > 0 ? joinedAtMs : joinedAtSeconds > 0 ? joinedAtSeconds * 1000 : Date.now();

    return {
        userId,
        handle: metadata.handle,
        displayName: metadata.displayName || participant.name,
        avatar: metadata.avatar,
        joinedAt: new Date(joinedAt).toISOString(),
    };
}

async function processWebhookEvent(event) {
    if (!["participant_joined", "participant_left", "participant_connection_aborted", "room_finished"].includes(event.event)) {
        return;
    }

    const channelId = channelIdFromRoom(event.room?.name);
    if (!channelId) return;

    const channel = await channelRepository.findById(channelId);
    if (!channel || !isVoice(channel.type) || channel.guildId == null) return;

    if (event.event === "room_finished") {
        await voicePresenceService.clear(channelId);
    } else {
        const participant = participantFromEvent(event.participant, event.createdAt);
        if (!participant) return;
        if (event.event === "participant_joined") await voicePresenceService.join(channelId, participant);
        else await voicePresenceService.leave(channelId, participant.userId);
    }

    const participants = await voicePresenceService.list(channelId);
    realtime.emitToGuild(Number(channel.guildId), "voice:presence", {
        guildId: Number(channel.guildId),
        channelId,
        participants,
    });
}

async function receiveWebhook(rawBody, authorization) {
    if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) throw new BadRequest("Corps webhook invalide.");
    let event;
    try {
        event = await webhookReceiver.receive(rawBody.toString("utf8"), authorization);
    } catch {
        throw new Unauthorized("Signature webhook invalide.");
    }
    await processWebhookEvent(event);
}

module.exports = { createRoomToken, receiveWebhook, processWebhookEvent, channelIdFromRoom, participantFromEvent };
