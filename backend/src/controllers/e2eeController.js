"use strict";

const e2eeService = require("../services/e2eeService");

const e2eeController = {
    registerDevice: async (req, res) => {
        const device = await e2eeService.registerDevice(req.user, req.body);
        res.status(200).json({ device });
    },

    listDevices: async (req, res) => {
        const devices = await e2eeService.listOwnDevices(req.user);
        res.status(200).json({ devices });
    },

    revokeDevice: async (req, res) => {
        await e2eeService.revokeDevice(req.user, req.params.deviceId);
        res.status(204).end();
    },

    listRecipients: async (req, res) => {
        const devices = await e2eeService.listRecipients(req.params.channelId);
        res.status(200).json({ devices });
    },

    getEpoch: async (req, res) => {
        const state = await e2eeService.describeEpoch(req.user, req.params.channelId, req.validatedQuery.deviceId);
        res.status(200).json(state);
    },

    rotateEpoch: async (req, res) => {
        const epoch = await e2eeService.rotateEpoch(req.user, req.params.channelId, req.body);
        res.status(201).json(epoch);
    },

    setEncryption: async (req, res) => {
        const setting = await e2eeService.setEncryption(req.params.channelId, req.body.enabled);
        res.status(200).json(setting);
    },
};

module.exports = e2eeController;
