"use strict";

const request = require("supertest");

const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");

const GUILD = 7;
const user = makeUser({ userId: 1, handle: "alice" });

const messageRow = (messageId, channelId, channelName, content) => ({
    messageId, channelId, content, createdAt: new Date(), editedAt: null, encryptionEpoch: null,
    userId: 1, handle: "alice", displayName: "Alice", avatar: null,
    channelName, channelType: "text", reactions: [],
});

describe("Recherche et épinglage", () => {
    it("ne cherche que dans les salons réellement lisibles", async () => {
        const authorization = authenticateAs(user)(user);
        on("guilds.findById", () => ({ guildId: GUILD, ownerId: 99, name: "Atelier" }));
        on("access.guildRole", () => ({ role: "member" }));
        on("channels.listByGuild", () => [
            { channelId: 10, guildId: GUILD, type: "text", name: "général", position: 0, e2eeEnabled: 0 },
            { channelId: 11, guildId: GUILD, type: "text", name: "direction", position: 1, e2eeEnabled: 0 },
        ]);
        on("access.channelPermission", (params) => [{
            ownerId: 99,
            baseEffect: Number(params[2]) === 11 ? "deny" : "allow",
            targetType: null,
            overrideEffect: null,
        }]);

        let searched = null;
        on("search.messages", (params) => {
            searched = params;
            return [messageRow("100", 10, "général", "la taverne ouvre")];
        });

        const response = await request(createApp())
            .get(`/api/v1/guilds/${GUILD}/search?q=taverne`)
            .set("Authorization", authorization);

        expect(response.status).toBe(200);
        expect(searched.slice(0, 1)).toEqual([10]);
        expect(searched).not.toContain(11);
        expect(response.body.results).toHaveLength(1);
        expect(response.body.results[0].channel.name).toBe("général");
    });

    it("écarte les salons chiffrés et le dit au lieu de renvoyer un silence", async () => {
        const authorization = authenticateAs(user)(user);
        on("guilds.findById", () => ({ guildId: GUILD, ownerId: 99, name: "Atelier" }));
        on("access.guildRole", () => ({ role: "member" }));
        on("channels.listByGuild", () => [
            { channelId: 10, guildId: GUILD, type: "text", name: "général", position: 0, e2eeEnabled: 0 },
            { channelId: 12, guildId: GUILD, type: "text", name: "conseil", position: 1, e2eeEnabled: 1 },
        ]);
        on("access.channelPermission", () => [{ ownerId: 99, baseEffect: "allow", targetType: null, overrideEffect: null }]);

        let searched = null;
        on("search.messages", (params) => {
            searched = params;
            return [];
        });

        const response = await request(createApp())
            .get(`/api/v1/guilds/${GUILD}/search?q=taverne`)
            .set("Authorization", authorization);

        expect(response.status).toBe(200);
        expect(searched).not.toContain(12);
        expect(response.body.excludedEncrypted).toEqual(["conseil"]);
    });

    it("ne cherche nulle part quand aucun salon n'est lisible", async () => {
        const authorization = authenticateAs(user)(user);
        on("guilds.findById", () => ({ guildId: GUILD, ownerId: 99, name: "Atelier" }));
        on("access.guildRole", () => ({ role: "member" }));
        on("channels.listByGuild", () => [
            { channelId: 11, guildId: GUILD, type: "text", name: "direction", position: 0, e2eeEnabled: 0 },
        ]);
        on("access.channelPermission", () => [{ ownerId: 99, baseEffect: "deny", targetType: null, overrideEffect: null }]);
        on("search.messages", () => {
            throw new Error("la recherche ne doit pas être exécutée");
        });

        const response = await request(createApp())
            .get(`/api/v1/guilds/${GUILD}/search?q=taverne`)
            .set("Authorization", authorization);

        expect(response.status).toBe(200);
        expect(response.body.results).toEqual([]);
    });

    it("refuse une recherche trop courte", async () => {
        const authorization = authenticateAs(user)(user);
        on("guilds.findById", () => ({ guildId: GUILD, ownerId: 99, name: "Atelier" }));
        on("access.guildRole", () => ({ role: "member" }));

        const response = await request(createApp())
            .get(`/api/v1/guilds/${GUILD}/search?q=a`)
            .set("Authorization", authorization);

        expect(response.status).toBe(400);
    });

    it("épingle un message du salon et refuse un message venu d'ailleurs", async () => {
        const authorization = authenticateAs(user)(user);
        on("access.resolveChannel", () => ({ channelId: 10, guildId: GUILD, type: "text", name: "général", position: 0 }));
        on("access.channelPermission", () => [{ ownerId: 1, baseEffect: "allow", targetType: null, overrideEffect: null }]);
        on("access.guildRole", () => ({ role: "member" }));

        on("messages.channelOf", () => ({ channelId: 99 }));
        const foreign = await request(createApp())
            .put("/api/v1/channels/10/messages/500/pin")
            .set("Authorization", authorization);
        expect(foreign.status).toBe(404);

        on("messages.channelOf", () => ({ channelId: 10 }));
        on("search.countPins", () => ({ total: 3 }));
        on("search.pin", () => ({ affectedRows: 1 }));
        on("search.listPins", () => [{ ...messageRow("500", 10, "général", "épinglé"), pinnedAt: new Date(), pinnedBy: 1 }]);

        const pinned = await request(createApp())
            .put("/api/v1/channels/10/messages/500/pin")
            .set("Authorization", authorization);
        expect(pinned.status).toBe(201);
        expect(pinned.body.pins).toHaveLength(1);
    });

    it("plafonne le nombre de messages épinglés", async () => {
        const authorization = authenticateAs(user)(user);
        on("access.resolveChannel", () => ({ channelId: 10, guildId: GUILD, type: "text", name: "général", position: 0 }));
        on("access.channelPermission", () => [{ ownerId: 1, baseEffect: "allow", targetType: null, overrideEffect: null }]);
        on("access.guildRole", () => ({ role: "member" }));
        on("messages.channelOf", () => ({ channelId: 10 }));
        on("search.countPins", () => ({ total: 50 }));

        const response = await request(createApp())
            .put("/api/v1/channels/10/messages/500/pin")
            .set("Authorization", authorization);

        expect(response.status).toBe(403);
        expect(response.body.error.message).toMatch(/50 messages épinglés/);
    });
});
