"use strict";

const reportRepository = require("../repositories/reportRepository");
const messageRepository = require("../repositories/messageRepository");
const moderationRepository = require("../repositories/moderationRepository");
const realtime = require("../realtime");
const { DUPLICATE_ENTRY } = require("../db/pool");
const { BadRequest, Conflict, NotFound } = require("../errors");

const CONTEXT_SPAN = 3;

const toQueueEntry = (row) => ({
    reportId: Number(row.reportId),
    status: row.status,
    reason: row.reason,
    resolution: row.resolution ?? null,
    createdAt: row.createdAt,
    channel: { channelId: Number(row.channelId), name: row.channelName },
    message: row.messageContent == null ? null : {
        messageId: String(row.messageId),
        content: row.messageContent,
        createdAt: row.messageCreatedAt,
        author: {
            userId: Number(row.authorId),
            handle: row.authorHandle,
            displayName: row.authorDisplayName,
            avatar: row.authorAvatar,
        },
    },
    reporter: {
        userId: Number(row.reporterId),
        handle: row.reporterHandle,
        displayName: row.reporterDisplayName,
    },
});

async function report(channel, user, messageId, reason) {
    const motive = (reason ?? "").trim();
    if (motive.length < 3) throw new BadRequest("Un signalement a besoin d'un motif exploitable.");
    if (!channel.guildId) throw new BadRequest("Un message privé ne se signale pas à une communauté.");

    const owner = await messageRepository.channelOf(messageId);
    if (Number(owner) !== Number(channel.channelId)) throw new NotFound("Message introuvable dans ce salon.");

    try {
        await reportRepository.create({
            guildId: channel.guildId,
            channelId: channel.channelId,
            messageId,
            reporterId: user.userId,
            reason: motive.slice(0, 500),
        });
    } catch (error) {
        if (error.code === DUPLICATE_ENTRY) throw new Conflict("Vous avez déjà signalé ce message.");
        throw error;
    }

    realtime.emitToGuild(Number(channel.guildId), "moderation:report", { channelId: Number(channel.channelId) });
    return { status: "open" };
}

async function queue(guildId, { status = "open", limit = 50 } = {}) {
    const rows = await reportRepository.listQueue(guildId, status, Math.min(Math.max(limit, 1), 100));
    const { total } = await reportRepository.countOpen(guildId);
    return { reports: rows.map(toQueueEntry), openCount: Number(total) };
}

async function context(guildId, reportId) {
    const report_ = await reportRepository.findById(guildId, reportId);
    if (!report_) throw new NotFound("Signalement introuvable.");

    const rows = await reportRepository.contextAround(report_.channelId, report_.messageId, CONTEXT_SPAN);
    return {
        reportId: Number(reportId),
        messageId: String(report_.messageId),
        context: rows
            .map((row) => ({
                messageId: String(row.messageId),
                content: row.content,
                createdAt: row.createdAt,
                author: {
                    userId: Number(row.userId),
                    handle: row.handle,
                    displayName: row.displayName,
                    avatar: row.avatar,
                },
            }))
            .sort((a, b) => (a.messageId < b.messageId ? -1 : 1)),
    };
}

async function resolve(guild, actor, reportId, { status, resolution }) {
    if (!["resolved", "rejected"].includes(status)) throw new BadRequest("Issue de signalement inconnue.");
    const motive = (resolution ?? "").trim();
    if (motive.length === 0) throw new BadRequest("Clore un signalement exige d'en dire la raison.");

    const done = await reportRepository.resolve(guild.guildId, reportId, {
        status,
        resolvedBy: actor.userId,
        resolution: motive.slice(0, 500),
    });
    if (!done) throw new NotFound("Signalement introuvable ou déjà traité.");

    await moderationRepository.appendAudit({
        guildId: guild.guildId,
        actorId: actor.userId,
        action: `report.${status}`,
        targetType: "message",
        targetId: String(reportId),
        reason: motive.slice(0, 500),
    });

    realtime.emitToGuild(Number(guild.guildId), "moderation:report", { reportId: Number(reportId), status });
    return { reportId: Number(reportId), status };
}

module.exports = { report, queue, context, resolve, CONTEXT_SPAN };
