"use strict";

const request = require("supertest");

const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");

describe("Administration visuelle d'un serveur", () => {
    it("réserve la modification à un administrateur et enregistre logo et bannière", async () => {
        const owner = makeUser({ userId: 1, handle: "owner" });
        const token = authenticateAs(owner);
        const guild = {
            guildId: 7,
            name: "Studio",
            description: "Espace de travail",
            icon: "https://cdn.test/icon.webp",
            banner: "ocean",
            bannerImage: "https://cdn.test/banner.webp",
            accent: "#12b5a2",
            ownerId: 1,
        };

        on("guilds.findById", () => guild);
        on("access.guildPermission", () => [{ ownerId: 1, effect: null }]);
        on("guilds.update", (params, sql) => {
            expect(sql).toContain("icon = ?");
            expect(sql).toContain("bannerImage = ?");
            expect(params).toContain("https://cdn.test/icon.webp");
            expect(params).toContain("https://cdn.test/banner.webp");
            return { affectedRows: 1 };
        });

        const image = Buffer.from("image-content");
        const response = await request(createApp())
            .patch("/api/v1/guilds/7")
            .set("Authorization", token(owner))
            .field("name", "Studio")
            .field("description", "Espace de travail")
            .field("banner", "ocean")
            .field("accent", "#12b5a2")
            .field("removeIcon", "false")
            .field("removeBannerImage", "false")
            .attach("icon", image, { filename: "logo.png", contentType: "image/png" })
            .attach("bannerImage", image, { filename: "cover.png", contentType: "image/png" });

        expect(response.status).toBe(200);
        expect(response.body.guild).toMatchObject({
            guildId: 7,
            icon: "https://cdn.test/icon.webp",
            bannerImage: "https://cdn.test/banner.webp",
        });
    });

    it("refuse la modification à un membre sans consommer les fichiers", async () => {
        const member = makeUser({ userId: 2, handle: "member" });
        const token = authenticateAs(member);
        on("guilds.findById", () => ({ guildId: 7, name: "Studio", ownerId: 1 }));
        on("access.guildPermission", () => [{ ownerId: 1, effect: null }]);

        const response = await request(createApp())
            .patch("/api/v1/guilds/7")
            .set("Authorization", token(member))
            .field("name", "Détourné");

        expect(response.status).toBe(403);
    });
});
