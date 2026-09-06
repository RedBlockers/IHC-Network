"use strict";

const request = require("supertest");

const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");
const { allowWrite } = require("../helpers/writePath");

describe("Communauté suspendue", () => {
    const owner = makeUser({ userId: 1, handle: "ada" });
    const app = createApp();
    let token;

    const guild = (overrides = {}) => ({
        guildId: 7,
        name: "Laguna",
        ownerId: 1,
        suspendedAt: null,
        suspendedReason: null,
        ...overrides,
    });

    const suspended = () => {
        on("guilds.findById", () => [guild({ suspendedAt: new Date(), suspendedReason: "Raid en cours." })]);
        on("access.resolveChannel", () => ({
            channelId: 10,
            guildId: 7,
            type: "text",
            name: "général",
            position: 0,
            suspendedAt: new Date(),
            suspendedReason: "Raid en cours.",
        }));
    };

    beforeEach(() => {
        token = authenticateAs(owner)(owner);
        on("guilds.findById", () => [guild()]);
        on("guilds.findRole", () => [{ role: "owner" }]);
        on("access.guildRole", () => ({ role: "owner" }));
        on("access.guildPermission", () => [{ ownerId: 1, effect: "allow" }]);
        on("access.channelPermission", () => [{ ownerId: 1, baseEffect: "allow", targetType: null, overrideEffect: null }]);
        allowWrite();
    });

    const auth = (req) => req.set("Authorization", token);

    it("refuse un message avec la raison du gel", async () => {
        suspended();

        const response = await auth(request(app).post("/api/v1/channels/10/messages").send({ content: "coucou" }));

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe("guild_suspended");
        expect(response.body.error.details.reason).toBe("Raid en cours.");
    });

    it("laisse lire l'historique", async () => {
        suspended();
        on("messages.listByChannel", () => []);
        on("channels.findById", () => guild({ channelId: 10 }));

        const response = await auth(request(app).get("/api/v1/channels/10/messages"));

        expect(response.status).toBe(200);
    });

    it("gèle aussi les modifications de la communauté, pas seulement les messages", async () => {
        suspended();

        const response = await auth(request(app).patch("/api/v1/guilds/7").send({ name: "Autre nom" }));

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe("guild_suspended");
    });

    it("exige un motif d'au moins une phrase", async () => {
        const response = await auth(request(app).post("/api/v1/guilds/7/suspend").send({ reason: "raid" }));

        expect(response.status).toBe(400);
    });

    it("n'appartient qu'au propriétaire", async () => {
        const admin = makeUser({ userId: 2, handle: "alan" });
        const adminToken = authenticateAs(owner, admin)(admin);
        on("access.guildRole", () => ({ role: "owner" }));

        const response = await request(app)
            .post("/api/v1/guilds/7/suspend")
            .set("Authorization", adminToken)
            .send({ reason: "Un raid est en cours ce soir." });

        expect(response.status).toBe(403);
        expect(response.body.error.message).toMatch(/propriétaire/i);
    });

    it("laisse toujours passer la reprise, sinon la suspension serait définitive", async () => {
        suspended();
        let written = null;
        on("guilds.setSuspension", (params) => {
            written = params;
            return { affectedRows: 1 };
        });
        let read = 0;
        on("guilds.findById", () => [(read++ === 0 ? guild({ suspendedAt: new Date() }) : guild())]);

        const response = await auth(request(app).post("/api/v1/guilds/7/resume"));

        expect(response.status).toBe(200);
        expect(response.body.guild).toMatchObject({ guildId: 7, suspendedAt: null });
        expect(written.slice(0, 3)).toEqual([null, null, null]);
    });

    it("refuse de suspendre deux fois", async () => {
        suspended();

        const response = await auth(
            request(app).post("/api/v1/guilds/7/suspend").send({ reason: "Un raid est en cours ce soir." })
        );

        expect(response.status).toBe(409);
    });
});
