"use strict";

const { asyncHandler, Unauthorized, Forbidden } = require("../errors");
const { accountLimiter } = require("./rateLimit");
const tokenService = require("../services/tokenService");
const cacheService = require("../services/cacheService");
const accessTokenService = require("../services/accessTokenService");
const accountLifecycleService = require("../services/accountLifecycleService");

const bearer = (header) => {
    if (!header) return null;
    const [scheme, value] = header.split(" ");
    return scheme === "Bearer" && value ? value : null;
};

async function resolveSession(raw) {
    try {
        const payload = tokenService.verify(raw);
        const user = await cacheService.getUserById(payload.userId);
        if (!user) throw new Unauthorized("Compte introuvable.");
        if (!tokenService.matchesUser(payload, user)) {
            throw new Unauthorized("Session expirée. Veuillez vous reconnecter.");
        }
        return { user, payload: { ...payload, kind: "session" } };
    } catch (error) {
        if (error.status === 401) error.details = { ...error.details, sessionExpired: true };
        throw error;
    }
}

const authenticate = asyncHandler(async (req, res, next) => {
    const raw = bearer(req.headers.authorization);
    const { user, payload } = accessTokenService.isAccessToken(raw)
        ? await accessTokenService.authenticate(raw)
        : await resolveSession(raw);

    if (await accountLifecycleService.purgeIfDue(user)) {
        throw new Unauthorized("Compte introuvable.", { details: { sessionExpired: true } });
    }
    if (user.deletionRequestedAt)
        throw new Unauthorized("Reconnectez-vous pour annuler la suppression de votre compte.", {
            details: { sessionExpired: true },
        });

    if (user.isBanned && (!user.bannedUntil || new Date(user.bannedUntil) > new Date())) {
        throw new Forbidden(
            user.bannedUntil
                ? `Ce compte est suspendu jusqu'au ${new Date(user.bannedUntil).toLocaleString("fr-FR")}.`
                : "Ce compte est suspendu.",
            { details: { suspendedUntil: user.bannedUntil ?? null, reason: user.suspensionReason ?? null } }
        );
    }

    Object.assign(req, { user, auth: payload });

    accountLimiter(req, res, next);
});

module.exports = authenticate;
