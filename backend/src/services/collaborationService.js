"use strict";

const collaborationRepository = require("../repositories/collaborationRepository");
const messageRepository = require("../repositories/messageRepository");
const extractiveSummary = require("../domain/extractiveSummary");
const realtime = require("../realtime");
const { BadRequest, Forbidden } = require("../errors");

const toStroke = (row) => ({
    strokeId: Number(row.strokeId),
    userId: Number(row.userId),
    color: row.color,
    points: typeof row.points === "string" ? JSON.parse(row.points) : row.points,
    createdAt: row.createdAt,
});

async function whiteboard(channel) {
    const strokes = await collaborationRepository.listStrokes(channel.channelId);
    return { strokes: strokes.map(toStroke) };
}

async function addStroke(channel, user, input) {
    const strokeId = await collaborationRepository.addStroke({
        channelId: channel.channelId,
        userId: user.userId,
        color: input.color,
        points: input.points,
    });
    const stroke = { strokeId, userId: Number(user.userId), color: input.color, points: input.points };
    realtime.emitToChannel(Number(channel.channelId), "whiteboard:stroke", stroke);
    return stroke;
}

async function clearBoard(channel) {
    await collaborationRepository.clearStrokes(channel.channelId);
    realtime.emitToChannel(Number(channel.channelId), "whiteboard:cleared", { channelId: Number(channel.channelId) });
    return { cleared: true };
}

async function addTranscript(channel, user, input) {
    if (input.consented !== true) {
        throw new Forbidden("Une transcription n'est enregistrée qu'avec un consentement explicite.");
    }
    const text = (input.text ?? "").trim();
    if (!text) throw new BadRequest("Rien à transcrire.");
    const transcriptId = await collaborationRepository.addTranscript({
        channelId: channel.channelId,
        userId: user.userId,
        text: text.slice(0, 4000),
    });
    const row = { transcriptId, userId: Number(user.userId), text: text.slice(0, 4000), createdAt: new Date() };
    realtime.emitToChannel(Number(channel.channelId), "transcript:new", row);
    return row;
}

async function listTranscripts(channel) {
    const rows = await collaborationRepository.listTranscripts(channel.channelId);
    return {
        transcripts: rows.map((row) => ({
            transcriptId: Number(row.transcriptId),
            userId: Number(row.userId),
            handle: row.handle,
            displayName: row.displayName,
            text: row.text,
            createdAt: row.createdAt,
        })),
    };
}

async function summarize(channel, user, input = {}) {
    if (input.optedIn !== true) {
        throw new Forbidden("Un résumé n'est produit qu'avec un consentement explicite.");
    }
    if (channel.e2eeEnabled) {
        throw new BadRequest("Un salon chiffré ne peut pas être résumé côté serveur : il n'y a que des enveloppes.");
    }
    const page = await messageRepository.listByChannel(channel.channelId, 80, null);
    const texts = page.rows.map((row) => String(row.content ?? ""));
    const result = extractiveSummary.summarize(texts);
    if (!result.body) throw new BadRequest("Pas encore assez de messages en clair pour un résumé.");

    const body = result.body.slice(0, 4000);
    const summaryId = await collaborationRepository.addSummary({
        channelId: channel.channelId,
        userId: user.userId,
        body,
        method: extractiveSummary.METHOD,
    });
    return { summaryId, method: extractiveSummary.METHOD, body, messageCount: result.messageCount };
}

async function listSummaries(channel) {
    const rows = await collaborationRepository.listSummaries(channel.channelId);
    return {
        summaries: rows.map((row) => ({
            summaryId: Number(row.summaryId),
            userId: Number(row.userId),
            handle: row.handle,
            displayName: row.displayName,
            method: row.method || extractiveSummary.METHOD,
            body: row.body,
            createdAt: row.createdAt,
        })),
    };
}

module.exports = {
    whiteboard,
    addStroke,
    clearBoard,
    addTranscript,
    listTranscripts,
    summarize,
    listSummaries,
};
