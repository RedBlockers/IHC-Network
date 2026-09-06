"use strict";

const themeRepository = require("../repositories/themeRepository");
const contrast = require("../domain/contrast");
const realtime = require("../realtime");
const { BadRequest, NotFound } = require("../errors");

const LEVERS = ["accent", "accent2", "surfaceTint", "radiusDelta"];

const HEX = /^#[0-9a-f]{6}$/i;

const MAX_RADIUS_DELTA = 6;

const MAX_TINT_ALPHA = 8;

function validate(tokens) {
    const unknown = Object.keys(tokens ?? {}).filter((key) => !LEVERS.includes(key));
    if (unknown.length > 0) throw new BadRequest(`Ces réglages n'existent pas : ${unknown.join(", ")}.`);

    for (const key of ["accent", "accent2"]) {
        if (tokens[key] && !HEX.test(tokens[key])) throw new BadRequest(`${key} doit être une couleur hexadécimale.`);
    }

    const alpha = Number(tokens.surfaceTint ?? 0);
    if (!Number.isFinite(alpha) || alpha < 0 || alpha > MAX_TINT_ALPHA) {
        throw new BadRequest(`La teinte d'ambiance va de 0 à ${MAX_TINT_ALPHA} %.`);
    }

    const radius = Number(tokens.radiusDelta ?? 0);
    if (!Number.isInteger(radius) || Math.abs(radius) > MAX_RADIUS_DELTA) {
        throw new BadRequest(`L'arrondi se règle entre −${MAX_RADIUS_DELTA} et +${MAX_RADIUS_DELTA} pixels.`);
    }

    const corrected = {};
    for (const key of ["accent", "accent2"]) {
        if (!tokens[key]) {
            corrected[key] = null;
            continue;
        }
        const audit = contrast.auditAccent(tokens[key]);
        const failing = audit.checks.find((check) => !check.passes);
        if (failing) {
            throw new BadRequest(
                `${tokens[key]} reste illisible sur fond ${failing.label} même après correction. ` +
                    "Choisissez une teinte plus tranchée."
            );
        }
        corrected[key] = tokens[key];
    }

    return {
        accent: corrected.accent,
        accent2: corrected.accent2,
        surfaceTint: alpha,
        radiusDelta: radius,
    };
}

const toTheme = (row) => ({
    themeId: Number(row.themeId),
    tokens: typeof row.tokens === "string" ? JSON.parse(row.tokens) : row.tokens,
    label: row.label,
    effectiveAt: row.effectiveAt,
    createdAt: row.createdAt,
    createdBy: row.createdBy == null ? null : Number(row.createdBy),
    active: new Date(row.effectiveAt) <= new Date(),
});

async function active(guildId) {
    const row = await themeRepository.findActive(guildId);
    return row ? toTheme(row) : null;
}

async function history(guildId) {
    const rows = await themeRepository.list(guildId);
    return rows.map(toTheme);
}

async function publish(guild, user, { tokens, label = "", scheduledFor = null }) {
    const clean = validate(tokens);

    const effectiveAt = scheduledFor ? new Date(scheduledFor) : new Date();
    if (Number.isNaN(effectiveAt.getTime())) throw new BadRequest("Date de publication invalide.");

    const themeId = await themeRepository.create({
        guildId: guild.guildId,
        tokens: JSON.stringify(clean),
        label: String(label).slice(0, 60),
        effectiveAt,
        createdBy: user.userId,
    });

    const theme = toTheme(await themeRepository.findById(themeId));

    if (theme.active) realtime.emitToGuild(Number(guild.guildId), "guild:theme", theme);

    return { theme };
}

async function rollback(guild, user, themeId) {
    const previous = await themeRepository.findById(themeId);
    if (!previous || Number(previous.guildId) !== Number(guild.guildId)) throw new NotFound("Thème introuvable.");

    const tokens = typeof previous.tokens === "string" ? JSON.parse(previous.tokens) : previous.tokens;
    return publish(guild, user, { tokens, label: `Retour à « ${previous.label || "sans nom"} »` });
}

async function cancel(guild, themeId) {
    const row = await themeRepository.findById(themeId);
    if (!row || Number(row.guildId) !== Number(guild.guildId)) throw new NotFound("Thème introuvable.");
    if (new Date(row.effectiveAt) <= new Date()) {
        throw new BadRequest("Ce thème est déjà en vigueur : publiez-en un autre pour le remplacer.");
    }

    await themeRepository.remove(themeId, guild.guildId);
    return { themeId: Number(themeId), cancelled: true };
}

module.exports = { active, history, publish, rollback, cancel, validate, LEVERS, MAX_TINT_ALPHA, MAX_RADIUS_DELTA };
