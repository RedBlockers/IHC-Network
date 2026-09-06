"use strict";

const sessionService = require("../../src/services/sessionService");

describe("sessionService", () => {
    it("ne conserve jamais le jeton de renouvellement en clair", () => {
        const token = sessionService.generateRefreshToken();
        const digest = sessionService.digestRefreshToken(token);
        expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(digest).toMatch(/^[a-f0-9]{64}$/);
        expect(digest).not.toContain(token);
    });

    it("produit un cookie hôte-only, HttpOnly et strict sur une origine HTTPS", () => {
        const cookie = sessionService.refreshCookieOptions(true);
        expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: "strict", path: "/" });
        expect(sessionService.refreshCookieName(true)).toBe("__Host-qweillo.refresh");
    });

    it("renonce au préfixe __Host- et à Secure quand l'instance est servie en HTTP", () => {
        const cookie = sessionService.refreshCookieOptions(false);
        expect(cookie).toMatchObject({ httpOnly: true, secure: false, sameSite: "strict", path: "/" });
        expect(sessionService.refreshCookieName(false)).toBe("qweillo.refresh");
    });
});
