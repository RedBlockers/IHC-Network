"use strict";

const quota = require("../../src/domain/storageQuota");

const GB = 1024 * 1024 * 1024;

describe("Quota de stockage", () => {
    it("passe à « bientôt plein » à 85 % et à « plein » à 100 %", () => {
        expect(quota.levelOf(quota.shareOf(0))).toBe("ok");
        expect(quota.levelOf(quota.shareOf(4 * GB))).toBe("ok");
        expect(quota.levelOf(quota.shareOf(4.3 * GB))).toBe("warning");
        expect(quota.levelOf(quota.shareOf(5 * GB))).toBe("full");
    });

    it("laisse passer un envoi qui tient exactement dans ce qui reste", () => {
        const used = quota.QUOTA_BYTES - 1024;
        expect(quota.fits(used, 1024)).toBe(true);
        expect(quota.fits(used, 1025)).toBe(false);
    });

    it("n'annonce jamais un reste négatif", () => {
        expect(quota.remainingOf(quota.QUOTA_BYTES + 400 * 1024 * 1024)).toBe(0);
        expect(quota.remainingOf(quota.QUOTA_BYTES)).toBe(0);
        expect(quota.remainingOf(0)).toBe(quota.QUOTA_BYTES);
    });

    it("refuse tout envoi une fois le plafond atteint, même minuscule", () => {
        expect(quota.fits(quota.QUOTA_BYTES, 1)).toBe(false);
    });
});
