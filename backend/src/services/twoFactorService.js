"use strict";

const crypto = require("node:crypto");
const config = require("../config");

const repository = require("../repositories/twoFactorRepository");
const passwordService = require("./passwordService");
const totp = require("../domain/totp");
const { BadRequest, Unauthorized } = require("../errors");

const RECOVERY_COUNT = 10;
const RECOVERY_BYTES = 5;

function generateRecoveryCode() {
    const raw = crypto.randomBytes(RECOVERY_BYTES).toString("hex").toUpperCase();
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

const normalizeRecovery = (code) =>
    String(code ?? "")
        .trim()
        .toUpperCase()
        .replace(/\s/g, "");

async function hashRecoveryCodes(codes) {
    const hashes = [];
    for (const code of codes) hashes.push(await passwordService.hash(normalizeRecovery(code)));
    return hashes;
}

async function status(userId) {
    const [row, counted] = await Promise.all([repository.find(userId), repository.countUnusedRecovery(userId)]);

    return {
        enabled: Boolean(row?.confirmedAt),
        pending: Boolean(row && !row.confirmedAt),
        recoveryCodesRemaining: Number(counted?.total ?? 0),
    };
}

async function beginSetup(user) {
    const existing = await repository.find(user.userId);
    if (existing?.confirmedAt) throw new BadRequest("Désactivez la double authentification avant de la reconfigurer.");
    const secret = totp.generateSecret();
    await repository.upsertSecret(user.userId, secret);

    return {
        secret,
        uri: totp.provisioningUri(secret, {
            account: `${user.handle}@${new URL(config.PUBLIC_URL || config.CORS_ORIGIN[0]).host}`,
        }),
    };
}

async function confirmSetup(user, code) {
    const row = await repository.find(user.userId);
    if (!row) throw new BadRequest("Commencez par générer un secret.");
    if (row.confirmedAt) throw new BadRequest("La double authentification est déjà active.");

    const step = totp.verify(row.secret, code);
    if (step === null) throw new Unauthorized("Code incorrect.");

    const codes = Array.from({ length: RECOVERY_COUNT }, generateRecoveryCode);
    const hashes = await hashRecoveryCodes(codes);

    await repository.confirm(user.userId, step);
    await repository.replaceRecoveryCodes(user.userId, hashes);

    return { enabled: true, recoveryCodes: codes };
}

async function regenerateRecoveryCodes(user) {
    const row = await repository.find(user.userId);
    if (!row?.confirmedAt) throw new BadRequest("La double authentification n'est pas active.");

    const codes = Array.from({ length: RECOVERY_COUNT }, generateRecoveryCode);
    const hashes = await hashRecoveryCodes(codes);
    await repository.replaceRecoveryCodes(user.userId, hashes);

    return { recoveryCodes: codes };
}

async function disable(user, password, currentHash) {
    if (!(await passwordService.verify(currentHash, password))) {
        throw new Unauthorized("Mot de passe incorrect.");
    }
    await repository.disable(user.userId);
    await repository.replaceRecoveryCodes(user.userId, []);
    return { enabled: false };
}

async function verifySecondFactor(userId, { code, recoveryCode }) {
    const row = await repository.find(userId);
    if (!row?.confirmedAt) return { required: false, ok: true };

    if (code) {
        const step = totp.verify(row.secret, code);
        if (step === null) return { required: true, ok: false };
        if (row.lastStep != null && Number(row.lastStep) >= step) return { required: true, ok: false };
        const { affectedRows } = await repository.recordStep(userId, step);
        return { required: true, ok: affectedRows > 0 };
    }

    if (recoveryCode) {
        const candidate = normalizeRecovery(recoveryCode);
        const unused = await repository.listUnusedRecovery(userId);

        let matched = null;
        for (const row2 of unused) {
            if (await passwordService.verify(row2.codeHash, candidate)) matched = matched ?? row2.codeId;
        }
        if (matched === null) return { required: true, ok: false };

        const { affectedRows } = await repository.consumeRecovery(matched, userId);
        return { required: true, ok: affectedRows > 0, recoveryUsed: affectedRows > 0 };
    }

    return { required: true, ok: false };
}

module.exports = {
    status,
    beginSetup,
    confirmSetup,
    regenerateRecoveryCodes,
    disable,
    verifySecondFactor,
    RECOVERY_COUNT,
};
