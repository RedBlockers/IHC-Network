"use strict";

const {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} = require("@simplewebauthn/server");

const { credentialRepository, challengeRepository } = require("../repositories/credentialRepository");
const userRepository = require("../repositories/userRepository");
const relyingParty = require("../domain/relyingParty");
const { BadRequest, Conflict, NotFound, ServiceUnavailable, Unauthorized } = require("../errors");

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MAX_KEYS = 10;

const toBase64Url = (buffer) => Buffer.from(buffer).toString("base64url");
const fromBase64Url = (value) => Buffer.from(String(value ?? ""), "base64url");

const toKey = (row) => ({
    credentialId: toBase64Url(row.credentialId),
    label: row.label,
    backedUp: Boolean(row.backedUp),
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    transports: row.transports ? row.transports.split(",") : [],
});

async function list(userId) {
    const rows = await credentialRepository.listForUser(userId);
    return rows.map(toKey);
}

function ensureUsable() {
    if (relyingParty.isUsable()) return;
    throw new ServiceUnavailable(
        "Les clés de sécurité exigent un nom de domaine et une adresse en https://. " +
            "Ce service est actuellement servi sur une adresse qui ne le permet pas."
    );
}

async function registrationOptions(user) {
    ensureUsable();
    const existing = await credentialRepository.listForUser(user.userId);
    if (existing.length >= MAX_KEYS) throw new Conflict("Vous avez atteint le nombre maximal de clés.");

    const options = await generateRegistrationOptions({
        rpName: relyingParty.rpName,
        rpID: relyingParty.rpId(),
        userName: user.handle,
        userDisplayName: user.displayName || user.handle,
        excludeCredentials: existing.map((row) => ({
            id: toBase64Url(row.credentialId),
            transports: row.transports ? row.transports.split(",") : undefined,
        })),
        authenticatorSelection: {
            residentKey: "preferred",
            userVerification: "preferred",
        },
    });

    await challengeRepository.create(
        options.challenge,
        user.userId,
        "register",
        new Date(Date.now() + CHALLENGE_TTL_MS)
    );

    return options;
}

async function registerKey(user, response, label) {
    const name = String(label ?? "").trim();
    if (name.length === 0) throw new BadRequest("Donnez un nom à cette clé.");

    const pending = await challengeRepository.consume(String(response?.challenge ?? ""), "register");
    if (!pending || Number(pending.userId) !== Number(user.userId)) {
        throw new BadRequest("Demande expirée. Recommencez l'inscription de la clé.");
    }

    let verification;
    try {
        verification = await verifyRegistrationResponse({
            response: response.credential,
            expectedChallenge: pending.challenge,
            expectedOrigin: relyingParty.origins(),
            expectedRPID: relyingParty.rpId(),
        });
    } catch (error) {
        throw new BadRequest(`Cette clé n'a pas pu être vérifiée : ${error.message}`);
    }

    if (!verification.verified || !verification.registrationInfo) {
        throw new BadRequest("Cette clé n'a pas pu être vérifiée.");
    }

    const { credential, credentialBackedUp } = verification.registrationInfo;
    const credentialId = fromBase64Url(credential.id);

    if (await credentialRepository.findById(credentialId)) {
        throw new Conflict("Cette clé est déjà inscrite.");
    }

    await credentialRepository.create({
        credentialId,
        userId: user.userId,
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        transports: (credential.transports ?? []).join(","),
        label: name.slice(0, 60),
        backedUp: credentialBackedUp ? 1 : 0,
    });

    return { key: toKey(await credentialRepository.findById(credentialId)) };
}

const counterRegressed = (next, stored) => next !== 0 && next <= stored;

async function loginOptions() {
    ensureUsable();
    const options = await generateAuthenticationOptions({
        rpID: relyingParty.rpId(),
        userVerification: "required",
    });

    await challengeRepository.create(options.challenge, null, "login", new Date(Date.now() + CHALLENGE_TTL_MS));
    return options;
}

async function verifyLogin(response) {
    const pending = await challengeRepository.consume(String(response?.challenge ?? ""), "login");
    if (!pending) throw new Unauthorized("Demande expirée. Recommencez la connexion.");

    const credentialId = fromBase64Url(response?.credential?.id);
    const stored = await credentialRepository.findById(credentialId);
    if (!stored) throw new Unauthorized("Cette clé n'est pas reconnue.");

    let verification;
    try {
        verification = await verifyAuthenticationResponse({
            response: response.credential,
            expectedChallenge: pending.challenge,
            expectedOrigin: relyingParty.origins(),
            expectedRPID: relyingParty.rpId(),
            credential: {
                id: toBase64Url(stored.credentialId),
                publicKey: new Uint8Array(stored.publicKey),
                counter: Number(stored.counter),
                transports: stored.transports ? stored.transports.split(",") : undefined,
            },
            requireUserVerification: true,
        });
    } catch {
        throw new Unauthorized("Cette clé n'est pas reconnue.");
    }

    if (!verification.verified) throw new Unauthorized("Cette clé n'est pas reconnue.");

    const next = verification.authenticationInfo.newCounter;
    if (counterRegressed(next, Number(stored.counter))) {
        throw new Unauthorized("Cette clé a été rejouée. Révoquez-la depuis un autre appareil.");
    }

    await credentialRepository.recordUse(stored.credentialId, next);

    const user = await userRepository.findById(stored.userId);
    if (!user) throw new Unauthorized("Cette clé n'est pas reconnue.");
    return user;
}

async function remove(user, credentialId) {
    const { affectedRows } = await credentialRepository.remove(fromBase64Url(credentialId), user.userId);
    if (!affectedRows) throw new NotFound("Clé introuvable.");
    return { credentialId };
}

async function rename(user, credentialId, label) {
    const name = String(label ?? "").trim();
    if (name.length === 0) throw new BadRequest("Donnez un nom à cette clé.");

    const { affectedRows } = await credentialRepository.rename(
        fromBase64Url(credentialId),
        user.userId,
        name.slice(0, 60)
    );
    if (!affectedRows) throw new NotFound("Clé introuvable.");
    return { credentialId, label: name.slice(0, 60) };
}

module.exports = {
    counterRegressed,
    list,
    registrationOptions,
    registerKey,
    loginOptions,
    verifyLogin,
    remove,
    rename,
    MAX_KEYS,
};
