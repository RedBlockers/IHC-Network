"use strict";

const moderationService = require("../services/moderationService");

const moderationController = {
    sanction: async (req, res) => {
        const sanction = await moderationService.sanction(req.guild, req.user, req.params.userId, req.body);
        res.status(201).json({ sanction });
    },

    revoke: async (req, res) => {
        const sanction = await moderationService.revoke(req.guild, req.user, req.params.sanctionId, req.body.reason);
        res.status(200).json({ sanction });
    },

    appeal: async (req, res) => {
        const sanction = await moderationService.appeal(req.params.guildId, req.user, req.params.sanctionId, req.body.text);
        res.status(200).json({ sanction });
    },

    memberRecord: async (req, res) => {
        const record = await moderationService.memberRecord(req.guild.guildId, req.params.userId);
        res.status(200).json(record);
    },

    addNote: async (req, res) => {
        const record = await moderationService.addNote(req.guild.guildId, req.user, req.params.userId, req.body.body);
        res.status(201).json(record);
    },

    auditLog: async (req, res) => {
        const entries = await moderationService.auditLog(req.guild.guildId, req.validatedQuery);
        res.status(200).json({ entries });
    },
};

module.exports = moderationController;
