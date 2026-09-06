"use strict";

const request = require("supertest");
const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");

describe("Conversations de groupe", () => {
    const alice = makeUser({ userId: 1, handle: "alice" });
    const app = createApp();
    let token;

    beforeEach(() => {
        token = authenticateAs(alice);
        on("friendships.listAcceptedIds", () => [{ userId: 2 }, { userId: 3 }, { userId: 4 }]);
        on("groups.create", () => ({ insertId: 50, affectedRows: 1 }));
        on("groups.addParticipants", () => ({ affectedRows: 3 }));
        on("groups.countParticipants", () => ({ total: 3 }));
    });

    const auth = (call) => call.set("Authorization", token(alice));

    describe("Création", () => {
        test("réunit des amis", async () => {
            const response = await auth(request(app).post("/api/v1/users/me/groups"))
                .send({ name: "Expédition", userIds: [2, 3] })
                .expect(201);

            expect(response.body.participants).toBe(3);
        });

        test("refuse d'y mettre quelqu'un qui n'est pas un ami", async () => {
            on("groups.create", () => {
                throw new Error("aucun groupe ne doit être créé");
            });

            await auth(request(app).post("/api/v1/users/me/groups"))
                .send({ userIds: [2, 99] })
                .expect(400);
        });

        test("refuse un groupe à deux", async () => {
            await auth(request(app).post("/api/v1/users/me/groups")).send({ userIds: [2] }).expect(400);
        });

        test("dix personnes exactement passent, onze non", async () => {
            on("friendships.listAcceptedIds", () => Array.from({ length: 12 }, (_v, i) => ({ userId: i + 2 })));

            await auth(request(app).post("/api/v1/users/me/groups"))
                .send({ userIds: [2, 3, 4, 5, 6, 7, 8, 9, 10] })
                .expect(201);

            await auth(request(app).post("/api/v1/users/me/groups"))
                .send({ userIds: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11] })
                .expect(400);
        });

        test("ne s'ajoute pas soi-même deux fois", async () => {
            let written = null;
            on("groups.addParticipants", (params) => {
                written = params;
                return { affectedRows: 3 };
            });

            await auth(request(app).post("/api/v1/users/me/groups"))
                .send({ userIds: [1, 2, 3] })
                .expect(201);

            const ids = written.filter((_v, i) => i % 2 === 1).map(Number);
            expect(ids.filter((id) => id === 1)).toHaveLength(1);
        });
    });

    describe("Départ et retrait", () => {
        const asGroup = (ownerId) =>
            on("access.resolveChannel", () => [
                { channelId: 50, type: "text", guildId: null, friendshipId: null, isGroup: 1, groupOwnerId: ownerId },
            ]);

        test("chacun peut partir", async () => {
            asGroup(9);
            on("groups.removeParticipant", () => ({ affectedRows: 1 }));

            await auth(request(app).delete("/api/v1/channels/50/participants/1")).expect(204);
        });

        test("seul le créateur peut retirer quelqu'un d'autre", async () => {
            asGroup(9);
            on("groups.removeParticipant", () => {
                throw new Error("aucun retrait ne doit avoir lieu");
            });

            await auth(request(app).delete("/api/v1/channels/50/participants/2")).expect(403);
        });

        test("le créateur peut retirer quelqu'un", async () => {
            asGroup(1);
            on("groups.removeParticipant", () => ({ affectedRows: 1 }));

            await auth(request(app).delete("/api/v1/channels/50/participants/2")).expect(204);
        });
    });

    test("un groupe sans titre se nomme par ses participants", async () => {
        on("groups.listForUser", () => [
            { channelId: 50, name: null, groupOwnerId: 1, participants: 4, others: JSON.stringify(["Bob", "Carla", "Dan"]) },
        ]);

        const response = await auth(request(app).get("/api/v1/users/me/groups")).expect(200);

        expect(response.body.groups[0].name).toBe("Bob, Carla, Dan");
        expect(response.body.groups[0].named).toBe(false);
    });
});
