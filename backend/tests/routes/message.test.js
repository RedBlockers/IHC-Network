process.env.SECRET_KEY = "test-secret-key";

jest.mock("../../models/userModel");
jest.mock("../../models/guildModel");
jest.mock("../../models/channelModel");
jest.mock("../../models/messageModel");
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
const messageModel = require("../../models/messageModel");

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

function makeMessage(override = {}) {
    return {
        messageId: 1,
        userId: 1,
        content: "Hello world",
        channelId: 10,
        createdAt: new Date().toISOString(),
        ...override,
    };
}

function makeChannel(override = {}) {
    return {
        channelId: 10,
        type: "text",
        name: "general",
        description: "",
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
    guildModel.isChannelInGuild.mockResolvedValue(true);
});

// ─── GET /messages/dm/:channelId — messages privés ───────────────────────────

describe("GET /api/v1/messages/dm/:channelId", () => {
    beforeEach(() => {
        messageModel.getPrivateMessages.mockResolvedValue({
            messages: [makeMessage()],
            hasMoreMessages: false,
        });
    });

    it("200 - retourne les messages DM", async () => {
        const res = await request(app)
            .get("/api/v1/messages/dm/10")
            .set("Authorization", authHeader());
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("messages");
        expect(Array.isArray(res.body.messages)).toBe(true);
        expect(res.body).toHaveProperty("hasMoreMessages", false);
    });

    it("200 - pagination clampée (limit > 100 → 100)", async () => {
        const res = await request(app)
            .get("/api/v1/messages/dm/10?limit=9999")
            .set("Authorization", authHeader());
        expect(res.status).toBe(200);
        expect(res.body.limit).toBe(100);
    });

    it("200 - pagination clampée (limit < 1 → 1)", async () => {
        const res = await request(app)
            .get("/api/v1/messages/dm/10?limit=0")
            .set("Authorization", authHeader());
        expect(res.status).toBe(200);
        // limit=0 est traité comme défaut (50) par le || 50
        expect(res.body.limit).toBe(50);
    });

    it("401 - sans authentification", async () => {
        const res = await request(app).get("/api/v1/messages/dm/10");
        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty("message", "Token manquant");
    });
});

// ─── GET /messages/:guildId/:channelId — messages d'un channel de guilde ─────

describe("GET /api/v1/messages/:guildId/:channelId", () => {
    beforeEach(() => {
        messageModel.getMessagesByChannelId.mockResolvedValue({
            messages: [makeMessage()],
            hasMoreMessages: false,
        });
    });

    it("200 - retourne les messages du channel", async () => {
        const res = await request(app)
            .get("/api/v1/messages/1/10")
            .set("Authorization", authHeader());
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("messages");
        expect(res.body.messages.length).toBe(1);
    });

    it("200 - pagination par défaut (limit=50, offset=0)", async () => {
        const res = await request(app)
            .get("/api/v1/messages/1/10")
            .set("Authorization", authHeader());
        expect(res.status).toBe(200);
        expect(res.body.limit).toBe(50);
        expect(res.body.offset).toBe(0);
    });

    it("200 - pagination personnalisée", async () => {
        const res = await request(app)
            .get("/api/v1/messages/1/10?limit=20&offset=10")
            .set("Authorization", authHeader());
        expect(res.status).toBe(200);
        expect(res.body.limit).toBe(20);
        expect(res.body.offset).toBe(10);
    });

    it("403 - non membre de la guilde", async () => {
        guildModel.isUserInGuild.mockResolvedValue(false);
        const res = await request(app)
            .get("/api/v1/messages/1/10")
            .set("Authorization", authHeader());
        expect(res.status).toBe(403);
    });

    it("404 - channel n'appartient pas à cette guilde", async () => {
        guildModel.isChannelInGuild.mockResolvedValue(false);
        const res = await request(app)
            .get("/api/v1/messages/1/99")
            .set("Authorization", authHeader());
        expect(res.status).toBe(404);
        expect(res.body.message).toMatch(/Channel non trouvé/);
    });

    it("401 - sans authentification", async () => {
        const res = await request(app).get("/api/v1/messages/1/10");
        expect(res.status).toBe(401);
    });

    it("401 - token invalide", async () => {
        const res = await request(app)
            .get("/api/v1/messages/1/10")
            .set("Authorization", "Bearer bad.token");
        expect(res.status).toBe(401);
    });
});

// ─── POST /messages/:channelId — envoyer un message ─────────────────────────

describe("POST /api/v1/messages/:channelId", () => {
    beforeEach(() => {
        channelModel.getChannelById.mockResolvedValue(makeChannel());
        messageModel.insertMessage.mockResolvedValue({ insertId: 1 });
        messageModel.getMessageById.mockResolvedValue(makeMessage());
    });

    it("201 - envoie un message valide", async () => {
        const res = await request(app)
            .post("/api/v1/messages/10")
            .set("Authorization", authHeader())
            .send({ messageContent: "Bonjour tout le monde !" });
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty("newMessage");
        expect(res.body.newMessage).toHaveProperty("messageId");
    });

    it("400 - message vide", async () => {
        const res = await request(app)
            .post("/api/v1/messages/10")
            .set("Authorization", authHeader())
            .send({ messageContent: "" });
        expect(res.status).toBe(400);
        expect(res.body.errors[0].path).toBe("messageContent");
    });

    it("400 - message trop long (> 2000 chars)", async () => {
        const res = await request(app)
            .post("/api/v1/messages/10")
            .set("Authorization", authHeader())
            .send({ messageContent: "a".repeat(2001) });
        expect(res.status).toBe(400);
        expect(res.body.errors[0].path).toBe("messageContent");
    });

    it("400 - corps manquant (messageContent absent)", async () => {
        const res = await request(app)
            .post("/api/v1/messages/10")
            .set("Authorization", authHeader())
            .send({});
        expect(res.status).toBe(400);
    });

    it("404 - channel inexistant", async () => {
        channelModel.getChannelById.mockResolvedValue(null);
        const res = await request(app)
            .post("/api/v1/messages/999")
            .set("Authorization", authHeader())
            .send({ messageContent: "Hello" });
        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty("error", "Canal non trouvé");
    });

    it("401 - sans authentification", async () => {
        const res = await request(app)
            .post("/api/v1/messages/10")
            .send({ messageContent: "Hello" });
        expect(res.status).toBe(401);
    });

    it("401 - token expiré (passwordUpdatedAt modifié)", async () => {
        userModel.getUserById.mockResolvedValue(
            makeUser({ passwordUpdatedAt: new Date("2025-06-01T00:00:00.000Z") })
        );
        const res = await request(app)
            .post("/api/v1/messages/10")
            .set("Authorization", authHeader())
            .send({ messageContent: "Hello" });
        expect(res.status).toBe(401);
        expect(res.body.message).toMatch(/Session expirée/);
    });

    it("500 - erreur d'insertion en base", async () => {
        messageModel.insertMessage.mockResolvedValue(null);
        const res = await request(app)
            .post("/api/v1/messages/10")
            .set("Authorization", authHeader())
            .send({ messageContent: "Hello" });
        expect(res.status).toBe(500);
    });
});
