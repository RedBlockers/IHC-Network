"use strict";

const request = require("supertest");
const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");

describe("Profil utilisateur", () => {
    it("modifie l'identité, le statut, l'avatar et la bannière du compte connecté", async () => {
        const current = makeUser({ userId: 7, handle: "alice", displayName: "Alice" });
        const token = authenticateAs(current);
        on("users.updateProfile", (params, sql) => {
            expect(sql).toContain("statusPreference = ?");
            expect(sql).toContain("bannerImage = ?");
            expect(params).toContain("dnd");
            return { affectedRows: 1 };
        });
        on("users.findById", () => ({
            ...current,
            handle: "alice-pro",
            displayName: "Alice Pro",
            aboutMe: "Créatrice",
            activityText: "Travaille sur qweillo",
            avatar: "https://cdn.test/avatar.webp",
            bannerImage: "https://cdn.test/user-banner.webp",
            statusPreference: "dnd",
        }));
        on("guilds.listIdsForUser", () => [{ guildId: 2 }]);
        on("friendships.listForUser", () => []);

        const image = Buffer.from("image-content");
        const response = await request(createApp())
            .patch("/api/v1/users/me")
            .set("Authorization", token(current))
            .field("handle", "alice-pro")
            .field("displayName", "Alice Pro")
            .field("aboutMe", "Créatrice")
            .field("activityText", "Travaille sur qweillo")
            .field("statusPreference", "dnd")
            .field("removeAvatar", "false")
            .field("removeBannerImage", "false")
            .attach("avatar", image, { filename: "avatar.png", contentType: "image/png" })
            .attach("bannerImage", image, { filename: "banner.png", contentType: "image/png" });

        expect(response.status).toBe(200);
        expect(response.body.user).toMatchObject({
            handle: "alice-pro",
            displayName: "Alice Pro",
            statusPreference: "dnd",
            bannerImage: "https://cdn.test/user-banner.webp",
        });
    });
});
