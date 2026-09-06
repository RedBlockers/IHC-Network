"use strict";

const request = require("supertest");
const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");
const richPresence = require("../../src/services/richPresenceService");

describe("Présence détaillée", () => {
    const alice = makeUser({ userId: 1, handle: "alice" });
    const app = createApp();
    let token;

    beforeEach(() => {
        token = authenticateAs(alice);
    });

    const auth = (call) => call.set("Authorization", token(alice));

    describe("Règle de visibilité", () => {
        test("« tout le monde » laisse voir", () => {
            expect(richPresence.allows("everyone", { isSelf: false, isFriend: false })).toBe(true);
        });

        test("« amis » ne laisse voir qu'aux amis", () => {
            expect(richPresence.allows("friends", { isSelf: false, isFriend: true })).toBe(true);
            expect(richPresence.allows("friends", { isSelf: false, isFriend: false })).toBe(false);
        });

        test("« personne » ne laisse voir à personne", () => {
            expect(richPresence.allows("nobody", { isSelf: false, isFriend: true })).toBe(false);
        });

        test("on se voit toujours soi-même", () => {
            expect(richPresence.allows("nobody", { isSelf: true, isFriend: false })).toBe(true);
        });
    });

    describe("Application côté serveur", () => {
        const withActivity = (visibility) =>
            on("presence.listActivities", () => [
                {
                    userId: 2,
                    presenceVisibility: "everyone",
                    activityVisibility: visibility,
                    kind: "editing",
                    name: "rapport.md",
                    detail: null,
                    context: "docs",
                    startedAt: new Date(),
                },
            ]);

        test("une activité privée ne part pas du serveur", async () => {
            withActivity("nobody");
            on("friendships.listAcceptedIds", () => []);

            const visible = await richPresence.activitiesFor(1, [2]);

            expect(visible.get(2).activity).toBeNull();
        });

        test("une activité réservée aux amis part pour un ami", async () => {
            withActivity("friends");
            on("friendships.listAcceptedIds", () => [{ userId: 2 }]);

            const visible = await richPresence.activitiesFor(1, [2]);

            expect(visible.get(2).activity.name).toBe("rapport.md");
        });

        test("une activité réservée aux amis ne part pas pour un inconnu", async () => {
            withActivity("friends");
            on("friendships.listAcceptedIds", () => []);

            expect((await richPresence.activitiesFor(1, [2])).get(2).activity).toBeNull();
        });
    });

    describe("Expiration", () => {
        test("les lignes périmées sont écartées par la requête", async () => {
            let sql = null;
            on("presence.listActivities", (_params, statement) => {
                sql = statement;
                return [];
            });
            on("friendships.listAcceptedIds", () => []);

            await richPresence.activitiesFor(1, [2]);

            expect(sql).toContain("expiresAt > NOW()");
        });

        test("la durée est bornée", async () => {
            let written = null;
            on("presence.setActivity", (params) => {
                written = params;
                return { affectedRows: 1 };
            });

            await auth(request(app).put("/api/v1/users/me/activity"))
                .send({ kind: "meeting", name: "point hebdo", minutes: 100000 })
                .expect(400);

            expect(written).toBeNull();
        });

        test("sans durée, une valeur par défaut s'applique", async () => {
            let written = null;
            on("presence.setActivity", (params) => {
                written = params;
                return { affectedRows: 1 };
            });

            await auth(request(app).put("/api/v1/users/me/activity"))
                .send({ kind: "playing", name: "un jeu" })
                .expect(200);

            expect(written.at(-1)).toBeInstanceOf(Date);
        });
    });

    test("un type d'activité inventé est refusé", async () => {
        await auth(request(app).put("/api/v1/users/me/activity"))
            .send({ kind: "hacking", name: "x" })
            .expect(400);
    });

    describe("Profil par communauté", () => {
        beforeEach(() => {
            on("guilds.findById", () => [{ guildId: 4, name: "Laguna", ownerId: 1 }]);
            on("access.guildRole", () => [{ role: "member" }]);
        });

        test("enregistre un profil propre à la communauté", async () => {
            let written = null;
            on("presence.upsertProfile", (params) => {
                written = params;
                return { affectedRows: 1 };
            });

            await auth(request(app).put("/api/v1/guilds/4/profile"))
                .send({ displayName: "Ali", aboutMe: "collègue" })
                .expect(200);

            expect(written).toContain("Ali");
        });

        test("un profil vide efface la personnalisation", async () => {
            let deleted = false;
            on("presence.deleteProfile", () => {
                deleted = true;
                return { affectedRows: 1 };
            });

            const response = await auth(request(app).put("/api/v1/guilds/4/profile")).send({}).expect(200);


            expect(deleted).toBe(true);
            expect(response.body.profile).toBeNull();
        });
    });
});
