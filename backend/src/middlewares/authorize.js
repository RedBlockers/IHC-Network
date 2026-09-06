"use strict";

const { asyncHandler, Forbidden, NotFound, BadRequest } = require("../errors");
const accessService = require("../services/accessService");
const guildRepository = require("../repositories/guildRepository");

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function assertNotSuspended(req, guild) {
    if (!guild.suspendedAt) return;
    if (READ_METHODS.has(req.method)) return;
    if (req.allowSuspendedGuild) return;

    throw new Forbidden("Cette communauté est suspendue : elle ne reçoit plus de message ni de modification.", {
        code: "guild_suspended",
        details: {
            suspendedAt: guild.suspendedAt,
            reason: guild.suspendedReason ?? null,
        },
    });
}

function parseId(value, label) {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) throw new BadRequest(`Identifiant ${label} invalide.`);
    return id;
}

const requireChannelAccess = asyncHandler(async (req, _res, next) => {
    const channelId = parseId(req.params.channelId, "de salon");
    const access = await accessService.resolveChannelAccess(req.user.userId, channelId);
    if (!access) {
        throw new NotFound("Salon introuvable.");
    }
    Object.assign(req, { channel: access.channel });

    assertNotSuspended(req, access.channel);
    if (
        access.channel.expiresAt &&
        new Date(access.channel.expiresAt).getTime() <= Date.now() &&
        !READ_METHODS.has(req.method) &&
        req.route?.path !== "/:channelId"
    ) {
        throw new Forbidden("Ce salon temporaire est fermé. Son historique reste consultable.");
    }

    next();
});

const requireGuildRole = (minimumRole = "member", { allowSuspended = false } = {}) =>
    asyncHandler(async (req, _res, next) => {
        const guildId = parseId(req.params.guildId, "de guilde");

        const guild = await guildRepository.findById(guildId);
        if (!guild) throw new NotFound("Guilde introuvable.");

        const ok = await accessService.hasGuildRole(req.user.userId, guildId, minimumRole);
        if (!ok) throw new Forbidden("Vous n'avez pas les droits requis dans cette guilde.");

        Object.assign(req, { guild, allowSuspendedGuild: allowSuspended });
        assertNotSuspended(req, guild);
        next();
    });

const requireGuildPermission = (permission) =>
    asyncHandler(async (req, _res, next) => {
        const guildId = parseId(req.params.guildId, "de guilde");
        const guild = await guildRepository.findById(guildId);
        if (!guild) throw new NotFound("Guilde introuvable.");
        if (!(await accessService.hasGuildPermission(req.user.userId, guildId, permission))) {
            throw new Forbidden("Vous n'avez pas la permission requise dans cette guilde.", {
                details: { permission },
            });
        }
        Object.assign(req, { guild });
        assertNotSuspended(req, guild);
        next();
    });

const requireChannelPermission = (permission) =>
    asyncHandler(async (req, _res, next) => {
        if (!req.channel) throw new Error("requireChannelPermission doit suivre requireChannelAccess");
        if (
            !(await accessService.hasChannelPermission(req.user.userId, req.channel.channelId, permission, req.channel))
        ) {
            throw new Forbidden("Vous n'avez pas la permission requise dans ce salon.", { details: { permission } });
        }
        next();
    });

module.exports = { requireChannelAccess, requireChannelPermission, requireGuildRole, requireGuildPermission, parseId };
