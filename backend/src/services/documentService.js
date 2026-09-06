"use strict";

const documentRepository = require("../repositories/documentRepository");
const secretScanner = require("../domain/secretScanner");
const realtime = require("../realtime");
const { withTransaction } = require("../db/pool");
const { BadRequest, NotFound, Conflict } = require("../errors");

const MAX_BODY = 100_000;
const HISTORY_LIMIT = 50;

const toSummary = (row) => ({
    documentId: Number(row.documentId),
    title: row.title,
    position: Number(row.position),
    updatedAt: row.updatedAt,
    editor: row.editorHandle
        ? { userId: Number(row.updatedBy), handle: row.editorHandle, displayName: row.editorDisplayName }
        : null,
});

const toRevision = (row) => ({
    revisionId: Number(row.revisionId),
    title: row.title ?? null,
    summary: row.summary ?? "",
    editedAt: row.editedAt,
    editor: { userId: Number(row.editedBy), handle: row.handle, displayName: row.displayName },
});

function cleanBody(body) {
    const text = String(body ?? "");
    if (text.length > MAX_BODY) throw new BadRequest("Page trop longue.");
    const secrets = secretScanner.scan(text);
    return { body: secrets.length > 0 ? secretScanner.redact(text, secrets) : text, redacted: secrets.length };
}

async function create(channel, user, { title, body = "", summary = "" }) {
    const label = (title ?? "").trim();
    if (label.length === 0) throw new BadRequest("Une page a besoin d'un titre.");
    const cleaned = cleanBody(body);

    const documentId = await withTransaction(async (connection) => {
        const { position } = await documentRepository.nextPosition(channel.channelId, connection);
        const id = await documentRepository.create(
            {
                channelId: channel.channelId,
                guildId: channel.guildId,
                title: label.slice(0, 160),
                position,
                createdBy: user.userId,
            },
            connection
        );
        await documentRepository.addRevision(
            id,
            {
                body: cleaned.body,
                title: label.slice(0, 160),
                summary: (summary ?? "").trim().slice(0, 200) || "Création",
                editedBy: user.userId,
            },
            connection
        );
        return id;
    });

    const document = await read(channel, documentId);
    realtime.emitToChannel(Number(channel.channelId), "document:created", { documentId, title: label });
    return { ...document, redactedSecrets: cleaned.redacted };
}

async function outline(channel) {
    const rows = await documentRepository.listByChannel(channel.channelId);
    return { documents: rows.map(toSummary) };
}

async function read(channel, documentId) {
    const row = await documentRepository.findById(documentId);
    if (!row || Number(row.channelId) !== Number(channel.channelId)) throw new NotFound("Page introuvable.");
    const revision = await documentRepository.latestRevision(documentId);
    return {
        document: {
            documentId: Number(row.documentId),
            title: row.title,
            position: Number(row.position),
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        },
        body: revision?.body ?? "",
        lastEdit: revision ? toRevision(revision) : null,
    };
}

async function edit(channel, user, documentId, { title, body, summary = "", baseRevisionId }) {
    const row = await documentRepository.findById(documentId);
    if (!row || Number(row.channelId) !== Number(channel.channelId)) throw new NotFound("Page introuvable.");

    let redacted = 0;
    await withTransaction(async (connection) => {
        if (baseRevisionId !== undefined) {
            await documentRepository.findById(documentId, connection);
            const current = await documentRepository.latestRevision(documentId, connection);
            if (Number(current?.revisionId) !== Number(baseRevisionId)) {
                throw new Conflict(
                    "Cette page a été modifiée depuis son ouverture. Conservez votre brouillon et rechargez la dernière version."
                );
            }
        }
        const fields = { updatedBy: user.userId };
        if (title !== undefined) {
            const label = String(title).trim();
            if (label.length === 0) throw new BadRequest("Une page a besoin d'un titre.");
            fields.title = label.slice(0, 160);
        }
        await documentRepository.update(documentId, fields, connection);

        if (body !== undefined || title !== undefined) {
            const previous =
                body === undefined ? await documentRepository.latestRevision(documentId, connection) : null;
            const cleaned = cleanBody(body === undefined ? (previous?.body ?? "") : body);
            redacted = cleaned.redacted;
            await documentRepository.addRevision(
                documentId,
                {
                    body: cleaned.body,
                    title: fields.title ?? row.title,
                    summary: (summary ?? "").trim().slice(0, 200) || "Modification",
                    editedBy: user.userId,
                },
                connection
            );
        }
    });

    const document = await read(channel, documentId);
    realtime.emitToChannel(Number(channel.channelId), "document:updated", { documentId: Number(documentId) });
    return { ...document, redactedSecrets: redacted };
}

async function history(channel, documentId) {
    const row = await documentRepository.findById(documentId);
    if (!row || Number(row.channelId) !== Number(channel.channelId)) throw new NotFound("Page introuvable.");
    const rows = await documentRepository.listRevisions(documentId, HISTORY_LIMIT);
    return { revisions: rows.map(toRevision) };
}

async function revision(channel, documentId, revisionId) {
    const row = await documentRepository.findById(documentId);
    if (!row || Number(row.channelId) !== Number(channel.channelId)) throw new NotFound("Page introuvable.");
    const version = await documentRepository.findRevision(documentId, revisionId);
    if (!version) throw new NotFound("Révision introuvable.");
    return {
        revisionId: Number(version.revisionId),
        title: version.title ?? row.title,
        body: version.body,
        summary: version.summary,
        editedAt: version.editedAt,
    };
}

async function restore(channel, user, documentId, revisionId) {
    const row = await documentRepository.findById(documentId);
    if (!row || Number(row.channelId) !== Number(channel.channelId)) throw new NotFound("Page introuvable.");

    const revision = await documentRepository.findRevision(documentId, revisionId);
    if (!revision) throw new NotFound("Révision introuvable.");

    await withTransaction(async (connection) => {
        await documentRepository.addRevision(
            documentId,
            {
                body: revision.body,
                title: revision.title ?? row.title,
                summary: `Retour à la révision ${revisionId}`,
                editedBy: user.userId,
            },
            connection
        );
        await documentRepository.update(
            documentId,
            { updatedBy: user.userId, ...(revision.title ? { title: revision.title } : {}) },
            connection
        );
    });

    realtime.emitToChannel(Number(channel.channelId), "document:updated", { documentId: Number(documentId) });
    return read(channel, documentId);
}

async function remove(channel, documentId) {
    const removed = await documentRepository.remove(documentId, channel.channelId);
    if (!removed) throw new NotFound("Page introuvable.");
    realtime.emitToChannel(Number(channel.channelId), "document:removed", { documentId: Number(documentId) });
    return { documentId: Number(documentId) };
}

module.exports = { create, outline, read, edit, history, revision, restore, remove, MAX_BODY, HISTORY_LIMIT };
