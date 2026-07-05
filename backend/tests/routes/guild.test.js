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

const request = require("supertest");
const jwt = require("jsonwebtoken");
const createApp = require("../helpers/app");
const userModel = require("../../models/userModel");
const guildModel = require("../../models/guildModel");
const channelModel = require("../../models/channelModel");

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

function makeGuild(override = {}) {
    return {
        guildId: 1,
        guildName: "Test Guild",
        guildDescription: "A test guild",
        guildImage: null,
        ownerId: 1,
        ...override,
    };
}

function makeChannel(override = {}) {
    return {
        channelId: 1,
        type: "text",
        name: "general",
        description: "Salon général",
        guildId: 1,
        friendId: null,
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

    userModel.getUserById.mockResolvedValue(makeUser());
    guildModel.isUserInGuild.mockResolvedValue(true);
    guildModel.doGuildExists.mockResolvedValue(true);
});

// ─── POST /guilds — créer une guilde ─────────────────────────────────────────

describe("POST /api/v1/guilds", () => {
    beforeEach(() => {
        guildModel.createGuild.mockResolvedValue(makeGuild());
        channelModel.createChannel.mockResolvedValue(makeChannel());
    });

    it("201 - crée une guilde avec des données valides", async () => {
        const res = await request(app)
            .post("/api/v1/guilds")
            .set("Authorization", authHeader())
            .send({ guildName: "New Guild", guildDescription: "Description" });
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty("guildId");
    });

    it("400 - nom de guilde trop court (< 3 chars)", async () => {
        const res = await request(app)
            .post("/api/v1/guilds")
            .set("Authorization", authHeader())
            .send({ guildName: "ab" });
        expect(res.status).toBe(400);
        expect(res.body.errors[0].path).toBe("guildName");
    });

    it("400 - nom de guilde trop long (> 50 chars)", async () => {
        const res = await request(app)
            .post("/api/v1/guilds")
            .set("Authorization", authHeader())
            .send({ guildName: "a".repeat(51) });
        expect(res.status).toBe(400);
    });

    it("400 - nom de guilde manquant", async () => {
        const res = await request(app)
            .post("/api/v1/guilds")
            .set("Authorization", authHeader())
            .send({});
        expect(res.status).toBe(400);
    });

    it("401 - sans authentification", async () => {
        const res = await request(app)
            .post("/api/v1/guilds")
            .send({ guildName: "Valid Guild" });
        expect(res.status).toBe(401);
    });
});

// ─── GET /guilds/:guildId ─────────────────────────────────────────────────────

describe("GET /api/v1/guilds/:guildId", () => {
    beforeEach(() => {
        guildModel.getGuildById.mockResolvedValue(makeGuild());
        userModel.getUsersByGuildId.mockResolvedValue([makeUser()]);
        channelModel.getChannelsByGuildId.mockResolvedValue([makeChannel()]);
    });

    it("200 - retourne la guilde avec membres et channels", async () => {
        const res = await request(app)
            .get("/api/v1/guilds/1")
            .set("Authorization", authHeader());
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("guildId", 1);
        expect(res.body).toHaveProperty("members");
        expect(res.body).toHaveProperty("channels");
    });

    it("403 - accès refusé si non membre", async () => {
        guildModel.isUserInGuild.mockResolvedValue(false);
        const res = await request(app)
            .get("/api/v1/guilds/1")
            .set("Authorization", authHeader());
        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/non membre/);
    });

    it("404 - guilde introuvable", async () => {
        guildModel.getGuildById.mockResolvedValue(null);
        const res = await request(app)
            .get("/api/v1/guilds/999")
            .set("Authorization", authHeader());
        expect(res.status).toBe(404);
    });

    it("401 - sans authentification", async () => {
        const res = await request(app).get("/api/v1/guilds/1");
        expect(res.status).toBe(401);
    });
});

// ─── GET /guilds/:guildId/channels ───────────────────────────────────────────

describe("GET /api/v1/guilds/:guildId/channels", () => {
    it("200 - retourne les channels de la guilde", async () => {
        channelModel.getChannelsByGuildId.mockResolvedValue([makeChannel()]);
        const res = await request(app)
            .get("/api/v1/guilds/1/channels")
            .set("Authorization", authHeader());
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it("403 - accès refusé si non membre", async () => {
        guildModel.isUserInGuild.mockResolvedValue(false);
        const res = await request(app)
            .get("/api/v1/guilds/1/channels")
            .set("Authorization", authHeader());
        expect(res.status).toBe(403);
    });

    it("401 - sans authentification", async () => {
        const res = await request(app).get("/api/v1/guilds/1/channels");
        expect(res.status).toBe(401);
    });
});

// ─── GET /guilds/:guildId/defaultChannel ─────────────────────────────────────

describe("GET /api/v1/guilds/:guildId/defaultChannel", () => {
    it("200 - retourne le premier channel", async () => {
        channelModel.getFirstChannelByGuildId.mockResolvedValue(makeChannel());
        const res = await request(app)
            .get("/api/v1/guilds/1/defaultChannel")
            .set("Authorization", authHeader());
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("channelId");
    });

    it("404 - guilde introuvable", async () => {
        guildModel.doGuildExists.mockResolvedValue(false);
        const res = await request(app)
            .get("/api/v1/guilds/999/defaultChannel")
            .set("Authorization", authHeader());
        expect(res.status).toBe(404);
    });

    it("403 - non membre", async () => {
        guildModel.isUserInGuild.mockResolvedValue(false);
        const res = await request(app)
            .get("/api/v1/guilds/1/defaultChannel")
            .set("Authorization", authHeader());
        expect(res.status).toBe(403);
    });
});

// ─── POST /guilds/:guildId/channels — créer un channel ───────────────────────

describe("POST /api/v1/guilds/:guildId/channels", () => {
    const validBody = { name: "nouveau-channel", type: "text", description: "Channel de test" };

    beforeEach(() => {
        channelModel.createChannel.mockResolvedValue(makeChannel({ name: "nouveau-channel" }));
    });

    it("201 - crée un channel en tant que membre", async () => {
        const res = await request(app)
            .post("/api/v1/guilds/1/channels")
            .set("Authorization", authHeader())
            .send(validBody);
        expect(res.status).toBe(201);
        expect(res.body.data).toHaveProperty("channelId");
    });

    it("400 - nom de channel manquant", async () => {
        const res = await request(app)
            .post("/api/v1/guilds/1/channels")
            .set("Authorization", authHeader())
            .send({ type: "text" });
        expect(res.status).toBe(400);
        expect(res.body.errors[0].path).toBe("name");
    });

    it("400 - type de channel invalide", async () => {
        const res = await request(app)
            .post("/api/v1/guilds/1/channels")
            .set("Authorization", authHeader())
            .send({ ...validBody, type: "video" });
        expect(res.status).toBe(400);
        expect(res.body.errors[0].path).toBe("type");
    });

    it("400 - nom trop long (> 50 chars)", async () => {
        const res = await request(app)
            .post("/api/v1/guilds/1/channels")
            .set("Authorization", authHeader())
            .send({ ...validBody, name: "a".repeat(51) });
        expect(res.status).toBe(400);
    });

    it("403 - non membre de la guilde", async () => {
        guildModel.isUserInGuild.mockResolvedValue(false);
        const res = await request(app)
            .post("/api/v1/guilds/1/channels")
            .set("Authorization", authHeader())
            .send(validBody);
        expect(res.status).toBe(403);
    });

    it("401 - sans authentification", async () => {
        const res = await request(app)
            .post("/api/v1/guilds/1/channels")
            .send(validBody);
        expect(res.status).toBe(401);
    });
});

// ─── POST /guilds/:guildId/invites — créer une invitation ────────────────────

describe("POST /api/v1/guilds/:guildId/invites", () => {
    it("201 - crée un code d'invitation en tant que membre", async () => {
        guildModel.CreateInvite.mockResolvedValue({ insertId: 1 });
        const res = await request(app)
            .post("/api/v1/guilds/1/invites")
            .set("Authorization", authHeader());
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty("inviteCode");
        expect(typeof res.body.inviteCode).toBe("string");
    });

    it("403 - non membre", async () => {
        guildModel.isUserInGuild.mockResolvedValue(false);
        const res = await request(app)
            .post("/api/v1/guilds/1/invites")
            .set("Authorization", authHeader());
        expect(res.status).toBe(403);
    });

    it("401 - sans authentification", async () => {
        const res = await request(app).post("/api/v1/guilds/1/invites");
        expect(res.status).toBe(401);
    });
});

// ─── GET /invites/:inviteCode — rejoindre via invitation ─────────────────────

describe("GET /api/v1/invites/:inviteCode", () => {
    const inviteRecord = { guild: 1, author: 2, invite: "abc-123-uuid" };

    beforeEach(() => {
        guildModel.getInvite.mockResolvedValue(inviteRecord);
        guildModel.isUserInGuild.mockResolvedValue(false);
        guildModel.getGuildById.mockResolvedValue(makeGuild());
        userModel.AddUserInvite.mockResolvedValue();
        userModel.JoinGuild.mockResolvedValue({ affectedRows: 1 });
        userModel.getUsersByGuildId.mockResolvedValue([]);
    });

    it("200 - rejoint la guilde avec un code valide", async () => {
        const res = await request(app)
            .get("/api/v1/invites/abc-123-uuid")
            .set("Authorization", authHeader());
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("guildId", 1);
    });

    it("404 - code d'invitation invalide", async () => {
        guildModel.getInvite.mockResolvedValue(null);
        const res = await request(app)
            .get("/api/v1/invites/invalid-code")
            .set("Authorization", authHeader());
        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty("error", "Invitation invalide");
    });

    it("409 - utilisateur déjà membre de la guilde", async () => {
        guildModel.isUserInGuild.mockResolvedValue(true);
        const res = await request(app)
            .get("/api/v1/invites/abc-123-uuid")
            .set("Authorization", authHeader());
        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/déjà membre/);
    });

    it("401 - sans authentification", async () => {
        const res = await request(app).get("/api/v1/invites/abc-123-uuid");
        expect(res.status).toBe(401);
    });
});
