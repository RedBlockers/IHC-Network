"use strict";

const worktreeRepository = require("../repositories/worktreeRepository");
const realtime = require("../realtime");
const { BadRequest, Forbidden, NotFound } = require("../errors");

const HOSTED = new Set(["development", "review", "incident"]);
const FILE_STATUSES = new Set(["clean", "modified", "added", "deleted"]);
const PIPELINE_STATUSES = new Set(["queued", "running", "passed", "failed"]);
const REVIEW_STATUSES = new Set(["open", "approved", "merged", "closed"]);
const SHA = /^[0-9a-f]{7,40}$/i;

const toUser = (row) => ({
    userId: Number(row.userId),
    handle: row.handle,
    displayName: row.displayName,
    avatar: row.avatar ?? null,
});

const toWorktree = (row, extras = {}) => ({
    worktreeId: Number(row.worktreeId),
    channelId: Number(row.channelId),
    guildId: Number(row.guildId),
    name: row.name,
    baseBranch: row.baseBranch,
    headBranch: row.headBranch,
    headSha: row.headSha ?? null,
    dirty: Boolean(row.dirty),
    status: row.status,
    createdBy: Number(row.createdBy),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...extras,
});

function assertHost(channel) {
    if (!channel.guildId) throw new BadRequest("Un worktree appartient à une communauté.");
    if (!HOSTED.has(channel.type)) {
        throw new BadRequest("Les worktrees s'ouvrent dans un salon de développement, de revue ou d'incident.");
    }
}

function assertSha(value, label) {
    if (!SHA.test(value ?? "")) throw new BadRequest(`${label} invalide.`);
    return value.toLowerCase();
}

async function requireMember(worktreeId, userId) {
    const member = await worktreeRepository.findMember(worktreeId, userId);
    if (!member) throw new Forbidden("Rejoignez ce worktree pour y agir.");
    return member;
}

async function board(channel) {
    assertHost(channel);
    const trees = await worktreeRepository.listByChannel(channel.channelId);
    const detailed = [];
    for (const row of trees) {
        detailed.push(await describe(row));
    }
    return { worktrees: detailed };
}

function mapComment(comment) {
    return {
        commentId: Number(comment.commentId),
        reviewId: Number(comment.reviewId),
        path: comment.path,
        lineStart: Number(comment.lineStart),
        lineEnd: Number(comment.lineEnd),
        body: comment.body,
        author: { userId: Number(comment.authorId), handle: comment.handle, displayName: comment.displayName },
        createdAt: comment.createdAt,
    };
}

function collaborationOf(count) {
    if (count >= 3) return "mob";
    if (count === 2) return "pair";
    return "solo";
}

async function describe(row) {
    const [members, commits, files, reviews, pipelines, decisions, terminals, cursors, comments] = await Promise.all([
        worktreeRepository.listMembers(row.worktreeId),
        worktreeRepository.listCommits(row.worktreeId),
        worktreeRepository.listFiles(row.worktreeId),
        worktreeRepository.listReviews(row.worktreeId),
        worktreeRepository.listPipelines(row.worktreeId),
        worktreeRepository.listDecisions(row.worktreeId),
        worktreeRepository.listTerminals(row.worktreeId),
        worktreeRepository.listCursors(row.worktreeId),
        worktreeRepository.listCommentsForWorktree(row.worktreeId),
    ]);

    const mappedMembers = members.map((member) => ({
        ...toUser(member),
        role: member.role,
        consentTerminal: Boolean(member.consentTerminal),
        lastSeenAt: member.lastSeenAt,
        joinedAt: member.joinedAt,
    }));
    const mappedComments = comments.map(mapComment);

    return toWorktree(row, {
        members: mappedMembers,
        collaboration: collaborationOf(mappedMembers.length),
        pairReady: mappedMembers.length === 2,
        mobReady: mappedMembers.length >= 3,
        terminalReady: mappedMembers.length > 0 && mappedMembers.every((member) => member.consentTerminal),
        commits: commits.map((commit) => ({
            commitId: Number(commit.commitId),
            sha: commit.sha,
            subject: commit.subject,
            authorHandle: commit.authorHandle,
            committedAt: commit.committedAt,
        })),
        files: files.map((file) => ({
            fileId: Number(file.fileId),
            path: file.path,
            status: file.status,
            language: file.language,
            patch: file.patch,
        })),
        reviews: reviews.map((review) => ({
            reviewId: Number(review.reviewId),
            title: review.title,
            baseSha: review.baseSha,
            headSha: review.headSha,
            status: review.status,
            createdBy: Number(review.createdBy),
            createdAt: review.createdAt,
            comments: mappedComments.filter((comment) => comment.reviewId === Number(review.reviewId)),
        })),
        pipelines: pipelines.map((pipeline) => ({
            pipelineId: Number(pipeline.pipelineId),
            name: pipeline.name,
            status: pipeline.status,
            logExcerpt: pipeline.logExcerpt,
            startedAt: pipeline.startedAt,
            finishedAt: pipeline.finishedAt,
        })),
        decisions: decisions.map((decision) => ({
            decisionId: Number(decision.decisionId),
            title: decision.title,
            body: decision.body,
            createdBy: Number(decision.createdBy),
            author: { handle: decision.handle, displayName: decision.displayName },
            createdAt: decision.createdAt,
        })),
        terminals: terminals.map((session) => ({
            sessionId: Number(session.sessionId),
            openedBy: Number(session.openedBy),
            status: session.status,
            createdAt: session.createdAt,
        })),
        cursors: cursors.map((cursor) => ({
            userId: Number(cursor.userId),
            handle: cursor.handle,
            displayName: cursor.displayName,
            path: cursor.path,
            line: Number(cursor.lineNo),
            column: Number(cursor.columnOffset),
            updatedAt: cursor.updatedAt,
        })),
    });
}

async function loadInChannel(channel, worktreeId) {
    const row = await worktreeRepository.findById(worktreeId);
    if (!row || Number(row.channelId) !== Number(channel.channelId)) {
        throw new NotFound("Worktree introuvable.");
    }
    return row;
}

async function create(channel, user, input) {
    assertHost(channel);
    const name = (input.name ?? "").trim();
    if (name.length === 0) throw new BadRequest("Un worktree a besoin d'un nom.");

    const worktreeId = await worktreeRepository.create({
        channelId: channel.channelId,
        guildId: channel.guildId,
        name: name.slice(0, 80),
        baseBranch: (input.baseBranch ?? "main").trim().slice(0, 120) || "main",
        headBranch: (input.headBranch ?? input.baseBranch ?? "main").trim().slice(0, 120) || "main",
        createdBy: user.userId,
    });
    await worktreeRepository.addMember(worktreeId, user.userId, "owner");
    const tree = await describe(await worktreeRepository.findById(worktreeId));
    realtime.emitToChannel(Number(channel.channelId), "worktree:updated", tree);
    return tree;
}

async function join(channel, user, worktreeId) {
    const row = await loadInChannel(channel, worktreeId);
    const existing = await worktreeRepository.listMembers(worktreeId);
    const already = existing.some((member) => Number(member.userId) === Number(user.userId));
    if (!already) {
        const role = existing.length >= 2 ? "mob" : "pair";
        await worktreeRepository.addMember(worktreeId, user.userId, role);
        if (existing.length >= 2) await worktreeRepository.promotePairsToMob(worktreeId);
        if (existing.length >= 1) {
            await worktreeRepository.update(worktreeId, { status: row.status === "idle" ? "active" : row.status });
        }
    }
    await worktreeRepository.touchMember(worktreeId, user.userId);
    const tree = await describe(await worktreeRepository.findById(worktreeId));
    realtime.emitToChannel(Number(channel.channelId), "worktree:updated", tree);
    return tree;
}

async function snapshot(channel, user, worktreeId, input) {
    await loadInChannel(channel, worktreeId);
    await requireMember(worktreeId, user.userId);

    const headBranch = (input.headBranch ?? "").trim().slice(0, 120);
    const files = Array.isArray(input.files) ? input.files.slice(0, 200) : [];
    const commits = Array.isArray(input.commits) ? input.commits.slice(0, 50) : [];

    for (const file of files) {
        if (!file?.path) throw new BadRequest("Un fichier du snapshot doit porter un chemin.");
        if (!FILE_STATUSES.has(file.status)) throw new BadRequest("État de fichier inconnu.");
    }
    for (const commit of commits) {
        assertSha(commit.sha, "Commit");
        if (!(commit.subject ?? "").trim()) throw new BadRequest("Un commit a besoin d'un sujet.");
    }

    const fields = {
        dirty: files.some((file) => file.status !== "clean") ? 1 : 0,
    };
    if (headBranch) fields.headBranch = headBranch;
    if (input.headSha) fields.headSha = assertSha(input.headSha, "HEAD");
    if (input.baseBranch) fields.baseBranch = String(input.baseBranch).trim().slice(0, 120);
    if (fields.dirty) fields.status = "active";

    await worktreeRepository.update(worktreeId, fields);
    await worktreeRepository.replaceFiles(
        worktreeId,
        files.map((file) => ({
            path: String(file.path).slice(0, 500),
            status: file.status,
            language: file.language ? String(file.language).slice(0, 40) : null,
            patch: file.patch ? String(file.patch).slice(0, 200_000) : null,
        }))
    );
    await worktreeRepository.replaceCommits(
        worktreeId,
        commits.map((commit) => ({
            sha: commit.sha.toLowerCase(),
            subject: String(commit.subject).trim().slice(0, 200),
            authorHandle: String(commit.authorHandle ?? user.handle).slice(0, 32),
            committedAt: commit.committedAt ? new Date(commit.committedAt) : new Date(),
        }))
    );
    await worktreeRepository.touchMember(worktreeId, user.userId);

    const tree = await describe(await worktreeRepository.findById(worktreeId));
    realtime.emitToChannel(Number(channel.channelId), "worktree:updated", tree);
    return tree;
}

async function openReview(channel, user, worktreeId, input) {
    const row = await loadInChannel(channel, worktreeId);
    await requireMember(worktreeId, user.userId);
    const title = (input.title ?? "").trim();
    if (!title) throw new BadRequest("Une revue a besoin d'un titre.");
    const reviewId = await worktreeRepository.createReview({
        worktreeId,
        channelId: channel.channelId,
        title: title.slice(0, 160),
        baseSha: assertSha(input.baseSha ?? row.headSha ?? "0000000", "Base"),
        headSha: assertSha(input.headSha ?? row.headSha ?? "0000000", "Tête"),
        createdBy: user.userId,
    });
    await worktreeRepository.update(worktreeId, { status: "review" });
    const tree = await describe(await worktreeRepository.findById(worktreeId));
    realtime.emitToChannel(Number(channel.channelId), "worktree:updated", { ...tree, openedReviewId: reviewId });
    return tree;
}

async function commentReview(channel, user, worktreeId, reviewId, input) {
    await loadInChannel(channel, worktreeId);
    await requireMember(worktreeId, user.userId);
    const review = await worktreeRepository.findReview(reviewId);
    if (!review || Number(review.worktreeId) !== Number(worktreeId)) throw new NotFound("Revue introuvable.");
    const body = (input.body ?? "").trim();
    if (!body) throw new BadRequest("Un commentaire de revue a besoin d'un texte.");
    const path = (input.path ?? "").trim();
    if (!path) throw new BadRequest("Ancrez le commentaire sur un fichier.");
    await worktreeRepository.addComment({
        reviewId,
        path: path.slice(0, 500),
        lineStart: Math.max(1, Number(input.lineStart) || 1),
        lineEnd: Math.max(1, Number(input.lineEnd) || Number(input.lineStart) || 1),
        body: body.slice(0, 2000),
        authorId: user.userId,
    });
    const comments = (await worktreeRepository.listComments(reviewId)).map(mapComment);
    realtime.emitToChannel(Number(channel.channelId), "worktree:review-comment", {
        channelId: Number(channel.channelId),
        worktreeId: Number(worktreeId),
        reviewId: Number(reviewId),
        comments,
    });
    return { comments };
}

async function reviewComments(channel, worktreeId, reviewId) {
    await loadInChannel(channel, worktreeId);
    const review = await worktreeRepository.findReview(reviewId);
    if (!review || Number(review.worktreeId) !== Number(worktreeId)) throw new NotFound("Revue introuvable.");
    return { comments: (await worktreeRepository.listComments(reviewId)).map(mapComment) };
}

async function setReviewStatus(channel, user, worktreeId, reviewId, status) {
    await loadInChannel(channel, worktreeId);
    await requireMember(worktreeId, user.userId);
    if (!REVIEW_STATUSES.has(status)) throw new BadRequest("Statut de revue inconnu.");
    const review = await worktreeRepository.findReview(reviewId);
    if (!review || Number(review.worktreeId) !== Number(worktreeId)) throw new NotFound("Revue introuvable.");
    await worktreeRepository.updateReview(reviewId, { status });
    if (status === "merged") await worktreeRepository.update(worktreeId, { status: "merged" });
    const tree = await describe(await worktreeRepository.findById(worktreeId));
    realtime.emitToChannel(Number(channel.channelId), "worktree:updated", tree);
    return tree;
}

async function reportPipeline(channel, user, worktreeId, input) {
    await loadInChannel(channel, worktreeId);
    await requireMember(worktreeId, user.userId);
    const name = (input.name ?? "").trim();
    if (!name) throw new BadRequest("Un pipeline a besoin d'un nom.");
    if (!PIPELINE_STATUSES.has(input.status)) throw new BadRequest("Statut de pipeline inconnu.");
    const finished = input.status === "running" || input.status === "queued" ? null : new Date();
    await worktreeRepository.reportPipeline({
        worktreeId,
        name: name.slice(0, 80),
        status: input.status,
        logExcerpt: String(input.logExcerpt ?? "").slice(0, 2000),
        finishedAt: finished,
    });
    const tree = await describe(await worktreeRepository.findById(worktreeId));
    realtime.emitToChannel(Number(channel.channelId), "worktree:updated", tree);
    return tree;
}

async function decide(channel, user, worktreeId, input) {
    await loadInChannel(channel, worktreeId);
    await requireMember(worktreeId, user.userId);
    const title = (input.title ?? "").trim();
    const body = (input.body ?? "").trim();
    if (!title || !body) throw new BadRequest("Une décision a besoin d'un titre et d'un motif.");
    await worktreeRepository.addDecision({
        worktreeId,
        title: title.slice(0, 160),
        body: body.slice(0, 4000),
        createdBy: user.userId,
    });
    const tree = await describe(await worktreeRepository.findById(worktreeId));
    realtime.emitToChannel(Number(channel.channelId), "worktree:updated", tree);
    return tree;
}

async function consentTerminal(channel, user, worktreeId, consent) {
    await loadInChannel(channel, worktreeId);
    await requireMember(worktreeId, user.userId);
    await worktreeRepository.setConsent(worktreeId, user.userId, Boolean(consent));
    const tree = await describe(await worktreeRepository.findById(worktreeId));
    realtime.emitToChannel(Number(channel.channelId), "worktree:updated", tree);
    return tree;
}

async function openTerminal(channel, user, worktreeId) {
    await loadInChannel(channel, worktreeId);
    await requireMember(worktreeId, user.userId);
    const members = await worktreeRepository.listMembers(worktreeId);
    if (members.length < 2) throw new BadRequest("Un terminal partagé demande au moins deux personnes.");
    if (!members.every((member) => member.consentTerminal)) {
        throw new Forbidden("Le terminal n'ouvre qu'après le consentement de chaque personne présente.");
    }
    const sessionId = await worktreeRepository.openTerminal(worktreeId, user.userId);
    await worktreeRepository.updateTerminal(sessionId, { status: "open" });
    const tree = await describe(await worktreeRepository.findById(worktreeId));
    realtime.emitToChannel(Number(channel.channelId), "worktree:updated", tree);
    return tree;
}

async function writeTerminal(channel, user, worktreeId, sessionId, input) {
    await loadInChannel(channel, worktreeId);
    await requireMember(worktreeId, user.userId);
    const members = await worktreeRepository.listMembers(worktreeId);
    if (members.length < 2) throw new BadRequest("Un terminal partagé demande au moins deux personnes.");
    if (!members.every((member) => member.consentTerminal)) {
        throw new Forbidden("Aucun octet de terminal tant que chaque personne présente n'a pas consenti.");
    }
    const session = await worktreeRepository.findTerminal(sessionId);
    if (!session || Number(session.worktreeId) !== Number(worktreeId)) throw new NotFound("Session introuvable.");
    if (session.status !== "open") throw new Forbidden("La session n'est pas ouverte.");
    const data = String(input.data ?? "").slice(0, 4000);
    if (!data) throw new BadRequest("Aucun octet à relayer.");
    const direction = input.direction === "output" ? "output" : "input";
    const chunkId = await worktreeRepository.appendTerminalChunk({
        sessionId,
        userId: user.userId,
        direction,
        data,
    });
    const payload = {
        chunkId: Number(chunkId),
        channelId: Number(channel.channelId),
        worktreeId: Number(worktreeId),
        sessionId: Number(sessionId),
        userId: Number(user.userId),
        handle: user.handle,
        direction,
        data,
        createdAt: new Date().toISOString(),
    };
    realtime.emitToChannel(Number(channel.channelId), "worktree:terminal", payload);
    return payload;
}

async function terminalLog(channel, user, worktreeId, sessionId, { after = 0, limit = 200 } = {}) {
    await loadInChannel(channel, worktreeId);
    await requireMember(worktreeId, user.userId);
    const session = await worktreeRepository.findTerminal(sessionId);
    if (!session || Number(session.worktreeId) !== Number(worktreeId)) throw new NotFound("Session introuvable.");
    const chunks = await worktreeRepository.listTerminalChunks(sessionId, after, limit);
    return {
        sessionId: Number(session.sessionId),
        status: session.status,
        openedBy: Number(session.openedBy),
        chunks: chunks.map((chunk) => ({
            chunkId: Number(chunk.chunkId),
            userId: Number(chunk.userId),
            handle: chunk.handle,
            direction: chunk.direction,
            data: chunk.data,
            createdAt: chunk.createdAt,
        })),
    };
}

async function closeTerminal(channel, user, worktreeId, sessionId) {
    await loadInChannel(channel, worktreeId);
    await requireMember(worktreeId, user.userId);
    const session = await worktreeRepository.findTerminal(sessionId);
    if (!session || Number(session.worktreeId) !== Number(worktreeId)) throw new NotFound("Session introuvable.");
    await worktreeRepository.updateTerminal(sessionId, { status: "closed" });
    const tree = await describe(await worktreeRepository.findById(worktreeId));
    realtime.emitToChannel(Number(channel.channelId), "worktree:updated", tree);
    return tree;
}

async function moveCursor(channel, user, worktreeId, input) {
    await loadInChannel(channel, worktreeId);
    await requireMember(worktreeId, user.userId);
    const path = (input.path ?? "").trim();
    if (!path) throw new BadRequest("Un curseur a besoin d'un fichier.");
    await worktreeRepository.upsertCursor({
        worktreeId,
        userId: user.userId,
        path: path.slice(0, 500),
        lineNo: Math.max(1, Number(input.line) || 1),
        columnOffset: Math.max(0, Number(input.column) || 0),
    });
    const payload = {
        channelId: Number(channel.channelId),
        worktreeId: Number(worktreeId),
        userId: Number(user.userId),
        handle: user.handle,
        displayName: user.displayName,
        path,
        line: Math.max(1, Number(input.line) || 1),
        column: Math.max(0, Number(input.column) || 0),
    };
    realtime.emitToChannel(Number(channel.channelId), "worktree:cursor", payload);
    return payload;
}

module.exports = {
    board,
    create,
    join,
    snapshot,
    openReview,
    commentReview,
    reviewComments,
    setReviewStatus,
    reportPipeline,
    decide,
    consentTerminal,
    openTerminal,
    writeTerminal,
    terminalLog,
    closeTerminal,
    moveCursor,
};
