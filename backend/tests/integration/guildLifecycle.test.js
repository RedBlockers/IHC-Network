"use strict";

const request = require("supertest");
const createApp = require("../../src/app");
const { on, isTransactionActive } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");

describe("Cycle de vie d'une communauté", () => {
    const alice = makeUser({ userId: 1, handle: "alice" });
    const app = createApp();
    let token;

    beforeEach(() => {
        token = authenticateAs(alice);
        on("guilds.findById", () => [{ guildId: 7, name: "Laguna", ownerId: 1 }]);
        on("access.guildRole", () => [{ role: "owner" }]);
        on("access.guildPermission", () => [{ ownerId: 1, effect: "allow" }]);
    });

    describe("Invitations", () => {
        const rows = () => [
            { inviteId: 1, code: "aaaa", uses: 3, maxUses: 10, expiresAt: null, revokedAt: null, createdAt: "2026-08-01", authorId: 1, authorHandle: "alice", authorDisplayName: "Alice", authorAvatar: null },
            { inviteId: 2, code: "bbbb", uses: 5, maxUses: 5, expiresAt: null, revokedAt: null, createdAt: "2026-08-02", authorId: 1, authorHandle: "alice", authorDisplayName: "Alice", authorAvatar: null },
            { inviteId: 3, code: "cccc", uses: 0, maxUses: null, expiresAt: "2020-01-01T00:00:00.000Z", revokedAt: null, createdAt: "2026-08-03", authorId: 1, authorHandle: "alice", authorDisplayName: "Alice", authorAvatar: null },
            { inviteId: 4, code: "dddd", uses: 1, maxUses: null, expiresAt: null, revokedAt: "2026-08-04", createdAt: "2026-08-04", authorId: 1, authorHandle: "alice", authorDisplayName: "Alice", authorAvatar: null },
        ];

        test("distingue quatre états plutôt que « valide » et « invalide »", async () => {
            on("invites.listByGuild", rows);

            const response = await request(app)
                .get("/api/v1/guilds/7/invites")
                .set("Authorization", token(alice))
                .expect(200);

            expect(response.body.invites.map((invite) => invite.status)).toEqual([
                "active",
                "exhausted",
                "expired",
                "revoked",
            ]);
        });

        test("révoquer une invitation la retire", async () => {
            on("invites.listByGuild", rows);
            let seen = null;
            on("invites.revoke", (params) => {
                seen = params;
                return { affectedRows: 1 };
            });

            await request(app)
                .delete("/api/v1/guilds/7/invites/1")
                .set("Authorization", token(alice))
                .expect(200);

            expect(seen.map(Number)).toEqual([1, 7]);
        });

        test("révoquer deux fois ne déplace pas la date du premier retrait", async () => {
            on("invites.listByGuild", rows);
            let sql = null;
            on("invites.revoke", (_params, statement) => {
                sql = statement;
                return { affectedRows: 0 };
            });

            await request(app)
                .delete("/api/v1/guilds/7/invites/4")
                .set("Authorization", token(alice))
                .expect(200);

            expect(sql).toContain("revokedAt IS NULL");
        });

        test("refuse une invitation d'une autre communauté", async () => {
            on("invites.listByGuild", rows);
            on("invites.revoke", () => ({ affectedRows: 0 }));

            await request(app)
                .delete("/api/v1/guilds/7/invites/999")
                .set("Authorization", token(alice))
                .expect(404);
        });
    });

    describe("Transfert de propriété", () => {
        beforeEach(() => {
            on("guilds.getMembership", () => ({ role: "member" }));
            on("guilds.setOwner", () => ({ affectedRows: 1 }));
            on("guilds.setMemberRole", () => ({ affectedRows: 1 }));
        });

        test("écrit les trois changements dans une seule transaction", async () => {
            const written = [];
            on("guilds.setOwner", (params) => {
                expect(isTransactionActive()).toBe(true);
                written.push(["owner", Number(params[0])]);
                return { affectedRows: 1 };
            });
            on("guilds.setMemberRole", (params) => {
                expect(isTransactionActive()).toBe(true);
                written.push([params[0], Number(params[2])]);
                return { affectedRows: 1 };
            });

            await request(app)
                .post("/api/v1/guilds/7/transfer")
                .set("Authorization", token(alice))
                .send({ userId: 2, confirm: "Laguna" })
                .expect(200);

            expect(written).toEqual([["owner", 2], ["owner", 2], ["admin", 1]]);
        });

        test("refuse sans le nom exact de la communauté", async () => {
            await request(app)
                .post("/api/v1/guilds/7/transfer")
                .set("Authorization", token(alice))
                .send({ userId: 2, confirm: "laguna" })
                .expect(400);
        });

        test("refuse de transférer à quelqu'un qui n'est pas membre", async () => {
            on("guilds.getMembership", () => null);

            await request(app)
                .post("/api/v1/guilds/7/transfer")
                .set("Authorization", token(alice))
                .send({ userId: 42, confirm: "Laguna" })
                .expect(404);
        });

        test("refuse de se transférer à soi-même", async () => {
            await request(app)
                .post("/api/v1/guilds/7/transfer")
                .set("Authorization", token(alice))
                .send({ userId: 1, confirm: "Laguna" })
                .expect(400);
        });

        test("refuse à qui n'est pas propriétaire", async () => {
            on("access.guildRole", () => [{ role: "admin" }]);

            await request(app)
                .post("/api/v1/guilds/7/transfer")
                .set("Authorization", token(alice))
                .send({ userId: 2, confirm: "Laguna" })
                .expect(403);
        });
    });

    describe("Suppression", () => {
        test("supprime sur confirmation du nom exact", async () => {
            let deleted = null;
            on("guilds.delete", (params) => {
                deleted = Number(params[0]);
                return { affectedRows: 1 };
            });

            await request(app)
                .delete("/api/v1/guilds/7")
                .set("Authorization", token(alice))
                .send({ confirm: "Laguna" })
                .expect(200);

            expect(deleted).toBe(7);
        });

        test("refuse une confirmation approximative", async () => {
            on("guilds.delete", () => {
                throw new Error("rien ne doit être supprimé sans le nom exact");
            });

            await request(app)
                .delete("/api/v1/guilds/7")
                .set("Authorization", token(alice))
                .send({ confirm: "Lagunaa" })
                .expect(400);
        });

        test("la confirmation est vérifiée par le serveur, pas seulement par l'écran", async () => {
            on("guilds.delete", () => {
                throw new Error("rien ne doit être supprimé");
            });

            await request(app)
                .delete("/api/v1/guilds/7")
                .set("Authorization", token(alice))
                .send({ confirm: "x" })
                .expect(400);
        });

        test("refuse à qui n'est pas propriétaire", async () => {
            on("access.guildRole", () => [{ role: "admin" }]);

            await request(app)
                .delete("/api/v1/guilds/7")
                .set("Authorization", token(alice))
                .send({ confirm: "Laguna" })
                .expect(403);
        });
    });
});
