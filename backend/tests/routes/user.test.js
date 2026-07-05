process.env.SECRET_KEY = "test-secret-key";

jest.mock("../../models/userModel");
jest.mock("../../models/guildModel");
jest.mock("../../models/channelModel");
jest.mock("../../services/fileServices");
jest.mock("../../utils/helpers/logHelper", () => ({ logAPI: jest.fn() }));
jest.mock("../../utils/sharedState", () => ({
    getIo: () => ({ emit: jest.fn(), to: jest.fn().mockReturnValue({ emit: jest.fn() }) }),
    setIo: jest.fn(),
    connectedUsers: new Map(),
}));
jest.mock("../../utils/socketUtils", () => ({ emitToUser: jest.fn() }));
jest.mock("bcrypt", () => ({
    hash: jest.fn().mockResolvedValue("$hashed$"),
    compare: jest.fn().mockResolvedValue(true),
}));
// connDB est automatiquement remplacé par tests/__mocks__/connDB.js via moduleNameMapper

const request = require("supertest");
const jwt = require("jsonwebtoken");
const createApp = require("../helpers/app");
const userModel = require("../../models/userModel");
const guildModel = require("../../models/guildModel");
const channelModel = require("../../models/channelModel");
const bcrypt = require("bcrypt");

// ─── Fixtures ────────────────────────────────────────────────────────────────

const PASSWORD_UPDATED_AT = new Date("2025-01-01T00:00:00.000Z");

function makeUser(override = {}) {
    return {
        userId: 1,
        handle: "testuser",
        displayName: "Test User",
        email: "test@example.com",
        password: "$hashed$",
        passwordUpdatedAt: PASSWORD_UPDATED_AT,
        avatar: "/assets/default-avatar.png",
        aboutMe: "",
        notes: null,
        presence: "online",
        isBot: 0,
        isEmailVerified: 0,
        isBanned: 0,
        banDayDuration: null,
        ...override,
    };
}

function authHeader(userId = 1) {
    const token = jwt.sign(
        { userId, passwordUpdatedAt: PASSWORD_UPDATED_AT },
        process.env.SECRET_KEY,
        { expiresIn: "1h" }
    );
    return `Bearer ${token}`;
}

// ─── Setup ───────────────────────────────────────────────────────────────────

let app;

beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();

    // Auth middleware : l'utilisateur authentifié par défaut
    userModel.getUserById.mockResolvedValue(makeUser());
    userModel.getUserAttempts.mockResolvedValue([]);
    userModel.deleteUserAttempt.mockResolvedValue();
    userModel.addUserAttempt.mockResolvedValue();
    userModel.getFriends.mockResolvedValue([]);
    channelModel.getPrivateChannelsByUserId.mockResolvedValue([]);
    guildModel.getGuildsByUser.mockResolvedValue([]);
});

// ─── POST /register ───────────────────────────────────────────────────────────

describe("POST /api/v1/users/register", () => {
    const validBody = {
        handle: "newuser",
        email: "new@example.com",
        password: "Password123!",
        displayName: "New User",
    };

    beforeEach(() => {
        userModel.getUserByHandle.mockResolvedValue(null);
        userModel.getUserByEmail.mockResolvedValue(null);
        userModel.createUser.mockResolvedValue(makeUser({ userId: 2, handle: "newuser" }));
        userModel.updateUserField.mockResolvedValue(true);
    });

    it("201 - crée un compte avec des données valides", async () => {
        const res = await request(app).post("/api/v1/users/register").send(validBody);
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty("token");
        expect(res.body.user).toHaveProperty("handle", "newuser");
    });

    it("400 - handle trop court (< 3 chars)", async () => {
        const res = await request(app)
            .post("/api/v1/users/register")
            .send({ ...validBody, handle: "ab" });
        expect(res.status).toBe(400);
        expect(res.body.errors[0].path).toBe("handle");
    });

    it("400 - handle trop long (> 20 chars)", async () => {
        const res = await request(app)
            .post("/api/v1/users/register")
            .send({ ...validBody, handle: "a".repeat(21) });
        expect(res.status).toBe(400);
        expect(res.body.errors[0].path).toBe("handle");
    });

    it("400 - email invalide", async () => {
        const res = await request(app)
            .post("/api/v1/users/register")
            .send({ ...validBody, email: "not-an-email" });
        expect(res.status).toBe(400);
        expect(res.body.errors[0].path).toBe("email");
    });

    it("400 - mot de passe trop court (< 8 chars)", async () => {
        const res = await request(app)
            .post("/api/v1/users/register")
            .send({ ...validBody, password: "abc" });
        expect(res.status).toBe(400);
        expect(res.body.errors[0].path).toBe("password");
    });

    it("409 - handle déjà existant", async () => {
        userModel.getUserByHandle.mockResolvedValue(makeUser());
        const res = await request(app).post("/api/v1/users/register").send(validBody);
        expect(res.status).toBe(409);
        expect(res.body).toHaveProperty("error");
    });

    it("409 - email déjà existant", async () => {
        userModel.getUserByEmail.mockResolvedValue(makeUser());
        const res = await request(app).post("/api/v1/users/register").send(validBody);
        expect(res.status).toBe(409);
        expect(res.body).toHaveProperty("error");
    });
});

// ─── POST /login ──────────────────────────────────────────────────────────────

describe("POST /api/v1/users/login", () => {
    const validBody = { handle: "testuser", password: "Password123!" };

    beforeEach(() => {
        userModel.getUserByHandle.mockResolvedValue(makeUser());
    });

    it("200 - retourne un token avec des identifiants valides", async () => {
        bcrypt.compare.mockResolvedValueOnce(true);
        const res = await request(app).post("/api/v1/users/login").send(validBody);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("token");
        expect(res.body.user).toHaveProperty("handle", "testuser");
    });

    it("401 - mot de passe incorrect", async () => {
        bcrypt.compare.mockResolvedValueOnce(false);
        const res = await request(app).post("/api/v1/users/login").send(validBody);
        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty("message");
    });

    it("401 - handle inconnu", async () => {
        userModel.getUserByHandle.mockResolvedValue(null);
        const res = await request(app).post("/api/v1/users/login").send(validBody);
        expect(res.status).toBe(401);
    });

    it("429 - bloqué après trop de tentatives", async () => {
        userModel.getUserAttempts.mockResolvedValue(new Array(6).fill({}));
        const res = await request(app).post("/api/v1/users/login").send(validBody);
        expect(res.status).toBe(429);
        expect(res.body).toHaveProperty("message");
    });

    it("400 - corps invalide (handle manquant)", async () => {
        const res = await request(app)
            .post("/api/v1/users/login")
            .send({ password: "Password123!" });
        expect(res.status).toBe(400);
    });
});

// ─── GET /auth/check ─────────────────────────────────────────────────────────

describe("GET /api/v1/users/auth/check", () => {
    it("200 - handle disponible", async () => {
        userModel.getUserByHandle.mockResolvedValue(null);
        const res = await request(app).get("/api/v1/users/auth/check?handle=freehandle");
        expect(res.status).toBe(200);
        expect(res.body.handle.available).toBe(true);
    });

    it("200 - handle déjà pris", async () => {
        userModel.getUserByHandle.mockResolvedValue(makeUser());
        const res = await request(app).get("/api/v1/users/auth/check?handle=testuser");
        expect(res.status).toBe(200);
        expect(res.body.handle.available).toBe(false);
    });

    it("200 - email disponible", async () => {
        userModel.getUserByEmail.mockResolvedValue(null);
        const res = await request(app).get("/api/v1/users/auth/check?email=free@example.com");
        expect(res.status).toBe(200);
        expect(res.body.email.available).toBe(true);
    });

    it("200 - email déjà pris", async () => {
        userModel.getUserByEmail.mockResolvedValue(makeUser());
        const res = await request(app).get("/api/v1/users/auth/check?email=test@example.com");
        expect(res.status).toBe(200);
        expect(res.body.email.available).toBe(false);
    });

    it("400 - aucun paramètre fourni", async () => {
        const res = await request(app).get("/api/v1/users/auth/check");
        expect(res.status).toBe(400);
    });
});

// ─── GET /me ─────────────────────────────────────────────────────────────────

describe("GET /api/v1/users/me", () => {
    it("200 - retourne l'utilisateur connecté", async () => {
        const res = await request(app)
            .get("/api/v1/users/me")
            .set("Authorization", authHeader());
        expect(res.status).toBe(200);
        expect(res.body.user).toHaveProperty("handle", "testuser");
        expect(res.body.user).not.toHaveProperty("password");
    });

    it("401 - sans token", async () => {
        const res = await request(app).get("/api/v1/users/me");
        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty("message", "Token manquant");
    });

    it("401 - token invalide", async () => {
        const res = await request(app)
            .get("/api/v1/users/me")
            .set("Authorization", "Bearer invalid.token.here");
        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty("message", "Token invalide");
    });

    it("401 - mot de passe changé depuis l'émission du token", async () => {
        userModel.getUserById.mockResolvedValue(
            makeUser({ passwordUpdatedAt: new Date("2025-06-01T00:00:00.000Z") })
        );
        const res = await request(app)
            .get("/api/v1/users/me")
            .set("Authorization", authHeader());
        expect(res.status).toBe(401);
        expect(res.body.message).toMatch(/Session expirée/);
    });
});

// ─── GET /me/guilds — test critique d'ordre de routes ────────────────────────

describe("GET /api/v1/users/me/guilds (route ordering)", () => {
    it("200 - /me/guilds n'est pas capturé comme /:userId", async () => {
        guildModel.getGuildsByUser.mockResolvedValue([]);
        const res = await request(app)
            .get("/api/v1/users/me/guilds")
            .set("Authorization", authHeader());
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it("401 - sans authentification", async () => {
        const res = await request(app).get("/api/v1/users/me/guilds");
        expect(res.status).toBe(401);
    });
});

// ─── GET /me/channels/private — test critique d'ordre de routes ──────────────

describe("GET /api/v1/users/me/channels/private (route ordering)", () => {
    it("200 - /me/channels/private n'est pas capturé comme /:userId", async () => {
        channelModel.getPrivateChannelsByUserId.mockResolvedValue([]);
        const res = await request(app)
            .get("/api/v1/users/me/channels/private")
            .set("Authorization", authHeader());
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("channels");
    });

    it("401 - sans authentification", async () => {
        const res = await request(app).get("/api/v1/users/me/channels/private");
        expect(res.status).toBe(401);
    });
});

// ─── GET /me/friends ─────────────────────────────────────────────────────────

describe("GET /api/v1/users/me/friends", () => {
    it("200 - retourne la liste d'amis", async () => {
        userModel.getFriends.mockResolvedValue([{ userId: 2, handle: "friend" }]);
        const res = await request(app)
            .get("/api/v1/users/me/friends")
            .set("Authorization", authHeader());
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("friends");
    });

    it("401 - sans authentification", async () => {
        const res = await request(app).get("/api/v1/users/me/friends");
        expect(res.status).toBe(401);
    });
});

// ─── POST /me/friends/:friendHandle ─────────────────────────────────────────

describe("POST /api/v1/users/me/friends/:friendHandle", () => {
    it("200 - envoie une demande d'ami", async () => {
        userModel.getUserByHandle.mockResolvedValue(makeUser({ userId: 2, handle: "frienduser" }));
        userModel.isAlreadyFriendOrPending.mockResolvedValue(false);
        userModel.addFriendRequest.mockResolvedValue({ affectedRows: 1 });
        const res = await request(app)
            .post("/api/v1/users/me/friends/frienduser")
            .set("Authorization", authHeader());
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("message");
    });

    it("404 - utilisateur introuvable", async () => {
        userModel.getUserByHandle.mockResolvedValue(null);
        const res = await request(app)
            .post("/api/v1/users/me/friends/unknown")
            .set("Authorization", authHeader());
        expect(res.status).toBe(404);
    });

    it("409 - déjà ami ou demande en cours", async () => {
        userModel.getUserByHandle.mockResolvedValue(makeUser({ userId: 2 }));
        userModel.isAlreadyFriendOrPending.mockResolvedValue(true);
        const res = await request(app)
            .post("/api/v1/users/me/friends/testuser")
            .set("Authorization", authHeader());
        expect(res.status).toBe(409);
    });

    it("401 - sans authentification", async () => {
        const res = await request(app).post("/api/v1/users/me/friends/someone");
        expect(res.status).toBe(401);
    });
});

// ─── GET /:userId ─────────────────────────────────────────────────────────────

describe("GET /api/v1/users/:userId", () => {
    it("200 - retourne le profil public d'un utilisateur", async () => {
        userModel.getUserById.mockResolvedValue(makeUser({ userId: 2 }));
        const res = await request(app)
            .get("/api/v1/users/2")
            .set("Authorization", authHeader());
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("handle");
        expect(res.body).not.toHaveProperty("email");
    });

    it("404 - utilisateur inexistant", async () => {
        // Premier appel: auth (userId=1), deuxième: getUser (userId=999)
        userModel.getUserById
            .mockResolvedValueOnce(makeUser())  // auth middleware
            .mockResolvedValueOnce(null);       // getUser controller
        const res = await request(app)
            .get("/api/v1/users/999")
            .set("Authorization", authHeader());
        expect(res.status).toBe(404);
    });

    it("401 - sans authentification", async () => {
        const res = await request(app).get("/api/v1/users/1");
        expect(res.status).toBe(401);
    });
});

// ─── DELETE /me/friends/:friendId ────────────────────────────────────────────

describe("DELETE /api/v1/users/me/friends/:friendId", () => {
    it("204 - supprime un ami", async () => {
        userModel.getUserById
            .mockResolvedValueOnce(makeUser())           // auth
            .mockResolvedValueOnce(makeUser({ userId: 2 })); // friend lookup
        userModel.isAlreadyFriendOrPending.mockResolvedValue(true);
        userModel.removeFriend.mockResolvedValue({ affectedRows: 1 });
        userModel.getFriends.mockResolvedValue([]);
        const res = await request(app)
            .delete("/api/v1/users/me/friends/2")
            .set("Authorization", authHeader());
        expect(res.status).toBe(204);
    });

    it("404 - ami introuvable", async () => {
        userModel.getUserById
            .mockResolvedValueOnce(makeUser())  // auth
            .mockResolvedValueOnce(null);        // friend lookup
        const res = await request(app)
            .delete("/api/v1/users/me/friends/999")
            .set("Authorization", authHeader());
        expect(res.status).toBe(404);
    });

    it("401 - sans authentification", async () => {
        const res = await request(app).delete("/api/v1/users/me/friends/2");
        expect(res.status).toBe(401);
    });
});
