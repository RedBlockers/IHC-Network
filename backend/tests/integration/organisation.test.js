"use strict";

const request = require("supertest");
const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");

describe("Organisation personnelle", () => {
    const alice = makeUser({ userId: 1, handle: "alice" });
    const app = createApp();
    let token;

    beforeEach(() => {
        token = authenticateAs(alice);
        on("organisation.listFolders", () => [{ folderId: 5, name: "Travail", color: "#12b5a2", position: 0 }]);
        on("organisation.listGuildPrefs", () => [{ guildId: 7, folderId: 5, isFavorite: 1, position: 2 }]);
        on("organisation.listChannelPrefs", () => [{ channelId: 30, isFavorite: 1 }]);
        on("organisation.findDisplayPrefs", () => ({ hideReadChannels: 0 }));
    });

    const auth = (call) => call.set("Authorization", token(alice));

    test("rend dossiers, placements, favoris et préférences d'affichage", async () => {
        const response = await auth(request(app).get("/api/v1/organisation")).expect(200);

        expect(response.body.folders[0].name).toBe("Travail");
        expect(response.body.guilds[0]).toEqual({ guildId: 7, folderId: 5, isFavorite: true, position: 2 });
        expect(response.body.favoriteChannels).toEqual([30]);
        expect(response.body.hideReadChannels).toBe(false);
    });

    test("toute lecture part du compte connecté", async () => {
        let captured = null;
        on("organisation.listGuildPrefs", (params) => {
            captured = params;
            return [];
        });

        await auth(request(app).get("/api/v1/organisation")).expect(200);

        expect(captured).toEqual([1]);
    });

    describe("Dossiers", () => {
        test("crée un dossier à la suite des autres", async () => {
            on("organisation.nextFolderPosition", () => ({ position: 3 }));
            on("organisation.createFolder", () => ({ insertId: 9, affectedRows: 1 }));

            const response = await auth(request(app).post("/api/v1/organisation/folders"))
                .send({ name: "  Perso  ", color: "#ff8800" })
                .expect(201);

            expect(response.body.folder.name).toBe("Perso");
            expect(response.body.folder.position).toBe(3);
        });

        test("refuse de modifier un dossier qui n'est pas le sien", async () => {
            on("organisation.updateFolder", () => {
                throw new Error("aucune écriture ne doit avoir lieu");
            });

            await auth(request(app).patch("/api/v1/organisation/folders/99"))
                .send({ name: "Volé" })
                .expect(404);
        });

        test("supprimer un dossier ne supprime pas ce qu'il contenait", async () => {
            let sql = null;
            on("organisation.deleteFolder", (_params, statement) => {
                sql = statement;
                return { affectedRows: 1 };
            });

            await auth(request(app).delete("/api/v1/organisation/folders/5")).expect(204);

            expect(sql).toContain("DELETE FROM guild_folders");
            expect(sql).not.toContain("user_guild_prefs");
        });

        test("refuse de supprimer un dossier inexistant", async () => {
            on("organisation.deleteFolder", () => ({ affectedRows: 0 }));

            await auth(request(app).delete("/api/v1/organisation/folders/42")).expect(404);
        });
    });

    describe("Placement d'une communauté", () => {
        beforeEach(() => {
            on("guilds.getMembership", () => ({ role: "member" }));
            on("organisation.findGuildPref", () => ({ guildId: 7, folderId: 5, isFavorite: 1, position: 2 }));
            on("organisation.setGuildPref", () => ({ affectedRows: 1 }));
        });

        test("un champ absent conserve la valeur courante", async () => {
            let written = null;
            on("organisation.setGuildPref", (params) => {
                written = params;
                return { affectedRows: 1 };
            });

            await auth(request(app).put("/api/v1/organisation/guilds/7"))
                .send({ isFavorite: false })
                .expect(200);

            expect(written).toEqual([1, 7, 5, 0, 2]);
        });

        test("« hors dossier » se demande explicitement", async () => {
            let written = null;
            on("organisation.setGuildPref", (params) => {
                written = params;
                return { affectedRows: 1 };
            });

            await auth(request(app).put("/api/v1/organisation/guilds/7"))
                .send({ folderId: null })
                .expect(200);

            expect(written[2]).toBeNull();
        });

        test("refuse de ranger une communauté qu'on n'a pas rejointe", async () => {
            on("guilds.getMembership", () => null);

            await auth(request(app).put("/api/v1/organisation/guilds/999"))
                .send({ isFavorite: true })
                .expect(404);
        });

        test("refuse un dossier appartenant à quelqu'un d'autre", async () => {
            await auth(request(app).put("/api/v1/organisation/guilds/7"))
                .send({ folderId: 99 })
                .expect(404);
        });
    });

    describe("Favoris de salons", () => {
        test("refuse un salon auquel on n'a pas accès", async () => {
            on("access.resolveChannel", () => []);
            on("organisation.setChannelFavorite", () => {
                throw new Error("aucune écriture ne doit avoir lieu");
            });

            await auth(request(app).put("/api/v1/organisation/channels/30"))
                .send({ isFavorite: true })
                .expect(404);
        });

        test("accepte un salon accessible", async () => {
            on("access.resolveChannel", () => [{ channelId: 30, type: "text", guildId: 7, friendshipId: null }]);
            on("access.channelPermission", () => [{ ownerId: 1, baseEffect: "allow", targetType: null, overrideEffect: null }]);
            on("organisation.setChannelFavorite", () => ({ affectedRows: 1 }));

            const response = await auth(request(app).put("/api/v1/organisation/channels/30"))
                .send({ isFavorite: true })
                .expect(200);

            expect(response.body).toEqual({ channelId: 30, isFavorite: true });
        });
    });

    test("masquer les salons lus est une préférence d'affichage", async () => {
        on("organisation.setHideReadChannels", () => ({ affectedRows: 1 }));

        const response = await auth(request(app).put("/api/v1/organisation/display"))
            .send({ hideReadChannels: true })
            .expect(200);

        expect(response.body).toEqual({ hideReadChannels: true });
    });
});
