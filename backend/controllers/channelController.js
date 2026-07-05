const channelModel = require("../models/channelModel");
const { getIo } = require("../utils/sharedState");
const { logAPI } = require("../utils/helpers/logHelper");
const guildModel = require("../models/guildModel");

module.exports = {
    createChannel: async (req, res) => {
        const startTime = Date.now();
        try {
            const { type, name, description } = req.body;
            const guildId = req.params.guildId;

            const channel = await channelModel.createChannel(type, name, description, guildId);
            logAPI(req.method, req.path, 201, startTime, true);

            getIo().emit(`newChannel/${guildId}`, channel);

            return res.status(201).json({ success: true, data: channel });
        } catch (err) {
            logAPI(req.method, req.path, 500, startTime, false, err);
            return res.status(500).json({ error: "Erreur interne du serveur" });
        }
    },

    getChannels: async (req, res) => {
        const startTime = Date.now();
        try {
            const { guildId } = req.params;

            if (!(await guildModel.doGuildExists(guildId))) {
                logAPI(req.method, req.path, 404, startTime, false, "Guild not found");
                return res.status(404).json({ error: "Guild not found" });
            }

            const channels = await channelModel.getChannelsByGuildId(guildId);

            logAPI(req.method, req.path, 200, startTime, true);
            return res.status(200).json(channels);
        } catch (err) {
            logAPI(req.method, req.path, 500, startTime, false, err);
            return res.status(500).json({ error: "Erreur interne du serveur" });
        }
    },
};
