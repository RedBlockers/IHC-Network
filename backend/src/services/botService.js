"use strict";

const crypto = require("node:crypto");

const botRepository = require("../repositories/botRepository");
const messageRepository = require("../repositories/messageRepository");
const channelRepository = require("../repositories/channelRepository");
const secretScanner = require("../domain/secretScanner");
const realtime = require("../realtime");
const { toMessage } = require("../domain/mappers");
const { acceptsMessages } = require("../domain/channelModes");
const { BadRequest, Forbidden, NotFound, Unauthorized } = require("../errors");

const hash = (token) => crypto.createHash("sha256").update(token).digest("hex");

const toBot = (row) => ({
    botId: Number(row.botId),
    name: row.name,
    publicId: row.publicId,
    events: String(row.events ?? "")
        .split(",")
        .filter(Boolean),
    createdAt: row.createdAt,
    revoked: Boolean(row.revokedAt),
    lastUsedAt: row.lastUsedAt ?? null,
});

async function list(guildId) {
    const rows = await botRepository.listByGuild(guildId);
    return rows.map(toBot);
}

async function create(guild, user, input) {
    const name = (input.name ?? "").trim();
    if (name.length < 2) throw new BadRequest("Un bot a besoin d'un nom.");
    const existing = await botRepository.listByGuild(guild.guildId);
    if (existing.filter((row) => !row.revokedAt).length >= 10) {
        throw new BadRequest("Cette communauté a atteint sa limite de bots.");
    }
    const token = crypto.randomBytes(32).toString("base64url");
    const publicId = crypto.randomBytes(12).toString("hex");
    const events = (input.events ?? ["message.created"]).map((item) => String(item).slice(0, 60)).join(",");
    const botId = await botRepository.create({
        guildId: guild.guildId,
        name: name.slice(0, 80),
        tokenHash: hash(token),
        publicId,
        events,
        createdBy: user.userId,
    });
    return { botId, name: name.slice(0, 80), publicId, token, events: events.split(",").filter(Boolean) };
}

async function revoke(guildId, botId) {
    const result = await botRepository.revoke(botId, guildId);
    if (!result.affectedRows) throw new NotFound("Bot introuvable.");
    return { botId: Number(botId) };
}

async function authenticate(publicId, token) {
    const row = await botRepository.findByPublicId(publicId);
    if (!row || row.revokedAt) throw new Unauthorized("Bot inconnu.");
    const expected = Buffer.from(row.tokenHash, "utf8");
    const given = Buffer.from(hash(token), "utf8");
    if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
        throw new Unauthorized("Bot inconnu.");
    }
    return row;
}

async function post(publicId, token, channelId, content) {
    const bot = await authenticate(publicId, token);
    const channel = await channelRepository.findById(channelId);
    if (!channel || Number(channel.guildId) !== Number(bot.guildId)) {
        throw new NotFound("Salon introuvable pour ce bot.");
    }
    if (channel.expiresAt && new Date(channel.expiresAt).getTime() <= Date.now()) {
        throw new Forbidden("Ce salon temporaire est fermé. Son historique reste consultable.");
    }
    if (!acceptsMessages(channel.type)) {
        throw new BadRequest("Ce salon n'accueille pas de message écrit.");
    }
    await botRepository.touch(bot.botId);
    const secrets = secretScanner.scan(content);
    const safe = secrets.length > 0 ? secretScanner.redact(content, secrets) : content.slice(0, 4000);
    const row = await messageRepository.createFromBot(channel.channelId, bot, safe);
    const message = { ...toMessage(row), bot: { name: bot.name, botId: Number(bot.botId) } };
    realtime.emitToChannel(Number(channel.channelId), "message:new", message);
    return { ...message, redactedSecrets: secrets.length };
}

async function pollEvents(publicId, token, afterId) {
    const bot = await authenticate(publicId, token);
    await botRepository.touch(bot.botId);
    const rows = await botRepository.listEvents(bot.botId, afterId);
    return {
        events: rows.map((row) => ({
            eventId: Number(row.eventId),
            type: row.type,
            payload: typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload,
            createdAt: row.createdAt,
        })),
    };
}

async function fanout(guildId, type, payload) {
    if (!guildId) return;
    const bots = await botRepository.listActiveForGuild(guildId);
    for (const bot of bots) {
        const subscribed = String(bot.events ?? "").split(",");
        if (!subscribed.includes(type)) continue;
        await botRepository.enqueueEvent(bot.botId, type, payload);
    }
}

module.exports = { list, create, revoke, post, pollEvents, fanout };
