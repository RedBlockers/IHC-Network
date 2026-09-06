"use strict";

const request = require("supertest");

const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");
const themeService = require("../../src/services/themeService");

describe("Thème de communauté", () => {
    const owner = makeUser({ userId: 1, handle: "ada" });
    const app = createApp();
    let token;

    beforeEach(() => {
        token = authenticateAs(owner)(owner);
        on("guilds.findById", () => [{ guildId: 7, name: "Laguna", ownerId: 1, suspendedAt: null }]);
        on("access.guildPermission", () => [{ ownerId: 1, effect: "allow" }]);
        on("access.guildRole", () => ({ role: "owner" }));
        on("themes.create", () => ({ insertId: 12 }));
    });

    const auth = (req) => req.set("Authorization", token);

    const stored = (overrides = {}) => ({
        themeId: 12,
        guildId: 7,
        tokens: JSON.stringify({ accent: "#12b5a2", accent2: null, surfaceTint: 4, radiusDelta: 2 }),
        label: "Automne",
        effectiveAt: new Date(Date.now() - 1000),
        createdBy: 1,
        createdAt: new Date(),
        ...overrides,
    });

    it("n'accepte que les quatre leviers prévus", async () => {
        const response = await auth(
            request(app).post("/api/v1/guilds/7/themes").send({ tokens: { accent: "#12b5a2", bgBase: "#000000" } })
        );

        expect(response.status).toBe(400);
    });

    it("refuse une teinte qui reste illisible même corrigée", () => {
        expect(() => themeService.validate({ accent: "#12b5a2" })).not.toThrow();
        expect(() => themeService.validate({ surfaceTint: 40 })).toThrow(/teinte d'ambiance/i);
        expect(() => themeService.validate({ radiusDelta: 40 })).toThrow(/arrondi/i);
    });

    it("plafonne la teinte d'ambiance pour qu'elle reste une teinte", () => {
        expect(themeService.MAX_TINT_ALPHA).toBeLessThanOrEqual(8);
        expect(() => themeService.validate({ surfaceTint: themeService.MAX_TINT_ALPHA })).not.toThrow();
    });

    it("publie une version qui prend effet tout de suite", async () => {
        let written = null;
        on("themes.create", (params) => {
            written = params;
            return { insertId: 12 };
        });
        on("themes.findById", () => stored());

        const response = await auth(
            request(app).post("/api/v1/guilds/7/themes").send({ tokens: { accent: "#12b5a2" }, label: "Automne" })
        );

        expect(response.status).toBe(201);
        expect(response.body.theme.active).toBe(true);
        expect(written[3]).toBeInstanceOf(Date);
    });

    it("garde une publication programmée hors service jusqu'à sa date", async () => {
        const later = new Date(Date.now() + 3600_000);
        on("themes.findById", () => stored({ effectiveAt: later }));

        const response = await auth(
            request(app)
                .post("/api/v1/guilds/7/themes")
                .send({ tokens: { accent: "#12b5a2" }, scheduledFor: later.toISOString() })
        );

        expect(response.status).toBe(201);
        expect(response.body.theme.active).toBe(false);
    });

    it("revient en arrière en republiant, sans effacer ce qui suit", async () => {
        on("themes.findById", () => stored({ label: "Été" }));
        let written = null;
        on("themes.create", (params) => {
            written = params;
            return { insertId: 13 };
        });

        const response = await auth(request(app).post("/api/v1/guilds/7/themes/12/rollback"));

        expect(response.status).toBe(201);
        expect(written[2]).toMatch(/Retour à/);
    });

    it("n'annule qu'une publication qui n'a pas encore pris effet", async () => {
        on("themes.findById", () => stored({ effectiveAt: new Date(Date.now() - 1000) }));

        const response = await auth(request(app).delete("/api/v1/guilds/7/themes/12"));

        expect(response.status).toBe(400);
    });

    it("ne rend jamais le thème d'une autre communauté", async () => {
        on("themes.findById", () => stored({ guildId: 99 }));

        const response = await auth(request(app).post("/api/v1/guilds/7/themes/12/rollback"));

        expect(response.status).toBe(404);
    });
});
