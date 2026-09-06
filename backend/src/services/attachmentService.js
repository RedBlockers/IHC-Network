"use strict";

const crypto = require("node:crypto");
const path = require("node:path");
const fs = require("node:fs/promises");
const { createReadStream } = require("node:fs");

const attachmentRepository = require("../repositories/attachmentRepository");
const { pool, queryOne } = require("../db/pool");
const storageService = require("./storageService");
const config = require("../config");
const storageQuota = require("../domain/storageQuota");
const { previewKind, humanSize } = require("../domain/filePreview");
const {
    BadRequest,
    InsufficientStorage,
    NotFound,
    PayloadTooLarge,
    TooManyRequests,
    ServiceUnavailable,
} = require("../errors");
const { logger, serializeError } = require("../logger");

const MAX_PER_MESSAGE = 10;
const MAX_ACTIVE_UPLOADS = 4;
const UPLOAD_DISK_MARGIN = 16 * 1024 * 1024;
const UPLOAD_ADMISSION_LOCK = "qweillo:upload-admission";
const UPLOAD_DIRECTORY = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const stripControl = (value) =>
    Array.from(String(value ?? ""))
        .filter((character) => {
            const code = character.codePointAt(0);
            return code > 31 && code !== 127;
        })
        .join("");

function safeName(raw) {
    const base = path.basename(stripControl(raw ?? "fichier")).trim();
    return (base || "fichier").slice(0, 255);
}

function safePath(raw) {
    return stripControl(raw)
        .split("/")
        .filter((part) => part && part !== "." && part !== "..")
        .join("/")
        .slice(0, 512);
}

const toAttachment = (row) => ({
    attachmentId: Number(row.attachmentId),
    messageId: row.messageId == null ? null : String(row.messageId),
    name: row.name,
    mime: row.mime,
    bytes: Number(row.bytes),
    size: humanSize(row.bytes),
    url: row.url,
    kind: previewKind(row.mime, row.name),
    width: row.width == null ? null : Number(row.width),
    height: row.height == null ? null : Number(row.height),
    path: row.path || null,
    version: Number(row.version),
    createdAt: row.createdAt,
});

async function sweepAndMeasure(guildId, connection) {
    const before = new Date(Date.now() - storageQuota.PENDING_TTL_MS);
    const abandoned = await attachmentRepository.findAbandoned(guildId, before, connection);

    if (abandoned.length > 0) {
        await Promise.all(
            abandoned.map((row) =>
                storageService.removeObject(row.storageKey).catch((error) =>
                    logger.warn("envoi abandonné non effacé du stockage", {
                        storageKey: row.storageKey,
                        error: serializeError(error),
                    })
                )
            )
        );
        await attachmentRepository.deleteByIds(
            abandoned.map((row) => Number(row.attachmentId)),
            connection
        );
    }

    const row = await attachmentRepository.sumBytesForGuild(guildId, connection);
    return Number(row?.used ?? 0);
}

async function ensureRoom(channel, file, connection) {
    if (!channel.guildId) return;

    const used = await sweepAndMeasure(channel.guildId, connection);
    if (storageQuota.fits(used, file.size)) return;

    const remaining = storageQuota.remainingOf(used);
    throw new InsufficientStorage(
        `Le stockage de cette communauté est plein. Il reste ${humanSize(remaining)} pour un fichier de ${humanSize(file.size)}.`,
        {
            details: {
                usedBytes: used,
                quotaBytes: storageQuota.QUOTA_BYTES,
                remainingBytes: remaining,
                incomingBytes: Number(file.size),
            },
        }
    );
}

async function reserveUpload(channel, contentLength) {
    const length = contentLength === undefined ? null : Number(contentLength);
    if (length !== null && (!Number.isSafeInteger(length) || length <= 0))
        throw new BadRequest("Taille de l’envoi invalide.");
    if (length > config.MAX_ATTACHMENT_BYTES + 1024 * 1024) {
        throw new PayloadTooLarge("Cet envoi dépasse la taille maximale autorisée.", {
            details: { maxBytes: config.MAX_ATTACHMENT_BYTES },
        });
    }
    const bytes = Math.min(length ?? config.MAX_ATTACHMENT_BYTES, config.MAX_ATTACHMENT_BYTES);
    const diskBytes = bytes * (config.localStorageEnabled && !config.s3Enabled ? 2 : 1);
    await fs.mkdir(config.UPLOAD_TMP_DIR, { recursive: true, mode: 0o700 });
    const connection = await pool.getConnection();
    const id = crypto.randomUUID();
    const leaseName = `qweillo:upload:${id}`;
    const directory = path.join(config.UPLOAD_TMP_DIR, id);
    let admissionLocked = false;
    let leaseLocked = false;
    let transferred = false;
    try {
        if (channel.guildId) await sweepAndMeasure(channel.guildId, connection);
        const acquired = await queryOne(
            "uploads.lock",
            "SELECT GET_LOCK(?, 2) AS acquired",
            [UPLOAD_ADMISSION_LOCK],
            connection
        );
        if (Number(acquired?.acquired) !== 1)
            throw new TooManyRequests("Un autre envoi se prépare. Réessayez dans quelques secondes.");
        admissionLocked = true;
        const active = [];
        for (const entry of await fs.readdir(config.UPLOAD_TMP_DIR, { withFileTypes: true })) {
            if (!entry.isDirectory() || !UPLOAD_DIRECTORY.test(entry.name)) continue;
            const candidate = path.join(config.UPLOAD_TMP_DIR, entry.name);
            const lease = await queryOne(
                "uploads.leaseOwner",
                "SELECT IS_USED_LOCK(?) AS owner",
                [`qweillo:upload:${entry.name}`],
                connection
            );
            if (lease?.owner == null) {
                await fs.rm(candidate, { recursive: true, force: true });
                continue;
            }
            try {
                const reservation = JSON.parse(await fs.readFile(path.join(candidate, "reservation.json"), "utf8"));
                if (
                    !Number.isSafeInteger(reservation.bytes) ||
                    !Number.isSafeInteger(reservation.diskBytes) ||
                    reservation.bytes <= 0 ||
                    reservation.diskBytes <= 0
                ) {
                    throw new ServiceUnavailable("L’état des envois en cours doit être vérifié par l’hébergeur.");
                }
                active.push(reservation);
            } catch (error) {
                if (error.code !== "ENOENT") throw error;
            }
        }
        if (active.length >= MAX_ACTIVE_UPLOADS) {
            throw new TooManyRequests(
                "Quatre fichiers sont déjà en cours d’envoi. Réessayez lorsque l’un d’eux est terminé."
            );
        }
        const disk = await fs.statfs(config.UPLOAD_TMP_DIR, { bigint: true });
        const reservedDisk = active.reduce((sum, entry) => sum + BigInt(entry.diskBytes), 0n);
        if (disk.bavail * disk.bsize < reservedDisk + BigInt(diskBytes) + BigInt(UPLOAD_DISK_MARGIN)) {
            throw new InsufficientStorage(
                "Le disque ne dispose pas d’assez de place pour recevoir et enregistrer ce fichier."
            );
        }
        if (channel.guildId) {
            const usage = await attachmentRepository.sumBytesForGuild(channel.guildId, connection);
            const reservedBytes = active
                .filter((entry) => Number(entry.guildId) === Number(channel.guildId))
                .reduce((sum, entry) => sum + entry.bytes, 0);
            if (!storageQuota.fits(Number(usage?.used ?? 0) + reservedBytes, bytes)) {
                throw new InsufficientStorage(
                    "Le stockage disponible dans cette communauté, en tenant compte des envois en cours, ne suffit pas pour ce fichier."
                );
            }
        }
        const lease = await queryOne("uploads.lease", "SELECT GET_LOCK(?, 0) AS acquired", [leaseName], connection);
        if (Number(lease?.acquired) !== 1)
            throw new ServiceUnavailable("Cet envoi n’a pas pu être réservé. Réessayez.");
        leaseLocked = true;
        await fs.mkdir(directory, { mode: 0o700 });
        await fs.writeFile(
            path.join(directory, "reservation.json"),
            JSON.stringify({ bytes, diskBytes, guildId: channel.guildId ?? null }),
            { flag: "wx", mode: 0o600 }
        );
        await queryOne("uploads.unlock", "SELECT RELEASE_LOCK(?) AS released", [UPLOAD_ADMISSION_LOCK], connection);
        admissionLocked = false;
        const controller = new AbortController();
        const connectionError = () =>
            controller.abort(new ServiceUnavailable("La réservation de l’envoi a été interrompue."));
        connection.on("error", connectionError);
        let released;
        const reservation = {
            directory,
            connection,
            controller,
            phase: "receiving",
            release: () => {
                released ??= (async () => {
                    try {
                        await fs.rm(directory, { recursive: true, force: true });
                    } catch (error) {
                        logger.warn("temporaires d’envoi non effacés", { error: serializeError(error) });
                    }
                    connection.removeListener("error", connectionError);
                    try {
                        await queryOne(
                            "uploads.release",
                            "SELECT RELEASE_LOCK(?) AS released",
                            [leaseName],
                            connection
                        );
                        connection.release();
                    } catch (error) {
                        connection.destroy();
                        logger.warn("réservation d’envoi interrompue", { error: serializeError(error) });
                    }
                })();
                return released;
            },
        };
        transferred = true;
        return reservation;
    } finally {
        if (!transferred) {
            await fs
                .rm(directory, { recursive: true, force: true })
                .catch((error) => logger.warn("réservation refusée non effacée", { error: serializeError(error) }));
            try {
                if (leaseLocked)
                    await queryOne("uploads.release", "SELECT RELEASE_LOCK(?) AS released", [leaseName], connection);
                if (admissionLocked)
                    await queryOne(
                        "uploads.unlock",
                        "SELECT RELEASE_LOCK(?) AS released",
                        [UPLOAD_ADMISSION_LOCK],
                        connection
                    );
                connection.release();
            } catch {
                connection.destroy();
            }
        }
    }
}

async function store(channel, user, file, { relativePath = "" } = {}) {
    if (!file) throw new BadRequest("Aucun fichier reçu.");
    const reservation = file.uploadReservation;
    if (reservation) reservation.phase = "storing";
    const connection = reservation?.connection;
    const signal = reservation?.controller.signal;
    const name = safeName(file.originalname);
    const key = `attachments/${channel.channelId}/${crypto.randomUUID()}/${encodeURIComponent(name)}`;
    let stored = false;
    let attachmentId;
    try {
        if (Number(file.size) === 0) throw new BadRequest("Fichier vide.");
        signal?.throwIfAborted();
        await ensureRoom(channel, file, connection);
        const url = await storageService.putStream(
            key,
            createReadStream(file.path),
            file.mimetype || "application/octet-stream",
            Number(file.size),
            signal
        );
        stored = true;
        signal?.throwIfAborted();
        const previous = await attachmentRepository.latestVersion(channel.channelId, name, connection);

        attachmentId = await attachmentRepository.create(
            {
                channelId: channel.channelId,
                userId: user.userId,
                name,
                mime: file.mimetype || "application/octet-stream",
                bytes: Number(file.size),
                storageKey: key,
                url,
                width: null,
                height: null,
                path: safePath(relativePath),
                version: previous ? Number(previous.version) + 1 : 1,
                replacesId: previous ? Number(previous.attachmentId) : null,
            },
            connection
        );

        const attachment = await attachmentRepository.findById(attachmentId, connection);
        signal?.throwIfAborted();
        return toAttachment(attachment);
    } catch (error) {
        if (attachmentId)
            await attachmentRepository
                .deleteByIds([attachmentId], connection)
                .catch((cleanupError) =>
                    logger.warn("métadonnées du fichier refusé non effacées", { error: serializeError(cleanupError) })
                );
        if (stored)
            await storageService
                .removeObject(key)
                .catch((cleanupError) =>
                    logger.warn("fichier refusé non effacé", { error: serializeError(cleanupError) })
                );
        if (["ENOSPC", "EDQUOT"].includes(error.code))
            throw new InsufficientStorage("Le serveur n’a plus d’espace disponible pour enregistrer ce fichier.");
        throw error;
    } finally {
        await fs
            .rm(file.path, { force: true })
            .catch((error) => logger.warn("temporaire d'envoi non effacé", { error: serializeError(error) }));
        await reservation?.release();
    }
}

async function verifyForMessage(channel, user, attachmentIds) {
    if (!attachmentIds || attachmentIds.length === 0) return [];
    if (attachmentIds.length > MAX_PER_MESSAGE) throw new BadRequest("Dix pièces jointes au maximum par message.");

    const rows = await attachmentRepository.findByIds(attachmentIds);
    if (rows.length !== attachmentIds.length) throw new NotFound("Pièce jointe introuvable.");

    for (const row of rows) {
        if (Number(row.channelId) !== Number(channel.channelId)) throw new NotFound("Pièce jointe introuvable.");
        if (Number(row.userId) !== Number(user.userId)) throw new NotFound("Pièce jointe introuvable.");
        if (row.messageId != null) throw new BadRequest("Cette pièce jointe est déjà attachée à un message.");
    }

    return rows.map(toAttachment);
}

async function attachToMessage(attachmentIds, messageId, connection) {
    if (!attachmentIds || attachmentIds.length === 0) return;
    await attachmentRepository.attachToMessage(messageId, attachmentIds, connection);
}

async function forMessages(messageIds) {
    if (messageIds.length === 0) return new Map();
    const rows = await attachmentRepository.listForMessages(messageIds);
    const grouped = new Map();
    for (const row of rows) {
        const key = String(row.messageId);
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(toAttachment(row));
    }
    return grouped;
}

async function gallery(channel, limit = 60) {
    const rows = await attachmentRepository.listForChannel(channel.channelId, Math.min(Math.max(limit, 1), 200));
    return rows.map((row) => ({
        ...toAttachment(row),
        author: { userId: Number(row.userId), handle: row.handle, displayName: row.displayName, avatar: row.avatar },
    }));
}

async function versions(channel, name) {
    const rows = await attachmentRepository.listVersions(channel.channelId, safeName(name));
    if (rows.length === 0) throw new NotFound("Fichier introuvable.");
    return rows.map((row) => ({
        ...toAttachment(row),
        author: { userId: Number(row.userId), handle: row.handle, displayName: row.displayName },
    }));
}

module.exports = {
    store,
    verifyForMessage,
    attachToMessage,
    forMessages,
    gallery,
    versions,
    toAttachment,
    safeName,
    safePath,
    MAX_PER_MESSAGE,
    reserveUpload,
    MAX_ACTIVE_UPLOADS,
    UPLOAD_DISK_MARGIN,
    MAX_BYTES: config.MAX_ATTACHMENT_BYTES,
};
