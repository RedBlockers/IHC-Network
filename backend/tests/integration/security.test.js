"use strict";

const request = require("supertest");

const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");

const app = createApp();

describe("Confidentialité des messages (CRIT-04 / CRIT-05)", () => {
    const alice = makeUser({ userId: 1, handle: "alice" });
    const bob = makeUser({ userId: 2, handle: "bob" });
    const intruder = makeUser({ userId: 99, handle: "intruder" });
    const PRIVATE_CHANNEL = 10;

    beforeEach(() => {
        const token = authenticateAs(alice, bob, intruder);
        app.locals.token = token;

        on("access.resolveChannel", (params) => {
            const userId = Number(params[0]);
            const channelId = Number(params.at(-1));
            const isParticipant = channelId === PRIVATE_CHANNEL && (userId === 1 || userId === 2);
            return isParticipant
                ? [{ channelId: PRIVATE_CHANNEL, type: "text", name: "direct", description: "", guildId: null, friendshipId: 7, position: 0 }]
                : [];
        });
    });

    it("laisse un participant lire les messages du DM (200)", async () => {
        on("messages.listByChannel", () => []);
        const res = await request(app)
            .get(`/api/v1/channels/${PRIVATE_CHANNEL}/messages`)
            .set("Authorization", app.locals.token(makeUser({ userId: 1, handle: "alice" })));
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("messages");
    });

    it("REFUSE à un tiers de lire le DM d'autrui (404, pas 200)", async () => {
        const res = await request(app)
            .get(`/api/v1/channels/${PRIVATE_CHANNEL}/messages`)
            .set("Authorization", app.locals.token(makeUser({ userId: 99, handle: "intruder" })));
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe("not_found");
    });

    it("REFUSE à un tiers d'écrire dans le DM d'autrui (404)", async () => {
        const res = await request(app)
            .post(`/api/v1/channels/${PRIVATE_CHANNEL}/messages`)
            .set("Authorization", app.locals.token(makeUser({ userId: 99, handle: "intruder" })))
            .send({ content: "message injecté" });
        expect(res.status).toBe(404);
    });

    it("laisse un participant écrire dans le DM (201) et diffuse dans la room du salon", async () => {
        const realtime = require("../../src/realtime");
        realtime.__reset();
        on("friendships.findById", () => ({ friendshipId: 1, requesterId: 1, addresseeId: 2 }));
        on("relations.isBlockedEitherWay", () => null);
        on("messages.create", () => ({}));
        on("messages.findById", () => [
            {
                messageId: "7168291357943578624",
                channelId: PRIVATE_CHANNEL,
                content: "salut bob",
                createdAt: new Date(),
                editedAt: null,
                userId: 1,
                handle: "alice",
                displayName: "Alice",
                avatar: "/a.webp",
            },
        ]);

        const res = await request(app)
            .post(`/api/v1/channels/${PRIVATE_CHANNEL}/messages`)
            .set("Authorization", app.locals.token(makeUser({ userId: 1, handle: "alice" })))
            .send({ content: "salut bob" });

        expect(res.status).toBe(201);
        expect(res.body.message.messageId).toBe("7168291357943578624");
        const emitted = realtime.__emissions.find((e) => e.event === "message:new");
        expect(emitted).toMatchObject({ target: "channel", channelId: PRIVATE_CHANNEL });
    });
});

describe("Authentification requise", () => {
    it("initialise anonymement sans journaliser un faux échec de session", async () => {
        const res = await request(createApp()).post("/api/v1/auth/session");
        expect(res.status).toBe(204);
    });

    it("refuse l'accès sans jeton (401)", async () => {
        const res = await request(createApp()).get("/api/v1/channels/10/messages");
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe("unauthorized");
    });

    it("refuse un jeton mal formé (401)", async () => {
        const res = await request(createApp())
            .get("/api/v1/users/me/guilds")
            .set("Authorization", "Bearer pas-un-vrai-jeton");
        expect(res.status).toBe(401);
    });

    it("refuse une tentative de connexion initiée par une origine tierce", async () => {
        const res = await request(createApp())
            .post("/api/v1/auth/login")
            .set("Origin", "https://evil.example")
            .set("Sec-Fetch-Site", "cross-site")
            .send({ handle: "alice", password: "un-mot-de-passe" });

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe("forbidden");
    });
});

describe("Politique des mots de passe", () => {
    it("refuse un nouveau mot de passe de moins de quinze caractères", async () => {
        const res = await request(createApp())
            .post("/api/v1/auth/register")
            .send({
                handle: "nouveau",
                email: "nouveau@example.test",
                password: "trop-court",
                displayName: "Nouveau",
                bio: "",
            });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("bad_request");
    });
});

describe("Intégrité des messages entre salons", () => {
    const moderator = makeUser({ userId: 1, handle: "moderator" });
    const REQUESTED_CHANNEL = 10;
    const ACTUAL_CHANNEL = 11;

    beforeEach(() => {
        const token = authenticateAs(moderator);
        app.locals.token = token;
        on("access.resolveChannel", () => [{
            channelId: REQUESTED_CHANNEL,
            type: "text",
            name: "général",
            description: "",
            guildId: 7,
            friendshipId: null,
            position: 0,
        }]);
        on("access.channelPermission", () => [{ ownerId: moderator.userId, baseEffect: null, targetType: null, overrideEffect: null }]);
        on("messages.channelOf", () => [{ channelId: ACTUAL_CHANNEL }]);
    });

    it("refuse de modifier son propre message via l'URL d'un autre salon", async () => {
        on("messages.update", () => ({ affectedRows: 1 }));
        on("messages.findById", () => [{
            messageId: "7168291357943578624",
            channelId: ACTUAL_CHANNEL,
            content: "modifié",
            createdAt: new Date(),
            userId: moderator.userId,
            handle: moderator.handle,
            displayName: moderator.displayName,
            avatar: moderator.avatar,
        }]);

        const res = await request(app)
            .patch(`/api/v1/channels/${REQUESTED_CHANNEL}/messages/7168291357943578624`)
            .set("Authorization", app.locals.token(moderator))
            .send({ content: "modifié" });

        expect(res.status).toBe(404);
    });

    it("refuse à un administrateur de supprimer un message d'un autre salon", async () => {
        on("messages.delete", () => ({ affectedRows: 0 }));
        on("access.guildRole", () => [{ role: "admin" }]);
        on("messages.deleteAny", () => ({ affectedRows: 1 }));

        const res = await request(app)
            .delete(`/api/v1/channels/${REQUESTED_CHANNEL}/messages/7168291357943578624`)
            .set("Authorization", app.locals.token(moderator));

        expect(res.status).toBe(404);
    });
});

describe("Recherche d'amis", () => {
    const alice = makeUser({ userId: 1, handle: "alice" });

    it("cherche par préfixe sans exposer de donnée privée", async () => {
        const token = authenticateAs(alice);
        on("users.searchByHandle", (params, sql) => {
            expect(params).toEqual([1, "bo%", "bo"]);
            expect(sql).not.toContain("bo%");
            return [{
                userId: 2,
                handle: "bob",
                displayName: "Bob",
                avatar: null,
                aboutMe: "Disponible",
                presence: "online",
                isBot: 0,
                email: "private@example.test",
            }];
        });

        const res = await request(app)
            .get("/api/v1/users/search?q=bo")
            .set("Authorization", token(alice));

        expect(res.status).toBe(200);
        expect(res.body.users).toEqual([{
            userId: 2,
            handle: "bob",
            displayName: "Bob",
            avatar: null,
            avatarDecoration: "none",
            bannerImage: null,
            aboutMe: "Disponible",
            activityText: "",
            presence: "online",
            isBot: false,
        }]);
        expect(res.body.users[0]).not.toHaveProperty("email");
    });

    it("refuse une recherche trop courte", async () => {
        const token = authenticateAs(alice);
        const res = await request(app)
            .get("/api/v1/users/search?q=b")
            .set("Authorization", token(alice));
        expect(res.status).toBe(400);
    });
});

describe("Création de guilde (CRIT-01) : le propriétaire devient membre", () => {
    it("inscrit le créateur dans guild_members avec le rôle owner", async () => {
        const owner = makeUser({ userId: 1, handle: "founder" });
        const token = authenticateAs(owner);

        const memberInserts = [];
        on("guilds.create", () => ({ insertId: 500 }));
        on("guilds.findById", () => [
            { guildId: 500, name: "Studio", description: "", icon: null, ownerId: 1 },
        ]);
        on("guilds.addMember", (params) => {
            memberInserts.push({ guildId: params[0], userId: params[1], role: params[2] });
            return { affectedRows: 1 };
        });
        on("roles.initialize", () => ({ affectedRows: 3 }));
        on("roles.initializePermissions", () => ({ affectedRows: 9 }));
        on("roles.initializeAdminPermissions", () => ({ affectedRows: 21 }));
        on("roles.assignDefault", () => ({ affectedRows: 1 }));
        on("roles.assignOwner", () => ({ affectedRows: 1 }));
        on("channels.createGuild", () => ({ insertId: 900 }));
        on("channels.findById", () => [
            { channelId: 900, type: "text", name: "général", description: "", guildId: 500, position: 0 },
        ]);

        const res = await request(app)
            .post("/api/v1/guilds")
            .set("Authorization", token(owner))
            .send({ name: "Studio", description: "" });

        expect(res.status).toBe(201);
        expect(memberInserts).toEqual([{ guildId: 500, userId: 1, role: "owner" }]);
    });
});

describe("Média temps réel : l'accès au SFU suit l'accès au salon", () => {
    const alice = makeUser({ userId: 1, handle: "alice", displayName: "Alice" });
    const intruder = makeUser({ userId: 99, handle: "intruder" });
    const VOICE_CHANNEL = 20;
    const TEXT_CHANNEL = 21;

    beforeEach(() => {
        const token = authenticateAs(alice, intruder);
        app.locals.token = token;
        on("access.resolveChannel", (params) => {
            const userId = Number(params[0]);
            const channelId = Number(params.at(-1));
            if (userId !== alice.userId || ![VOICE_CHANNEL, TEXT_CHANNEL].includes(channelId)) return [];
            return [{
                channelId,
                type: channelId === VOICE_CHANNEL ? "voice" : "text",
                name: channelId === VOICE_CHANNEL ? "Agora" : "général",
                description: "",
                guildId: 7,
                friendshipId: null,
                position: 0,
            }];
        });
        on("access.channelPermission", () => [{ ownerId: alice.userId, baseEffect: null, targetType: null, overrideEffect: null }]);
    });

    it("refuse de délivrer un jeton média sans session Qweillo", async () => {
        const res = await request(app).post(`/api/v1/channels/${VOICE_CHANNEL}/media-token`);
        expect(res.status).toBe(401);
    });

    it("refuse de révéler un salon vocal à un non-membre", async () => {
        const res = await request(app)
            .post(`/api/v1/channels/${VOICE_CHANNEL}/media-token`)
            .set("Authorization", app.locals.token(intruder));
        expect(res.status).toBe(404);
    });

    it("refuse le média dans un salon textuel", async () => {
        const res = await request(app)
            .post(`/api/v1/channels/${TEXT_CHANNEL}/media-token`)
            .set("Authorization", app.locals.token(alice));
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("bad_request");
    });

    it("délivre au membre un jeton court, borné à la room du salon", async () => {
        const res = await request(app)
            .post(`/api/v1/channels/${VOICE_CHANNEL}/media-token`)
            .set("Authorization", app.locals.token(alice));

        expect(res.status).toBe(200);
        expect(res.body.url).toBe(process.env.LIVEKIT_URL);
        expect(typeof res.body.token).toBe("string");

        const payload = require("jsonwebtoken").decode(res.body.token);
        expect(payload.sub).toBe(`user:${alice.userId}`);
        expect(payload.video).toMatchObject({
            room: `channel:${VOICE_CHANNEL}`,
            roomJoin: true,
            canPublish: true,
            canSubscribe: true,
        });
        expect(payload.exp - payload.nbf).toBeLessThanOrEqual(300);
    });
});

describe("Invitation par lien : aperçu public sans mutation", () => {
    const CODE = "AbCdEfGhIjKlMnOpQrStUv";

    it("retourne uniquement l'identité publique de la communauté", async () => {
        on("invites.findPreviewByCode", () => [{
            code: CODE,
            guildId: 7,
            name: "Atelier Qweillo",
            description: "Construire ensemble.",
            icon: null,
            banner: "ocean",
            accent: "#4b7cff",
            memberCount: 42,
            expiresAt: null,
        }]);

        const res = await request(app).get(`/api/v1/invites/${CODE}`);
        expect(res.status).toBe(200);
        expect(res.body.invite).toEqual({
            code: CODE,
            guild: {
                guildId: 7,
                name: "Atelier Qweillo",
                description: "Construire ensemble.",
                icon: null,
                banner: "ocean",
                accent: "#4b7cff",
                memberCount: 42,
            },
            expiresAt: null,
        });
        expect(JSON.stringify(res.body)).not.toContain("createdBy");
    });
});
