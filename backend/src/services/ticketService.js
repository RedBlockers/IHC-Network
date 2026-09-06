"use strict";

const ticketRepository = require("../repositories/ticketRepository");
const moderationRepository = require("../repositories/moderationRepository");
const userRepository = require("../repositories/userRepository");
const accessService = require("./accessService");
const notificationService = require("./notificationService");
const realtime = require("../realtime");
const { withTransaction } = require("../db/pool");
const { BadRequest, Forbidden, NotFound } = require("../errors");

const STATUSES = ["open", "pending", "resolved", "closed"];
const SUPPORT_PERMISSION = "MODERATE_MEMBERS";

function requireTicketChannel(channel) {
    if (channel.type !== "ticket") throw new BadRequest("Les demandes privées nécessitent un salon de tickets.");
}

const toTicket = (row) => ({
    ticketId: Number(row.ticketId),
    number: Number(row.number),
    title: row.title,
    status: row.status,
    priority: row.priority || "normal",
    openedBy: Number(row.openedBy),
    assigneeId: row.assigneeId == null ? null : Number(row.assigneeId),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    opener: row.openerHandle
        ? {
              userId: Number(row.openedBy),
              handle: row.openerHandle,
              displayName: row.openerDisplayName,
              avatar: row.openerAvatar,
          }
        : null,
    assignee: row.assigneeHandle
        ? { userId: Number(row.assigneeId), handle: row.assigneeHandle, displayName: row.assigneeDisplayName }
        : null,
});

const isSupport = (userId, channel) =>
    accessService.hasChannelPermission(userId, channel.channelId, SUPPORT_PERMISSION, channel);

async function requireAccess(channel, user, ticketId) {
    requireTicketChannel(channel);
    const ticket = await ticketRepository.findById(ticketId);
    if (!ticket || Number(ticket.channelId) !== Number(channel.channelId)) throw new NotFound("Ticket introuvable.");

    const support = await isSupport(user.userId, channel);
    if (!support && Number(ticket.openedBy) !== Number(user.userId)) {
        throw new NotFound("Ticket introuvable.");
    }
    return { ticket, support };
}

async function open(channel, user, { title, body, priority = "normal" }) {
    requireTicketChannel(channel);
    const label = (title ?? "").trim();
    if (label.length === 0) throw new BadRequest("Un ticket a besoin d'un objet.");
    const first = (body ?? "").trim();
    if (first.length === 0) throw new BadRequest("Décrivez votre demande.");

    const ticketId = await withTransaction(async (connection) => {
        const { number } = await ticketRepository.nextNumber(channel.channelId, connection);
        const id = await ticketRepository.create(
            {
                channelId: channel.channelId,
                guildId: channel.guildId,
                number,
                title: label.slice(0, 140),
                openedBy: user.userId,
                priority,
            },
            connection
        );
        await ticketRepository.addMessage(id, user.userId, first.slice(0, 3400), false, connection);
        return id;
    });

    const ticket = toTicket(await ticketRepository.findById(ticketId));
    realtime.emitToChannel(Number(channel.channelId), "ticket:opened", { channelId: Number(channel.channelId) });
    return ticket;
}

async function list(channel, user, { status = null, limit = 50, page = 0, search = "" } = {}) {
    requireTicketChannel(channel);
    const support = await isSupport(user.userId, channel);
    const take = Math.min(Math.max(limit, 1), 50);
    const rows = await ticketRepository.listByChannel(channel.channelId, {
        status,
        openedBy: support ? null : user.userId,
        limit: take + 1,
        offset: page * take,
        search,
    });
    return { tickets: rows.slice(0, take).map(toTicket), support, page, hasMore: rows.length > take };
}

async function thread(channel, user, ticketId) {
    const { ticket, support } = await requireAccess(channel, user, ticketId);
    const rows = await ticketRepository.listMessages(ticketId, support);
    return {
        ticket: toTicket(ticket),
        support,
        messages: rows.map((row) => ({
            ticketMessageId: Number(row.ticketMessageId),
            body: row.body,
            internal: Boolean(row.internal),
            createdAt: row.createdAt,
            author: {
                userId: Number(row.userId),
                handle: row.handle,
                displayName: row.displayName,
                avatar: row.avatar,
                avatarDecoration: row.avatarDecoration || "none",
            },
        })),
    };
}

async function reply(channel, user, ticketId, { body, internal = false }) {
    const { ticket, support } = await requireAccess(channel, user, ticketId);
    const text = (body ?? "").trim();
    if (text.length === 0) throw new BadRequest("Une réponse ne peut pas être vide.");
    if (ticket.status === "closed") throw new Forbidden("Ce ticket est clos.");
    if (internal && !support) throw new Forbidden("Seule l'équipe peut écrire une note interne.");

    await ticketRepository.addMessage(ticketId, user.userId, text.slice(0, 3400), internal && support);
    await ticketRepository.update(
        ticketId,
        internal ? { updatedAt: new Date() } : { status: support ? "pending" : "open", updatedAt: new Date() }
    );

    const target = support ? Number(ticket.openedBy) : Number(ticket.assigneeId);
    if (target && target !== Number(user.userId) && !internal) {
        await notificationService.createForUser({
            userId: target,
            actorId: Number(user.userId),
            type: "thread",
            channelId: Number(channel.channelId),
            messageId: null,
        });
    }

    realtime.emitToChannel(Number(channel.channelId), "ticket:updated", { channelId: Number(channel.channelId) });
    return thread(channel, user, ticketId);
}

async function setStatus(channel, user, ticketId, status) {
    if (!STATUSES.includes(status)) throw new BadRequest("Statut de ticket inconnu.");
    const { ticket, support } = await requireAccess(channel, user, ticketId);
    if (!support && status !== "closed") throw new Forbidden("Seule l'équipe peut changer ce statut.");

    await ticketRepository.update(ticketId, { status });
    await moderationRepository.appendAudit({
        guildId: channel.guildId,
        actorId: user.userId,
        action: `ticket.${status}`,
        targetType: "channel",
        targetId: String(ticket.ticketId),
        reason: `Ticket #${ticket.number} — ${ticket.title}`,
    });

    realtime.emitToChannel(Number(channel.channelId), "ticket:updated", { channelId: Number(channel.channelId) });
    return toTicket(await ticketRepository.findById(ticketId));
}

async function assign(channel, user, ticketId, assigneeId) {
    const { ticket, support } = await requireAccess(channel, user, ticketId);
    if (!support) throw new Forbidden("Seule l'équipe peut prendre un ticket en charge.");
    if (
        assigneeId != null &&
        (!(await isSupport(assigneeId, channel)) ||
            !(await accessService.hasChannelPermission(assigneeId, channel.channelId, "VIEW_CHANNEL", channel)))
    ) {
        throw new BadRequest("Choisissez une personne de l’équipe ayant accès à ce salon.");
    }

    await ticketRepository.update(ticketId, { assigneeId: assigneeId ?? null });
    await moderationRepository.appendAudit({
        guildId: channel.guildId,
        actorId: user.userId,
        action: "ticket.assign",
        targetType: "channel",
        targetId: String(ticket.ticketId),
        reason: assigneeId ? `Ticket #${ticket.number} confié` : `Ticket #${ticket.number} laissé sans responsable`,
    });

    realtime.emitToChannel(Number(channel.channelId), "ticket:updated", { channelId: Number(channel.channelId) });
    return toTicket(await ticketRepository.findById(ticketId));
}

async function assignees(channel, user) {
    requireTicketChannel(channel);
    if (!(await isSupport(user.userId, channel))) throw new Forbidden("Ce choix est réservé à l’équipe.");
    const members = await userRepository.listByGuild(channel.guildId);
    const allowed = await Promise.all(
        members.map(
            async (member) =>
                (await isSupport(member.userId, channel)) &&
                accessService.hasChannelPermission(member.userId, channel.channelId, "VIEW_CHANNEL", channel)
        )
    );
    return members
        .filter((_, index) => allowed[index])
        .map((member) => ({
            userId: Number(member.userId),
            handle: member.handle,
            displayName: member.displayName,
            avatar: member.avatar,
        }));
}

async function updateDetails(channel, user, ticketId, input) {
    const { ticket, support } = await requireAccess(channel, user, ticketId);
    if (!support) throw new Forbidden("Seule l’équipe peut modifier la priorité d’une demande.");
    await ticketRepository.update(ticketId, input);
    await moderationRepository.appendAudit({
        guildId: channel.guildId,
        actorId: user.userId,
        action: "ticket.details",
        targetType: "channel",
        targetId: String(ticket.ticketId),
        reason: `Ticket #${ticket.number} mis à jour`,
    });
    realtime.emitToChannel(Number(channel.channelId), "ticket:updated", { channelId: Number(channel.channelId) });
    return toTicket(await ticketRepository.findById(ticketId));
}

module.exports = {
    open,
    list,
    thread,
    reply,
    setStatus,
    assign,
    assignees,
    updateDetails,
    STATUSES,
    SUPPORT_PERMISSION,
};
