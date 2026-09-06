"use strict";

const crypto = require("node:crypto");

const webhookRepository = require("../repositories/webhookRepository");
const messageRepository = require("../repositories/messageRepository");
const channelRepository = require("../repositories/channelRepository");
const realtime = require("../realtime");
const secretScanner = require("../domain/secretScanner");
const { acceptsMessages } = require("../domain/channelModes");
const { BadRequest, Forbidden, NotFound, Unauthorized } = require("../errors");
const { toMessage } = require("../domain/mappers");

const MAX_PER_CHANNEL = 10;

const hash = (token) => crypto.createHash("sha256").update(token).digest("hex");

async function list(channel) {
    const rows = await webhookRepository.listForChannel(channel.channelId);
    return rows.map((row) => ({
        webhookId: Number(row.webhookId),
        name: row.name,
        createdAt: row.createdAt,
        lastUsedAt: row.lastUsedAt,
        uses: Number(row.uses),
        revoked: Boolean(row.revokedAt),
        author: { handle: row.authorHandle, displayName: row.authorDisplayName },
    }));
}

async function create(channel, user, name) {
    if (!channel.guildId) throw new BadRequest("Un webhook appartient à une communauté.");
    if (!acceptsMessages(channel.type)) {
        throw new BadRequest("Ce salon n'accueille pas de message écrit.");
    }

    const existing = await webhookRepository.listForChannel(channel.channelId);
    if (existing.filter((row) => !row.revokedAt).length >= MAX_PER_CHANNEL) {
        throw new BadRequest("Ce salon a atteint sa limite de webhooks.");
    }

    const token = crypto.randomBytes(32).toString("base64url");
    const webhookId = await webhookRepository.create({
        channelId: channel.channelId,
        guildId: channel.guildId,
        name: name.trim(),
        tokenHash: hash(token),
        createdBy: user.userId,
    });

    return { webhookId, name: name.trim(), token };
}

async function revoke(channel, webhookId) {
    const { affectedRows } = await webhookRepository.revoke(webhookId, channel.channelId);
    if (!affectedRows) throw new NotFound("Webhook introuvable dans ce salon.");
    return { webhookId: Number(webhookId) };
}

async function post(token, { content, name }) {
    const webhook = await webhookRepository.findByTokenHash(hash(String(token ?? "")));
    if (!webhook) throw new Unauthorized("Webhook inconnu ou révoqué.");

    const channel = await channelRepository.findById(webhook.channelId);
    if (!channel) throw new NotFound("Salon introuvable.");
    if (channel.expiresAt && new Date(channel.expiresAt).getTime() <= Date.now()) {
        throw new Forbidden("Ce salon temporaire est fermé. Son historique reste consultable.");
    }

    const secrets = secretScanner.scan(content);
    const safe = secrets.length > 0 ? secretScanner.redact(content, secrets) : content;

    const row = await messageRepository.createFromWebhook(channel.channelId, webhook, safe, name);
    await webhookRepository.recordUse(webhook.webhookId);

    const message = { ...toMessage(row), webhook: { name: row.webhookName } };
    realtime.emitToChannel(channel.channelId, "message:new", message);
    return { ...message, redactedSecrets: secrets.length };
}

module.exports = { list, create, revoke, post, MAX_PER_CHANNEL };
