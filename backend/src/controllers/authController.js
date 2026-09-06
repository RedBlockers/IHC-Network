"use strict";

const authService = require("../services/authService");
const webauthnService = require("../services/webauthnService");
const sessionService = require("../services/sessionService");
const emailVerificationService = require("../services/emailVerificationService");
const twoFactorService = require("../services/twoFactorService");
const userRepository = require("../repositories/userRepository");
const { toPrivateUser } = require("../domain/mappers");

const contextOf = (req) => ({ userAgent: req.get("user-agent") || "" });

function sendSession(res, status, session) {
    const { refreshToken, ...payload } = session;
    res.cookie(sessionService.REFRESH_COOKIE, refreshToken, sessionService.refreshCookieOptions());
    res.status(status).json(payload);
}

const authController = {
    twoFactorStatus: async (req, res) =>
        res.status(200).json(await twoFactorService.status(req.user.userId)),

    beginTwoFactor: async (req, res) =>
        res.status(200).json(await twoFactorService.beginSetup(req.user)),

    confirmTwoFactor: async (req, res) =>
        res.status(200).json(await twoFactorService.confirmSetup(req.user, req.body.code)),

    regenerateRecoveryCodes: async (req, res) =>
        res.status(200).json(await twoFactorService.regenerateRecoveryCodes(req.user)),

    disableTwoFactor: async (req, res) => {
        const row = await userRepository.findByHandleWithSecret(req.user.handle);
        res.status(200).json(await twoFactorService.disable(req.user, req.body.password, row?.password));
    },

    register: async (req, res) => {
        const { handle, email, password, displayName, bio } = req.body;
        const result = await authService.register({
            handle,
            email,
            password,
            displayName,
            bio,
            avatarBuffer: req.file?.buffer,
            sessionContext: contextOf(req),
        });
        sendSession(res, 201, result);
    },

    login: async (req, res) => {
        const { handle, password, code, recoveryCode } = req.body;
        const result = await authService.login({
            handle,
            password,
            code,
            recoveryCode,
            ip: req.ip,
            sessionContext: contextOf(req),
        });
        sendSession(res, 200, result);
    },

    securityKeys: async (req, res) => {
        res.status(200).json({ keys: await webauthnService.list(req.user.userId) });
    },
    beginSecurityKey: async (req, res) => {
        res.status(200).json({ options: await webauthnService.registrationOptions(req.user) });
    },
    finishSecurityKey: async (req, res) => {
        res.status(201).json(await webauthnService.registerKey(req.user, req.body, req.body.label));
    },
    renameSecurityKey: async (req, res) => {
        res.status(200).json(await webauthnService.rename(req.user, req.params.credentialId, req.body.label));
    },
    removeSecurityKey: async (req, res) => {
        res.status(200).json(await webauthnService.remove(req.user, req.params.credentialId));
    },
    beginSecurityKeyLogin: async (_req, res) => {
        res.status(200).json({ options: await webauthnService.loginOptions() });
    },
    finishSecurityKeyLogin: async (req, res) => {
        const result = await authService.loginWithSecurityKey({
            response: req.body,
            ip: req.ip,
            sessionContext: contextOf(req),
        });
        sendSession(res, 200, result);
    },

    checkAvailability: async (req, res) => {
        const { handle } = req.validatedQuery;
        const available = await authService.isHandleAvailable(handle);
        res.status(200).json({ handle: { value: handle, available } });
    },

    me: async (req, res) => {
        res.status(200).json({ user: toPrivateUser(req.user) });
    },

    refresh: async (req, res) => {
        const result = await sessionService.rotate(sessionService.readRefreshToken(req), contextOf(req));
        sendSession(res, 200, result);
    },

    session: async (req, res) => {
        const refreshToken = sessionService.readRefreshToken(req);
        if (!refreshToken) return res.status(204).end();
        const result = await sessionService.rotate(refreshToken, contextOf(req));
        return sendSession(res, 200, result);
    },

    logout: async (req, res) => {
        await sessionService.revoke(sessionService.readRefreshToken(req));
        res.clearCookie(sessionService.REFRESH_COOKIE, sessionService.clearCookieOptions());
        res.status(204).end();
    },

    sendVerification: async (req, res) => {
        const result = await emailVerificationService.sendVerification(req.user);
        res.status(200).json(result);
    },

    verifyEmail: async (req, res) => {
        const result = await emailVerificationService.verify(req.body.token);
        res.status(200).json(result);
    },

    requestPasswordReset: async (req, res) => {
        const result = await emailVerificationService.requestReset(req.body.email);
        res.status(202).json(result);
    },

    resetPassword: async (req, res) => {
        const result = await emailVerificationService.resetPassword(req.body.token, req.body.newPassword);
        res.status(200).json(result);
    },

    changePassword: async (req, res) => {
        const session = await sessionService.currentSession(req);
        const result = await authService.changePassword(req.user, req.body, { familyId: session?.familyId });
        res.status(200).json(result);
    },

    listDevices: async (req, res) => {
        const session = await sessionService.currentSession(req);
        const devices = await authService.listDevices(req.user, session?.sessionId ?? null);
        res.status(200).json({ devices });
    },

    revokeDevice: async (req, res) => {
        await authService.revokeDevice(req.user, req.params.sessionId);
        res.status(204).end();
    },

    revokeOtherDevices: async (req, res) => {
        const session = await sessionService.currentSession(req);
        const result = await authService.revokeOtherDevices(req.user, session?.familyId ?? null);
        res.status(200).json(result);
    },

    loginHistory: async (req, res) => {
        const entries = await authService.loginHistory(req.user, req.validatedQuery.limit);
        res.status(200).json({ entries });
    },
};

module.exports = authController;
