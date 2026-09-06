"use strict";

const service = require("../services/accountLifecycleService");
const accessTokenService = require("../services/accessTokenService");
const userRepository = require("../repositories/userRepository");
const { Forbidden } = require("../errors");

const requireSession = (req) => {
    if (req.auth?.kind === "token") {
        throw new Forbidden("Les jetons d'accès se gèrent depuis une session connectée, pas depuis un jeton.");
    }
};

const accountController = {
    requestDeletion: async (req, res) => {
        const row = await userRepository.findByHandleWithSecret(req.user.handle);
        res.status(202).json(await service.requestDeletion(req.user, req.body.password, row?.password));
    },

    cancelDeletion: async (req, res) => res.status(200).json(await service.cancelDeletion(req.user)),

    exportData: async (req, res) => {
        const data = await service.exportData(req.user);
        res.setHeader("Content-Disposition", `attachment; filename="qweillo-${req.user.handle}.json"`);
        res.status(200).json(data);
    },

    policyStatus: async (req, res) => res.status(200).json(service.policyStatus(req.user)),

    acceptPolicy: async (req, res) =>
        res.status(200).json(await service.acceptPolicy(req.user, req.body.version)),

    listTokens: async (req, res) => {
        requireSession(req);
        res.status(200).json({ tokens: await accessTokenService.list(req.user) });
    },

    createToken: async (req, res) => {
        requireSession(req);
        res.status(201).json(await accessTokenService.issue(req.user, req.body));
    },

    revokeToken: async (req, res) => {
        requireSession(req);
        await accessTokenService.revoke(req.user, req.params.tokenId);
        res.status(204).end();
    },
};

module.exports = accountController;
