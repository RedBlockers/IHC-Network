"use strict";

const request = require("supertest");

const createApp = require("../../src/app");
const { ServiceUnavailable } = require("../../src/errors");
const storageService = require("../../src/services/storageService");
const { on, isTransactionActive } = require("../helpers/db");

function userRow() {
    return {
        userId: 29,
        handle: "newmember",
        displayName: "New Member",
        email: "newmember@example.test",
        avatar: "/assets/default-avatar.png",
        aboutMe: "",
        presence: "offline",
        statusPreference: "online",
        isBot: 0,
        isEmailVerified: 0,
        isBanned: 0,
        bannedUntil: null,
        passwordUpdatedAt: new Date(),
        createdAt: new Date(),
    };
}

function registrationRequest() {
    return request(createApp())
        .post("/api/v1/auth/register")
        .field("handle", "newmember")
        .field("displayName", "New Member")
        .field("email", "newmember@example.test")
        .field("password", "correct-horse-battery-staple")
        .attach("avatar", Buffer.from("image"), { filename: "avatar.png", contentType: "image/png" });
}

describe("Atomicité de l'inscription", () => {
    afterEach(() => jest.restoreAllMocks());

    it("traite l'avatar avant la validation de la transaction utilisateur", async () => {
        let avatarInsideTransaction = false;
        on("users.create", (_params, _sql, connection) => {
            expect(connection).toMatchObject({ __txn: true });
            return { insertId: 29 };
        });
        on("users.findById", () => userRow());
        jest.spyOn(storageService, "saveAvatar").mockImplementation(async () => {
            avatarInsideTransaction = isTransactionActive();
            throw new ServiceUnavailable("La photo n'a pas pu être enregistrée.");
        });

        const response = await registrationRequest();

        expect(response.status).toBe(503);
        expect(avatarInsideTransaction).toBe(true);
    });

    it("crée l'avatar, le compte et la session dans la même transaction logique", async () => {
        on("users.create", (_params, _sql, connection) => {
            expect(connection).toMatchObject({ __txn: true });
            return { insertId: 29 };
        });
        on("users.findById", () => userRow());
        on("users.updateAvatar", (_params, _sql, connection) => {
            expect(connection).toMatchObject({ __txn: true });
            return { affectedRows: 1 };
        });
        on("sessions.create", (_params, _sql, connection) => {
            expect(connection).toMatchObject({ __txn: true });
            return { affectedRows: 1 };
        });

        const response = await registrationRequest();

        expect(response.status).toBe(201);
        expect(response.body.user).toMatchObject({ userId: 29, avatar: "https://cdn.test/avatar.webp" });
        expect(response.body.token).toEqual(expect.any(String));
    });
});
