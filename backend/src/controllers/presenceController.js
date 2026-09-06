"use strict";

const richPresenceService = require("../services/richPresenceService");
const presenceRepository = require("../repositories/presenceRepository");

const presenceController = {
    setActivity: async (req, res) =>
        res.status(200).json({ activity: await richPresenceService.setActivity(req.user, req.body) }),

    clearActivity: async (req, res) => {
        await richPresenceService.clearActivity(req.user);
        res.status(204).end();
    },

    visibility: async (req, res) =>
        res.status(200).json(await richPresenceService.setVisibility(req.user, req.body)),

    setGuildProfile: async (req, res) => {
        const { displayName, aboutMe } = req.body;
        const empty = !displayName && !aboutMe;

        if (empty) {
            await presenceRepository.deleteProfile(req.params.guildId, req.user.userId);
            res.status(200).json({ profile: null });
            return;
        }

        await presenceRepository.upsertProfile(req.params.guildId, req.user.userId, {
            displayName: displayName || null,
            aboutMe: aboutMe || null,
            avatar: null,
        });
        res.status(200).json({ profile: { displayName: displayName || null, aboutMe: aboutMe || null } });
    },

    getGuildProfile: async (req, res) => {
        const profile = await presenceRepository.findProfile(req.params.guildId, req.user.userId);
        res.status(200).json({ profile: profile ?? null });
    },
};

module.exports = presenceController;
