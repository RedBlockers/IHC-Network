"use strict";

const automodService = require("../services/automodService");

const automodController = {
    describe: async (req, res) => res.status(200).json({ automod: await automodService.describe(req.guild.guildId) }),
    configure: async (req, res) => res.status(200).json({ automod: await automodService.configure(req.guild.guildId, req.body) }),
};

module.exports = automodController;
