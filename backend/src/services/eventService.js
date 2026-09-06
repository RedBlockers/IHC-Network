"use strict";

const eventRepository = require("../repositories/eventRepository");
const notificationService = require("./notificationService");
const realtime = require("../realtime");
const { BadRequest, Forbidden, NotFound } = require("../errors");

const RESPONSES = ["going", "maybe", "no"];
const MAX_EVENTS = 100;

function statusOf(row, now = Date.now()) {
    if (row.cancelledAt) return "cancelled";
    const start = new Date(row.startsAt).getTime();
    const end = row.endsAt ? new Date(row.endsAt).getTime() : start + 2 * 3_600_000;
    if (now < start) return "upcoming";
    if (now <= end) return "live";
    return "past";
}

const toEvent = (row, { counts = {}, yourResponse = null } = {}) => ({
    eventId: Number(row.eventId),
    channelId: Number(row.channelId),
    title: row.title,
    description: row.description ?? "",
    location: row.location ?? "",
    startsAt: row.startsAt,
    endsAt: row.endsAt ?? null,
    status: statusOf(row),
    createdBy: Number(row.createdBy),
    author: row.authorHandle
        ? {
              userId: Number(row.createdBy),
              handle: row.authorHandle,
              displayName: row.authorDisplayName,
              avatar: row.authorAvatar,
              avatarDecoration: row.authorDecoration || "none",
          }
        : null,
    going: Number(counts.going ?? 0),
    maybe: Number(counts.maybe ?? 0),
    no: Number(counts.no ?? 0),
    yourResponse,
});

async function tallyFor(eventId, userId) {
    const [rows, own] = await Promise.all([
        eventRepository.tally(eventId),
        eventRepository.responseOf(eventId, userId),
    ]);
    const counts = Object.fromEntries(rows.map((row) => [row.response, Number(row.total)]));
    return { counts, yourResponse: own?.response ?? null };
}

function parseDates({ startsAt, endsAt }) {
    const start = new Date(startsAt);
    if (Number.isNaN(start.getTime())) throw new BadRequest("Date de début invalide.");
    const end = endsAt ? new Date(endsAt) : null;
    if (end && Number.isNaN(end.getTime())) throw new BadRequest("Date de fin invalide.");
    if (end && end <= start) throw new BadRequest("La fin d'un événement doit suivre son début.");
    return { start, end };
}

async function create(channel, user, input) {
    const title = (input.title ?? "").trim();
    if (title.length === 0) throw new BadRequest("Un événement a besoin d'un titre.");
    const { start, end } = parseDates(input);

    const eventId = await eventRepository.create({
        channelId: channel.channelId,
        guildId: channel.guildId,
        title: title.slice(0, 120),
        description: (input.description ?? "").trim().slice(0, 2000),
        location: (input.location ?? "").trim().slice(0, 160),
        startsAt: start,
        endsAt: end,
        createdBy: user.userId,
    });

    const row = await eventRepository.findById(eventId);
    await eventRepository.respond(eventId, user.userId, "going");
    const event = toEvent(row, await tallyFor(eventId, user.userId));

    realtime.emitToChannel(Number(channel.channelId), "event:created", event);
    return event;
}

async function list(channel, user, limit = 50) {
    const rows = await eventRepository.listByChannel(channel.channelId, Math.min(Math.max(limit, 1), MAX_EVENTS));
    return Promise.all(rows.map(async (row) => toEvent(row, await tallyFor(row.eventId, user.userId))));
}

async function respond(channel, user, eventId, response) {
    if (!RESPONSES.includes(response)) throw new BadRequest("Réponse inconnue.");

    const row = await eventRepository.findById(eventId);
    if (!row || Number(row.channelId) !== Number(channel.channelId)) throw new NotFound("Événement introuvable.");
    if (row.cancelledAt) throw new Forbidden("Cet événement est annulé.");
    if (statusOf(row) === "past") throw new Forbidden("Cet événement est passé.");

    await eventRepository.respond(eventId, user.userId, response);
    const event = toEvent(row, await tallyFor(eventId, user.userId));
    realtime.emitToChannel(Number(channel.channelId), "event:updated", {
        eventId: Number(eventId),
        going: event.going,
    });
    return event;
}

async function notifyInterested(row, actorId) {
    const interested = await eventRepository.listInterested(row.eventId);
    await Promise.all(
        interested
            .map((entry) => Number(entry.userId))
            .filter((userId) => userId !== Number(actorId))
            .map((userId) =>
                notificationService.createForUser({
                    userId,
                    actorId: Number(actorId),
                    type: "thread",
                    channelId: Number(row.channelId),
                    messageId: null,
                })
            )
    );
}

async function update(channel, user, eventId, input) {
    const row = await eventRepository.findById(eventId);
    if (!row || Number(row.channelId) !== Number(channel.channelId)) throw new NotFound("Événement introuvable.");
    if (Number(row.createdBy) !== Number(user.userId)) {
        throw new Forbidden("Seule la personne qui a proposé cet événement peut le modifier.");
    }

    const fields = {};
    if (input.title !== undefined) fields.title = String(input.title).trim().slice(0, 120);
    if (input.description !== undefined) fields.description = String(input.description).trim().slice(0, 2000);
    if (input.location !== undefined) fields.location = String(input.location).trim().slice(0, 160);
    if (input.startsAt !== undefined || input.endsAt !== undefined) {
        const { start, end } = parseDates({
            startsAt: input.startsAt ?? row.startsAt,
            endsAt: input.endsAt === undefined ? row.endsAt : input.endsAt,
        });
        fields.startsAt = start;
        fields.endsAt = end;
    }
    if (Object.keys(fields).length === 0) throw new BadRequest("Aucune modification fournie.");

    await eventRepository.update(eventId, fields);
    const updated = await eventRepository.findById(eventId);
    await notifyInterested(updated, user.userId);

    const event = toEvent(updated, await tallyFor(eventId, user.userId));
    realtime.emitToChannel(Number(channel.channelId), "event:updated", event);
    return event;
}

async function cancel(channel, user, eventId) {
    const row = await eventRepository.findById(eventId);
    if (!row || Number(row.channelId) !== Number(channel.channelId)) throw new NotFound("Événement introuvable.");
    if (Number(row.createdBy) !== Number(user.userId)) {
        throw new Forbidden("Seule la personne qui a proposé cet événement peut l'annuler.");
    }

    const cancelled = await eventRepository.cancel(eventId);
    if (!cancelled) throw new BadRequest("Cet événement est déjà annulé.");

    await notifyInterested(row, user.userId);
    realtime.emitToChannel(Number(channel.channelId), "event:cancelled", { eventId: Number(eventId) });
    return { eventId: Number(eventId), status: "cancelled" };
}

module.exports = { create, list, respond, update, cancel, statusOf, RESPONSES };
