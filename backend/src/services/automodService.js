"use strict";

const automodRepository = require("../repositories/automodRepository");
const moderationRepository = require("../repositories/moderationRepository");
const automod = require("../domain/automod");
const redis = require("../infra/redis");
const realtime = require("../realtime");
const { Forbidden } = require("../errors");
const { logger, serializeError } = require("../logger");

const DEFAULTS = {
    enabled: false,
    blockedWords: "",
    blockedDomains: "",
    spamMessages: 0,
    spamSeconds: 0,
    raidJoins: 0,
    raidSeconds: 0,
    action: "flag",
};

const toConfig = (row) => (row ? { ...row, enabled: Boolean(row.enabled) } : { ...DEFAULTS });

async function describe(guildId) {
    return toConfig(await automodRepository.findConfig(guildId));
}

async function configure(guildId, input) {
    await automodRepository.upsertConfig(guildId, {
        enabled: input.enabled,
        blockedWords: input.blockedWords ?? "",
        blockedDomains: input.blockedDomains ?? "",
        spamMessages: input.spamMessages ?? 0,
        spamSeconds: input.spamSeconds ?? 0,
        raidJoins: input.raidJoins ?? 0,
        raidSeconds: input.raidSeconds ?? 0,
        action: input.action ?? "flag",
    });
    realtime.emitToGuild(Number(guildId), "automod:updated", { guildId: Number(guildId) });
    return describe(guildId);
}

async function bump(key, seconds) {
    try {
        const client = redis.getClient();
        if (!client) return 0;
        const count = await client.incr(key);
        if (count === 1) await client.expire(key, seconds);
        return count;
    } catch (error) {
        logger.warn("compteur de filtre indisponible", { error: serializeError(error) });
        return 0;
    }
}

async function record(guildId, userId, verdict, action) {
    await moderationRepository
        .appendAudit({
            guildId,
            actorId: null,
            action: `automod.${verdict.rule}`,
            targetType: "user",
            targetId: String(userId),
            reason: `${verdict.reason} Mesure : ${action === "delete" ? "message refusé" : "signalé à l'équipe"}.`,
        })
        .catch((error) => logger.warn("audit de filtre non écrit", { error: serializeError(error) }));

    realtime.emitToGuild(Number(guildId), "automod:triggered", {
        rule: verdict.rule,
        reason: verdict.reason,
        userId: Number(userId),
    });
}

async function inspectMessage(guildId, userId, content) {
    const config = await describe(guildId);
    if (!config.enabled) return null;

    const lists = {
        blockedWords: automod.parseList(config.blockedWords),
        blockedDomains: automod.parseList(config.blockedDomains),
    };

    let verdict = automod.evaluate(content, lists);

    if (!verdict && config.spamMessages > 0 && config.spamSeconds > 0) {
        const window = Math.floor(Date.now() / (config.spamSeconds * 1000));
        const count = await bump(`automod:rate:${guildId}:${userId}:${window}`, config.spamSeconds);
        verdict = automod.evaluateRate(count, config);
    }

    if (!verdict) return null;

    await record(guildId, userId, verdict, config.action);

    if (config.action === "delete") {
        throw new Forbidden(verdict.reason, { details: { automod: verdict.rule } });
    }
    return verdict;
}

async function inspectJoin(guildId) {
    const config = await describe(guildId);
    if (!config.enabled || !config.raidJoins || !config.raidSeconds) return null;

    const window = Math.floor(Date.now() / (config.raidSeconds * 1000));
    const count = await bump(`automod:raid:${guildId}:${window}`, config.raidSeconds);
    const verdict = automod.evaluateRaid(count, config);
    if (!verdict) return null;

    await record(guildId, 0, verdict, "flag");
    return verdict;
}

module.exports = { describe, configure, inspectMessage, inspectJoin, DEFAULTS };
