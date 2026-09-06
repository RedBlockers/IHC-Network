"use strict";

const pollRepository = require("../repositories/pollRepository");
const messageRepository = require("../repositories/messageRepository");
const realtime = require("../realtime");
const { withTransaction } = require("../db/pool");
const { BadRequest, Forbidden, NotFound } = require("../errors");
const { toMessage } = require("../domain/mappers");
const channelModes = require("../domain/channelModes");
const accessService = require("./accessService");
const moderationService = require("./moderationService");
const onboardingService = require("./onboardingService");
const automodService = require("./automodService");

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;

const isClosed = (poll) =>
    Boolean(poll.closedAt) || (poll.closesAt != null && new Date(poll.closesAt).getTime() <= Date.now());

async function describe(poll, userId) {
    const [options, tally, own] = await Promise.all([
        pollRepository.listOptions(poll.pollId),
        pollRepository.tally(poll.pollId),
        pollRepository.voteOf(poll.pollId, userId),
    ]);

    const counts = new Map(tally.map((row) => [Number(row.optionId), Number(row.votes)]));
    const total = [...counts.values()].reduce((sum, value) => sum + value, 0);

    return {
        pollId: Number(poll.pollId),
        messageId: String(poll.messageId),
        question: poll.question,
        anonymous: Boolean(poll.anonymous),
        closed: isClosed(poll),
        closesAt: poll.closesAt ?? null,
        totalVotes: total,
        yourVote: own ? Number(own.optionId) : null,
        createdBy: Number(poll.createdBy),
        options: options.map((option) => {
            const votes = counts.get(Number(option.optionId)) ?? 0;
            return {
                optionId: Number(option.optionId),
                label: option.label,
                votes,
                share: total === 0 ? 0 : Math.round((votes / total) * 100),
            };
        }),
    };
}

async function create(channel, user, { question, options, anonymous = true, closesInHours = null }) {
    const mode = channelModes.resolveMode(channel.type, channel.customMode);
    if (mode.acceptsMessages === false || mode.requiresThread || mode.requiresAttachment)
        throw new BadRequest("Ce type de salon n’accepte pas les sondages.");
    if (channel.e2eeEnabled) throw new BadRequest("Les sondages nécessitent un salon sans chiffrement des messages.");
    if (
        mode.postPermission &&
        !(await accessService.hasChannelPermission(user.userId, channel.channelId, mode.postPermission, channel))
    )
        throw new Forbidden(mode.refusal);
    if (channel.guildId) {
        if (await moderationService.isTimedOut(channel.guildId, user.userId))
            throw new Forbidden("Vous êtes temporairement réduit au silence dans cette communauté.");
        await onboardingService.assertMaySpeak(channel.guildId, user.userId);
        await automodService.inspectMessage(channel.guildId, user.userId, question);
    }
    const label = (question ?? "").trim();
    if (label.length === 0) throw new BadRequest("Un sondage a besoin d'une question.");

    const cleaned = (options ?? []).map((option) => String(option ?? "").trim()).filter(Boolean);
    if (cleaned.length < MIN_OPTIONS) throw new BadRequest("Un sondage a besoin d'au moins deux réponses.");
    if (cleaned.length > MAX_OPTIONS) throw new BadRequest("Dix réponses au maximum.");
    if (new Set(cleaned.map((value) => value.toLowerCase())).size !== cleaned.length) {
        throw new BadRequest("Deux réponses identiques ne se distinguent pas au dépouillement.");
    }

    const closesAt = closesInHours ? new Date(Date.now() + closesInHours * 3_600_000) : null;

    const row = await withTransaction(async (connection) => {
        const created = await messageRepository.create(channel.channelId, user.userId, label, null, connection);
        const pollId = await pollRepository.create(
            {
                channelId: channel.channelId,
                messageId: created.messageId,
                question: label,
                anonymous,
                closesAt,
                createdBy: user.userId,
            },
            connection
        );
        for (const [index, option] of cleaned.entries()) {
            await pollRepository.createOption(pollId, option.slice(0, 120), index, connection);
        }
        return created;
    });

    const message = { ...toMessage(row), hasPoll: true };
    const poll = await pollRepository.findByMessage(message.messageId);
    const described = await describe(poll, user.userId);
    realtime.emitToChannel(Number(channel.channelId), "poll:created", {
        channelId: Number(channel.channelId),
        message,
        poll: described,
    });
    return { message, poll: described };
}

async function vote(channel, user, messageId, optionId) {
    const poll = await pollRepository.findByMessage(messageId);
    if (!poll || Number(poll.channelId) !== Number(channel.channelId)) throw new NotFound("Sondage introuvable.");
    if (isClosed(poll)) throw new Forbidden("Ce sondage est clos.");
    if (!(await pollRepository.optionBelongs(poll.pollId, optionId))) {
        throw new BadRequest("Cette réponse n'appartient pas au sondage.");
    }

    await pollRepository.vote(poll.pollId, user.userId, optionId);
    const described = await describe(poll, user.userId);
    realtime.emitToChannel(Number(channel.channelId), "poll:updated", {
        channelId: Number(channel.channelId),
        messageId: String(messageId),
        totalVotes: described.totalVotes,
    });
    return described;
}

async function close(channel, user, messageId) {
    const poll = await pollRepository.findByMessage(messageId);
    if (!poll || Number(poll.channelId) !== Number(channel.channelId)) throw new NotFound("Sondage introuvable.");
    const closed = await pollRepository.close(poll.pollId, user.userId);
    if (!closed) throw new Forbidden("Seul l'auteur d'un sondage encore ouvert peut le clore.");

    const described = await describe({ ...poll, closedAt: new Date() }, user.userId);
    realtime.emitToChannel(Number(channel.channelId), "poll:closed", {
        channelId: Number(channel.channelId),
        messageId: String(messageId),
    });
    return described;
}

async function forMessage(messageId, userId, channelId) {
    const poll = await pollRepository.findByMessage(messageId);
    if (!poll) return null;
    if (Number(poll.channelId) !== Number(channelId)) throw new NotFound("Sondage introuvable.");
    return describe(poll, userId);
}

module.exports = { create, vote, close, describe, forMessage, isClosed, MIN_OPTIONS, MAX_OPTIONS };
