"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const { createWriteStream } = require("node:fs");
const { pipeline } = require("node:stream/promises");
const path = require("node:path");

const sharp = require("sharp");
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");

const config = require("../config");
const { logger, serializeError } = require("../logger");
const { ServiceUnavailable, UnsupportedMedia } = require("../errors");
const { isInlineSafe } = require("../domain/filePreview");

const client = config.s3Enabled
    ? new S3Client({
          region: config.S3_REGION,
          endpoint: config.S3_ENDPOINT,
          forcePathStyle: config.S3_FORCE_PATH_STYLE,
          credentials: {
              accessKeyId: config.S3_ACCESS_KEY_ID,
              secretAccessKey: config.S3_SECRET_ACCESS_KEY,
          },
      })
    : null;

const OUTPUT = { extension: "webp", contentType: "image/webp" };
const ACCEPTED_INPUT = new Set(["jpeg", "png", "gif", "webp"]);

async function normalizeImage(buffer, width, height = width) {
    const image = sharp(buffer, { limitInputPixels: 24_000_000, animated: false });
    const meta = await image.metadata();

    if (!meta.format || !ACCEPTED_INPUT.has(meta.format)) {
        throw new UnsupportedMedia("Format d'image non pris en charge. Utilisez JPEG, PNG, GIF ou WebP.");
    }

    return image
        .rotate()
        .resize(width, height, { fit: "cover", position: "attention" })
        .webp({ quality: 82 })
        .toBuffer();
}

async function putObject(key, body) {
    if (client) {
        await client.send(
            new PutObjectCommand({
                Bucket: config.S3_BUCKET,
                Key: key,
                Body: body,
                ContentType: OUTPUT.contentType,
                CacheControl: "public, max-age=31536000, immutable",
            })
        );
        return `${config.S3_PUBLIC_URL.replace(/\/+$/, "")}/${key}`;
    }

    if (config.localStorageEnabled) {
        const destination = path.join(config.LOCAL_STORAGE_DIR, key);
        const directory = path.dirname(destination);
        const temporary = `${destination}.${crypto.randomUUID()}.tmp`;
        await fs.mkdir(directory, { recursive: true });
        await fs.writeFile(temporary, body, { flag: "wx", mode: 0o644 });
        await fs.rename(temporary, destination);
        return `${config.STORAGE_PUBLIC_URL.replace(/\/+$/, "")}/${key}`;
    }

    throw new ServiceUnavailable("Le stockage d'images n'est pas configuré.");
}

async function putStream(key, stream, contentType, contentLength, signal) {
    if (client) {
        const inline = isInlineSafe(contentType, key);
        await client.send(
            new PutObjectCommand({
                Bucket: config.S3_BUCKET,
                Key: key,
                Body: stream,
                ContentType: inline ? contentType : "application/octet-stream",
                ContentDisposition: inline ? "inline" : "attachment",
                ContentLength: contentLength,
                CacheControl: "private, max-age=31536000, immutable",
            }),
            { abortSignal: signal }
        );
        return `${config.S3_PUBLIC_URL.replace(/\/+$/, "")}/${key}`;
    }

    if (config.localStorageEnabled) {
        const destination = path.join(config.LOCAL_STORAGE_DIR, key);
        const temporary = path.join(path.dirname(destination), `.upload-${crypto.randomUUID()}.tmp`);
        try {
            await fs.mkdir(path.dirname(destination), { recursive: true });
            await pipeline(stream, createWriteStream(temporary, { flags: "wx", mode: 0o644 }), { signal });
            signal?.throwIfAborted();
            await fs.rename(temporary, destination);
        } catch (error) {
            stream.destroy?.();
            await fs.rm(temporary, { force: true }).catch((cleanupError) => {
                logger.warn("fichier temporaire non effacé", { key, error: serializeError(cleanupError) });
            });
            throw error;
        }
        return `${config.STORAGE_PUBLIC_URL.replace(/\/+$/, "")}/${key}`;
    }

    throw new ServiceUnavailable("Le stockage de fichiers n'est pas configuré.");
}

async function removeObject(key) {
    if (client) {
        await client.send(new DeleteObjectCommand({ Bucket: config.S3_BUCKET, Key: key }));
        return;
    }
    if (!config.localStorageEnabled) return;
    await fs.rm(path.join(config.LOCAL_STORAGE_DIR, key), { force: true });
}

async function saveAvatar(userId, buffer) {
    try {
        const normalized = await normalizeImage(buffer, 256);
        const key = `users/${userId}/avatar/${crypto.randomUUID()}.${OUTPUT.extension}`;
        return await putObject(key, normalized);
    } catch (error) {
        if (error instanceof UnsupportedMedia) throw error;
        logger.error("échec d'enregistrement d'avatar", { userId, error: serializeError(error) });
        throw new ServiceUnavailable("La photo n'a pas pu être enregistrée.");
    }
}

async function saveGuildIcon(buffer) {
    try {
        const normalized = await normalizeImage(buffer, 512);
        const key = `guilds/${crypto.randomUUID()}/icon.${OUTPUT.extension}`;
        return await putObject(key, normalized);
    } catch (error) {
        if (error instanceof UnsupportedMedia) throw error;
        logger.error("échec d'enregistrement d'icône de guilde", { error: serializeError(error) });
        throw new ServiceUnavailable("Le logo n'a pas pu être enregistré.");
    }
}

async function saveGuildBanner(buffer) {
    try {
        const normalized = await normalizeImage(buffer, 1600, 560);
        const key = `guilds/${crypto.randomUUID()}/banner.${OUTPUT.extension}`;
        return await putObject(key, normalized);
    } catch (error) {
        if (error instanceof UnsupportedMedia || error instanceof ServiceUnavailable) throw error;
        logger.error("échec d'enregistrement de bannière", { error: serializeError(error) });
        throw new ServiceUnavailable("La bannière n'a pas pu être enregistrée.");
    }
}

async function saveUserBanner(userId, buffer) {
    try {
        const normalized = await normalizeImage(buffer, 1200, 400);
        const key = `users/${userId}/banner/${crypto.randomUUID()}.${OUTPUT.extension}`;
        return await putObject(key, normalized);
    } catch (error) {
        if (error instanceof UnsupportedMedia || error instanceof ServiceUnavailable) throw error;
        logger.error("échec d'enregistrement de bannière utilisateur", { userId, error: serializeError(error) });
        throw new ServiceUnavailable("La bannière n'a pas pu être enregistrée.");
    }
}

module.exports = {
    saveAvatar,
    saveGuildIcon,
    saveGuildBanner,
    saveUserBanner,
    normalizeImage,
    putStream,
    removeObject,
    isEnabled: () => config.storageEnabled,
};
