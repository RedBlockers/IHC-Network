"use strict";

const onboardingService = require("../services/onboardingService");

const onboardingController = {
    describe: async (req, res) => {
        const [config, status] = await Promise.all([
            onboardingService.describe(req.guild.guildId),
            onboardingService.statusFor(req.guild.guildId, req.user.userId),
        ]);
        res.status(200).json({ onboarding: config, status });
    },

    configure: async (req, res) => {
        const onboarding = await onboardingService.configure(req.guild.guildId, req.body);
        res.status(200).json({ onboarding });
    },

    complete: async (req, res) => {
        const status = await onboardingService.complete(req.guild, req.user, req.body);
        res.status(200).json({ status });
    },
};

module.exports = onboardingController;
