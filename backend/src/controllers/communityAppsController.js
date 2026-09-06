"use strict";

const botService = require("../services/botService");
const activityService = require("../services/activityService");
const automationService = require("../services/automationService");

const communityAppsController = {
    listBots: async (req, res) => res.status(200).json({ bots: await botService.list(req.guild.guildId) }),
    createBot: async (req, res) =>
        res.status(201).json({ bot: await botService.create(req.guild, req.user, req.body) }),
    revokeBot: async (req, res) => res.status(200).json(await botService.revoke(req.guild.guildId, req.params.botId)),
    listActivities: async (req, res) =>
        res.status(200).json({ activities: await activityService.list(req.guild.guildId) }),
    createActivity: async (req, res) =>
        res.status(201).json({ activity: await activityService.create(req.guild, req.user, req.body) }),
    removeActivity: async (req, res) =>
        res.status(200).json(await activityService.remove(req.guild.guildId, req.params.activityId)),
    launchActivity: async (req, res) =>
        res.status(200).json(
            await activityService.launch(req.guild, req.user, req.params.activityId, req.body.channelId)
        ),
    listAutomations: async (req, res) =>
        res.status(200).json({ automations: await automationService.list(req.guild.guildId) }),
    createAutomation: async (req, res) =>
        res.status(201).json({ automation: await automationService.create(req.guild, req.user, req.body) }),
    removeAutomation: async (req, res) =>
        res.status(200).json(await automationService.remove(req.guild.guildId, req.params.automationId)),
    setAutomation: async (req, res) =>
        res.status(200).json(
            await automationService.setEnabled(req.guild.guildId, req.params.automationId, req.body.enabled)
        ),
    verifyActivity: async (req, res) => res.status(200).json({ session: activityService.verify(req.body.token) }),
};

module.exports = communityAppsController;
