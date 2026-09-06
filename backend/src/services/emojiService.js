"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const { createReadStream } = require("node:fs");

const emojiRepository = require("../repositories/emojiRepository");
const storageService = require("./storageService");
const { BadRequest, Conflict, NotFound } = require("../errors");
const { logger, serializeError } = require("../logger");

const KINDS = {
    emoji: {
        maxBytes: 256 * 1024,
        maxPerGuild: 100,
        mimes: new Set(["image/png", "image/gif", "image/webp"]),
        label: "emoji",
    },
    sticker: {
        maxBytes: 512 * 1024,
        maxPerGuild: 60,
        mimes: new Set(["image/png", "image/webp"]),
        label: "autocollant",
    },
    gif: {
        maxBytes: 2 * 1024 * 1024,
        maxPerGuild: 60,
        mimes: new Set(["image/gif", "image/webp"]),
        label: "GIF",
    },
    sound: {
        maxBytes: 512 * 1024,
        maxPerGuild: 40,
        mimes: new Set(["audio/mpeg", "audio/ogg", "audio/wav", "audio/webm"]),
        label: "son",
    },
};

const MAX_PER_GUILD = KINDS.emoji.maxPerGuild;
const MAX_BYTES = KINDS.emoji.maxBytes;
const NAME_PATTERN = /^[a-z0-9_]{2,32}$/;

const MENTION_PATTERN = /(^|[^\w:])::?([a-z0-9_]{2,32}):(?![\w:])/g;

const toEmoji = (row) => ({
    emojiId: Number(row.emojiId),
    name: row.name,
    url: row.url,
    createdAt: row.createdAt,
});

async function list(guildId, kind = null) {
    const rows = await emojiRepository.listByGuild(guildId, kind);
    return rows.map((row) => ({
        ...toEmoji(row),
        kind: row.kind ?? "emoji",
        bytes: Number(row.bytes ?? 0),
        author: {
            userId: Number(row.authorId),
            handle: row.authorHandle,
            displayName: row.authorDisplayName,
        },
    }));
}

async function create(guild, user, file, name, kind = "emoji") {
    const rules = KINDS[kind];
    if (!rules) throw new BadRequest("Type de média inconnu.");

    if (!file) throw new BadRequest("Aucun fichier reçu.");
    if (!rules.mimes.has(file.mimetype)) {
        throw new BadRequest(
            `Un ${rules.label} doit être un fichier ${[...rules.mimes].map((mime) => mime.split("/")[1].toUpperCase()).join(", ")}.`
        );
    }
    if (Number(file.size) > rules.maxBytes) {
        throw new BadRequest(`Un ${rules.label} ne peut pas dépasser ${Math.round(rules.maxBytes / 1024)} Ko.`);
    }

    const clean = String(name ?? "").trim().toLowerCase();
    if (!NAME_PATTERN.test(clean)) {
        throw new BadRequest("Le nom doit faire 2 à 32 caractères : minuscules, chiffres et souligné.");
    }

    const { total } = await emojiRepository.countForGuild(guild.guildId, kind);
    if (Number(total) >= rules.maxPerGuild) {
        throw new BadRequest(`Cette communauté a atteint sa limite de ${rules.label}s.`);
    }

    try {
        const key = `${kind}s/${guild.guildId}/${crypto.randomUUID()}`;
        const url = await storageService.putStream(key, createReadStream(file.path), file.mimetype, Number(file.size));

        const emojiId = await emojiRepository.create({
            guildId: guild.guildId,
            kind,
            name: clean,
            url,
            bytes: Number(file.size),
            storageKey: key,
            createdBy: user.userId,
        });
        return { emojiId, kind, name: clean, url, bytes: Number(file.size) };
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") throw new Conflict(`Un ${rules.label} porte déjà ce nom dans cette communauté.`);
        throw error;
    } finally {
        await fs.rm(file.path, { force: true }).catch((error) =>
            logger.warn("temporaire d'emoji non effacé", { error: serializeError(error) })
        );
    }
}

async function remove(guild, emojiId) {
    const row = await emojiRepository.findById(emojiId, guild.guildId);
    if (!row) throw new NotFound("Emoji introuvable dans cette communauté.");

    await emojiRepository.delete(emojiId, guild.guildId);
    await storageService.removeObject(row.storageKey).catch((error) =>
        logger.warn("image d'emoji non supprimée", { error: serializeError(error) })
    );
    return { emojiId: Number(emojiId) };
}

function citedNames(content) {
    return [...new Set([...String(content ?? "").matchAll(MENTION_PATTERN)].map((match) => match[2]))];
}

async function resolveFor(guildId, contents) {
    if (!guildId) return [];
    const names = [...new Set(contents.flatMap((content) => citedNames(content)))];
    if (names.length === 0) return [];

    const rows = await emojiRepository.findByNames(guildId, names);
    return rows.map(toEmoji);
}

async function isUsableReaction(channel, emoji) {
    const match = /^:([a-z0-9_]{2,32}):$/.exec(String(emoji ?? ""));
    if (!match) return true;
    if (!channel.guildId) return false;
    return Boolean(await emojiRepository.findByName(channel.guildId, match[1]));
}

module.exports = {
    KINDS,
    list,
    create,
    remove,
    citedNames,
    resolveFor,
    isUsableReaction,
    MAX_PER_GUILD,
    MAX_BYTES,
};
