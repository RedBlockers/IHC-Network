"use strict";

const request = require("supertest");

const createApp = require("../../src/app");
const { on } = require("../helpers/db");
const { makeUser, authenticateAs } = require("../helpers/auth");
const { allowWrite } = require("../helpers/writePath");

const ada = makeUser({ userId: 5, handle: "ada" });
const alan = makeUser({ userId: 6, handle: "alan" });
const grace = makeUser({ userId: 7, handle: "grace" });

function hostedChannel(type = "development", user = ada) {
    on("access.resolveChannel", () => ({
        channelId: 10,
        guildId: 7,
        type,
        name: type === "incident" ? "feu" : "atelier",
        position: 0,
    }));
    on("access.channelPermission", () => [{ ownerId: 99, baseEffect: "allow", targetType: null, overrideEffect: null }]);
    on("access.guildRole", () => ({ role: "member" }));
    allowWrite();
    return authenticateAs(ada, alan, grace)(user);
}

const TREE = (overrides = {}) => ({
    worktreeId: 3,
    channelId: 10,
    guildId: 7,
    name: "feature-login",
    baseBranch: "main",
    headBranch: "feature-login",
    headSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    dirty: 1,
    status: "active",
    createdBy: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
});

const adaMember = {
    userId: 5,
    role: "owner",
    consentTerminal: 0,
    handle: "ada",
    displayName: "Ada",
    avatar: null,
};
const alanMember = {
    userId: 6,
    role: "pair",
    consentTerminal: 0,
    handle: "alan",
    displayName: "Alan",
    avatar: null,
};
const graceMember = {
    userId: 7,
    role: "mob",
    consentTerminal: 0,
    handle: "grace",
    displayName: "Grace",
    avatar: null,
};

function stubBoard({ members = [adaMember], commits = [], files = [], reviews = [], pipelines = [], decisions = [], terminals = [], cursors = [], comments = [] } = {}) {
    on("worktrees.findById", () => TREE());
    on("worktrees.listMembers", () => members);
    on("worktrees.listCommits", () => commits);
    on("worktrees.listFiles", () => files);
    on("worktrees.listReviews", () => reviews);
    on("worktrees.listPipelines", () => pipelines);
    on("worktrees.listDecisions", () => decisions);
    on("worktrees.listTerminals", () => terminals);
    on("worktrees.listCursors", () => cursors);
    on("worktrees.listCommentsForWorktree", () => comments);
}

describe("Worktrees collaboratifs", () => {
    it("refuse un worktree dans un salon textuel", async () => {
        on("access.resolveChannel", () => ({ channelId: 10, guildId: 7, type: "text", name: "général", position: 0 }));
        on("access.channelPermission", () => [{ ownerId: 99, baseEffect: "allow", targetType: null, overrideEffect: null }]);
        on("access.guildRole", () => ({ role: "member" }));
        allowWrite();
        const authorization = authenticateAs(ada)(ada);

        const response = await request(createApp())
            .post("/api/v1/channels/10/worktrees")
            .set("Authorization", authorization)
            .send({ name: "hors-sujet" });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toMatch(/développement/);
    });

    it("accepte les salons de revue et d'incident", async () => {
        const authorization = hostedChannel("review");
        on("worktrees.create", () => ({ insertId: 3 }));
        on("worktrees.addMember", () => ({ affectedRows: 1 }));
        stubBoard();

        const response = await request(createApp())
            .post("/api/v1/channels/10/worktrees")
            .set("Authorization", authorization)
            .send({ name: "feature-login" });

        expect(response.status).toBe(201);
        expect(response.body.worktree.collaboration).toBe("solo");
    });

    it("crée un worktree et y inscrit l'auteur comme propriétaire", async () => {
        const authorization = hostedChannel();
        let created = null;
        on("worktrees.create", (params) => {
            created = params;
            return { insertId: 3 };
        });
        on("worktrees.addMember", () => ({ affectedRows: 1 }));
        stubBoard();

        const response = await request(createApp())
            .post("/api/v1/channels/10/worktrees")
            .set("Authorization", authorization)
            .send({ name: "feature-login" });

        expect(response.status).toBe(201);
        expect(created[2]).toBe("feature-login");
        expect(response.body.worktree.members[0].role).toBe("owner");
    });

    it("enregistre l'état Git poussé : branche, HEAD, fichiers et commits", async () => {
        const authorization = hostedChannel();
        on("worktrees.findMember", () => ({ worktreeId: 3, userId: 5, role: "owner", consentTerminal: 0 }));
        let fields = null;
        let files = null;
        let commits = null;
        on("worktrees.update", (params) => {
            fields = params;
            return { affectedRows: 1 };
        });
        on("worktrees.clearFiles", () => ({ affectedRows: 0 }));
        on("worktrees.insertFile", (params) => {
            files = params;
            return { insertId: 1 };
        });
        on("worktrees.clearCommits", () => ({ affectedRows: 0 }));
        on("worktrees.insertCommit", (params) => {
            commits = params;
            return { insertId: 1 };
        });
        on("worktrees.touchMember", () => ({ affectedRows: 1 }));
        stubBoard({
            files: [{ fileId: 1, path: "src/login.js", status: "modified", language: "javascript", patch: "+export" }],
            commits: [
                {
                    commitId: 1,
                    sha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                    subject: "auth",
                    authorHandle: "ada",
                    committedAt: new Date(),
                },
            ],
        });

        const response = await request(createApp())
            .put("/api/v1/channels/10/worktrees/3/snapshot")
            .set("Authorization", authorization)
            .send({
                headBranch: "feature-login",
                baseBranch: "main",
                headSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                files: [{ path: "src/login.js", status: "modified", language: "javascript", patch: "+export" }],
                commits: [
                    {
                        sha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                        subject: "auth",
                        authorHandle: "ada",
                    },
                ],
            });

        expect(response.status).toBe(200);
        expect(fields).toContain("feature-login");
        expect(files).toContain("src/login.js");
        expect(commits[1]).toBe("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
        expect(response.body.worktree.files[0].patch).toBe("+export");
        expect(response.body.worktree.commits[0].subject).toBe("auth");
    });

    it("ouvre une revue ancrée sur les SHA poussés", async () => {
        const authorization = hostedChannel();
        on("worktrees.findMember", () => ({ worktreeId: 3, userId: 5, role: "owner", consentTerminal: 0 }));
        let review = null;
        on("worktrees.createReview", (params) => {
            review = params;
            return { insertId: 8 };
        });
        on("worktrees.update", () => ({ affectedRows: 1 }));
        stubBoard({
            reviews: [
                {
                    reviewId: 8,
                    title: "Login",
                    baseSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                    headSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                    status: "open",
                    createdBy: 5,
                    createdAt: new Date(),
                },
            ],
        });

        const response = await request(createApp())
            .post("/api/v1/channels/10/worktrees/3/reviews")
            .set("Authorization", authorization)
            .send({
                title: "Login",
                baseSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                headSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            });

        expect(response.status).toBe(201);
        expect(review[2]).toBe("Login");
        expect(response.body.worktree.reviews[0].status).toBe("open");
    });

    it("ancre un commentaire de revue sur un fichier et une ligne", async () => {
        const authorization = hostedChannel();
        on("worktrees.findById", () => TREE());
        on("worktrees.findMember", () => ({ worktreeId: 3, userId: 5, role: "owner", consentTerminal: 0 }));
        on("worktrees.findReview", () => ({ reviewId: 8, worktreeId: 3 }));
        on("worktrees.addComment", () => ({ insertId: 2 }));
        on("worktrees.listComments", () => [
            {
                commentId: 2,
                reviewId: 8,
                path: "src/login.js",
                lineStart: 4,
                lineEnd: 4,
                body: "trop large",
                authorId: 5,
                handle: "ada",
                displayName: "Ada",
                createdAt: new Date(),
            },
        ]);

        const response = await request(createApp())
            .post("/api/v1/channels/10/worktrees/3/reviews/8/comments")
            .set("Authorization", authorization)
            .send({ path: "src/login.js", lineStart: 4, body: "trop large" });

        expect(response.status).toBe(201);
        expect(response.body.comments[0].path).toBe("src/login.js");
        expect(response.body.comments[0].lineStart).toBe(4);
    });

    it("enregistre un pipeline rapporté par le client", async () => {
        const authorization = hostedChannel();
        on("worktrees.findMember", () => ({ worktreeId: 3, userId: 5, role: "owner", consentTerminal: 0 }));
        let pipeline = null;
        on("worktrees.reportPipeline", (params) => {
            pipeline = params;
            return { insertId: 4 };
        });
        stubBoard({
            pipelines: [
                {
                    pipelineId: 4,
                    name: "vérifications",
                    status: "passed",
                    logExcerpt: "ok",
                    startedAt: new Date(),
                    finishedAt: new Date(),
                },
            ],
        });

        const response = await request(createApp())
            .post("/api/v1/channels/10/worktrees/3/pipelines")
            .set("Authorization", authorization)
            .send({ name: "vérifications", status: "passed", logExcerpt: "ok" });

        expect(response.status).toBe(201);
        expect(pipeline[1]).toBe("vérifications");
        expect(response.body.worktree.pipelines[0].status).toBe("passed");
    });

    it("consigne une décision technique", async () => {
        const authorization = hostedChannel();
        on("worktrees.findMember", () => ({ worktreeId: 3, userId: 5, role: "owner", consentTerminal: 0 }));
        on("worktrees.addDecision", () => ({ insertId: 1 }));
        stubBoard({
            decisions: [
                {
                    decisionId: 1,
                    title: "JWT",
                    body: "On reste en JWT.",
                    createdBy: 5,
                    handle: "ada",
                    displayName: "Ada",
                    createdAt: new Date(),
                },
            ],
        });

        const response = await request(createApp())
            .post("/api/v1/channels/10/worktrees/3/decisions")
            .set("Authorization", authorization)
            .send({ title: "JWT", body: "On reste en JWT." });

        expect(response.status).toBe(201);
        expect(response.body.worktree.decisions[0].title).toBe("JWT");
    });

    it("marque le deuxième membre pair et le troisième mob", async () => {
        const authorization = hostedChannel("development", alan);
        let members = [adaMember];
        on("worktrees.findById", () => TREE());
        on("worktrees.listMembers", () => members);
        on("worktrees.addMember", (params) => {
            members = [...members, { ...alanMember, role: params[2] }];
            return { affectedRows: 1 };
        });
        on("worktrees.update", () => ({ affectedRows: 1 }));
        on("worktrees.touchMember", () => ({ affectedRows: 1 }));
        on("worktrees.listCommits", () => []);
        on("worktrees.listFiles", () => []);
        on("worktrees.listReviews", () => []);
        on("worktrees.listPipelines", () => []);
        on("worktrees.listDecisions", () => []);
        on("worktrees.listTerminals", () => []);
        on("worktrees.listCursors", () => []);
        on("worktrees.listCommentsForWorktree", () => []);

        const pair = await request(createApp())
            .post("/api/v1/channels/10/worktrees/3/join")
            .set("Authorization", authorization);

        expect(pair.status).toBe(200);
        expect(pair.body.worktree.pairReady).toBe(true);
        expect(pair.body.worktree.collaboration).toBe("pair");
        expect(pair.body.worktree.members.some((member) => member.role === "pair")).toBe(true);

        const asGrace = hostedChannel("incident", grace);
        on("worktrees.addMember", (params) => {
            members = [...members, { ...graceMember, role: params[2] }];
            return { affectedRows: 1 };
        });
        on("worktrees.promotePairsToMob", () => {
            members = members.map((member) => (member.role === "pair" ? { ...member, role: "mob" } : member));
            return { affectedRows: 1 };
        });

        const mob = await request(createApp())
            .post("/api/v1/channels/10/worktrees/3/join")
            .set("Authorization", asGrace);

        expect(mob.status).toBe(200);
        expect(mob.body.worktree.mobReady).toBe(true);
        expect(mob.body.worktree.pairReady).toBe(false);
        expect(mob.body.worktree.collaboration).toBe("mob");
        expect(mob.body.worktree.members.filter((member) => member.role === "mob").length).toBeGreaterThanOrEqual(2);
    });

    it("refuse le terminal tant que tout le monde n'a pas consenti", async () => {
        const authorization = hostedChannel();
        on("worktrees.findById", () => TREE());
        on("worktrees.findMember", () => ({ worktreeId: 3, userId: 5, role: "owner", consentTerminal: 1 }));
        on("worktrees.listMembers", () => [
            { ...adaMember, consentTerminal: 1 },
            { ...alanMember, consentTerminal: 0 },
        ]);

        const response = await request(createApp())
            .post("/api/v1/channels/10/worktrees/3/terminal")
            .set("Authorization", authorization);

        expect(response.status).toBe(403);
        expect(response.body.error.message).toMatch(/consentement/);
    });

    it("n'accepte aucun octet de terminal sans consentement unanime", async () => {
        const authorization = hostedChannel();
        on("worktrees.findById", () => TREE());
        on("worktrees.findMember", () => ({ worktreeId: 3, userId: 5, role: "owner", consentTerminal: 1 }));
        on("worktrees.listMembers", () => [
            { ...adaMember, consentTerminal: 1 },
            { ...alanMember, consentTerminal: 0 },
        ]);

        const response = await request(createApp())
            .post("/api/v1/channels/10/worktrees/3/terminal/9")
            .set("Authorization", authorization)
            .send({ data: "ls\n" });

        expect(response.status).toBe(403);
        expect(response.body.error.message).toMatch(/octet/);
    });

    it("ouvre le terminal quand les deux ont consenti", async () => {
        const authorization = hostedChannel();
        on("worktrees.findMember", () => ({ worktreeId: 3, userId: 5, role: "owner", consentTerminal: 1 }));
        on("worktrees.openTerminal", () => ({ insertId: 9 }));
        on("worktrees.updateTerminal", () => ({ affectedRows: 1 }));
        stubBoard({
            members: [
                { ...adaMember, consentTerminal: 1 },
                { ...alanMember, consentTerminal: 1 },
            ],
            terminals: [{ sessionId: 9, worktreeId: 3, openedBy: 5, status: "open", createdAt: new Date() }],
        });

        const response = await request(createApp())
            .post("/api/v1/channels/10/worktrees/3/terminal")
            .set("Authorization", authorization);

        expect(response.status).toBe(201);
        expect(response.body.worktree.terminals[0].status).toBe("open");
        expect(response.body.worktree.pairReady).toBe(true);
        expect(response.body.worktree.terminalReady).toBe(true);
    });

    it("relaye un octet seulement après ouverture consentie", async () => {
        const authorization = hostedChannel();
        on("worktrees.findById", () => TREE());
        on("worktrees.findMember", () => ({ worktreeId: 3, userId: 5, role: "owner", consentTerminal: 1 }));
        on("worktrees.listMembers", () => [
            { ...adaMember, consentTerminal: 1 },
            { ...alanMember, consentTerminal: 1 },
        ]);
        on("worktrees.findTerminal", () => ({ sessionId: 9, worktreeId: 3, openedBy: 5, status: "open" }));
        let stored = null;
        on("worktrees.appendTerminalChunk", (params) => {
            stored = params;
            return { insertId: 41 };
        });

        const response = await request(createApp())
            .post("/api/v1/channels/10/worktrees/3/terminal/9")
            .set("Authorization", authorization)
            .send({ data: "npm test\n" });

        expect(response.status).toBe(202);
        expect(response.body.data).toBe("npm test\n");
        expect(response.body.sessionId).toBe(9);
        expect(response.body.chunkId).toBe(41);
        expect(response.body.direction).toBe("input");
        expect(stored).toEqual([9, 5, "input", "npm test\n"]);
    });

    it("conserve la sortie du terminal et la rend à partir d'un curseur", async () => {
        const authorization = hostedChannel();
        on("worktrees.findById", () => TREE());
        on("worktrees.findMember", () => ({ worktreeId: 3, userId: 5, role: "owner", consentTerminal: 1 }));
        on("worktrees.listMembers", () => [
            { ...adaMember, consentTerminal: 1 },
            { ...alanMember, consentTerminal: 1 },
        ]);
        on("worktrees.findTerminal", () => ({ sessionId: 9, worktreeId: 3, openedBy: 5, status: "open" }));
        on("worktrees.appendTerminalChunk", () => ({ insertId: 42 }));
        let asked = null;
        on("worktrees.listTerminalChunks", (params) => {
            asked = params;
            return [
                { chunkId: 42, sessionId: 9, userId: 5, direction: "output", data: "> 12 tests passed\n", createdAt: new Date(), handle: "ada" },
            ];
        });

        const write = await request(createApp())
            .post("/api/v1/channels/10/worktrees/3/terminal/9")
            .set("Authorization", authorization)
            .send({ data: "> 12 tests passed\n", direction: "output" });
        expect(write.status).toBe(202);
        expect(write.body.direction).toBe("output");

        const log = await request(createApp())
            .get("/api/v1/channels/10/worktrees/3/terminal/9?after=41&limit=50")
            .set("Authorization", authorization);
        expect(log.status).toBe(200);
        expect(asked).toEqual([9, 41]);
        expect(log.body.status).toBe("open");
        expect(log.body.chunks).toHaveLength(1);
        expect(log.body.chunks[0]).toMatchObject({ chunkId: 42, direction: "output", handle: "ada" });
    });

    it("ne rend le journal du terminal qu'aux membres du worktree", async () => {
        const authorization = hostedChannel("development", grace);
        on("worktrees.findById", () => TREE());
        on("worktrees.findMember", () => null);

        const response = await request(createApp())
            .get("/api/v1/channels/10/worktrees/3/terminal/9")
            .set("Authorization", authorization);

        expect(response.status).toBe(403);
    });

    it("publie un curseur collaboratif", async () => {
        const authorization = hostedChannel();
        on("worktrees.findById", () => TREE());
        on("worktrees.findMember", () => ({ worktreeId: 3, userId: 5, role: "owner", consentTerminal: 0 }));
        on("worktrees.upsertCursor", () => ({ affectedRows: 1 }));

        const response = await request(createApp())
            .put("/api/v1/channels/10/worktrees/3/cursor")
            .set("Authorization", authorization)
            .send({ path: "src/login.js", line: 12, column: 4 });

        expect(response.status).toBe(200);
        expect(response.body.path).toBe("src/login.js");
        expect(response.body.line).toBe(12);
        expect(response.body.channelId).toBe(10);
    });
});
