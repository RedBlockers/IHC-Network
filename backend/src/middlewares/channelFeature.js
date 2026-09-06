"use strict";

const channelModes = require("../domain/channelModes");
const moderationService = require("../services/moderationService");
const onboardingService = require("../services/onboardingService");
const { asyncHandler, BadRequest, Forbidden } = require("../errors");

const TYPES = {
    events: ["event", "meeting"],
    tasks: ["task"],
    tickets: ["ticket"],
    documents: ["wiki", "documentation", "resources", "faq"],
    worktrees: ["development", "review", "incident"],
};

const requireChannelFeature = (feature) =>
    asyncHandler(async (req, _res, next) => {
        const type = channelModes.resolveMode(req.channel.type, req.channel.customMode).baseType || req.channel.type;
        if (!TYPES[feature]?.includes(type))
            throw new BadRequest(
                feature === "worktrees"
                    ? "Les worktrees sont réservés aux salons de développement, de revue et d’incident."
                    : "Cette opération n’est pas disponible pour ce type de salon."
            );
        if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && feature !== "tickets" && req.channel.guildId) {
            if (await moderationService.isTimedOut(req.channel.guildId, req.user.userId)) {
                throw new Forbidden("Vous êtes temporairement réduit au silence dans cette communauté.");
            }
            await onboardingService.assertMaySpeak(req.channel.guildId, req.user.userId);
        }
        next();
    });

module.exports = requireChannelFeature;
