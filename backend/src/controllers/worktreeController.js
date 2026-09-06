"use strict";

const worktreeService = require("../services/worktreeService");

const worktreeController = {
    board: async (req, res) => res.status(200).json(await worktreeService.board(req.channel)),
    create: async (req, res) =>
        res.status(201).json({ worktree: await worktreeService.create(req.channel, req.user, req.body) }),
    join: async (req, res) =>
        res.status(200).json({ worktree: await worktreeService.join(req.channel, req.user, req.params.worktreeId) }),
    snapshot: async (req, res) =>
        res.status(200).json({
            worktree: await worktreeService.snapshot(req.channel, req.user, req.params.worktreeId, req.body),
        }),
    openReview: async (req, res) =>
        res.status(201).json({
            worktree: await worktreeService.openReview(req.channel, req.user, req.params.worktreeId, req.body),
        }),
    comment: async (req, res) =>
        res.status(201).json(
            await worktreeService.commentReview(
                req.channel,
                req.user,
                req.params.worktreeId,
                req.params.reviewId,
                req.body
            )
        ),
    comments: async (req, res) =>
        res.status(200).json(
            await worktreeService.reviewComments(req.channel, req.params.worktreeId, req.params.reviewId)
        ),
    reviewStatus: async (req, res) =>
        res.status(200).json({
            worktree: await worktreeService.setReviewStatus(
                req.channel,
                req.user,
                req.params.worktreeId,
                req.params.reviewId,
                req.body.status
            ),
        }),
    pipeline: async (req, res) =>
        res.status(201).json({
            worktree: await worktreeService.reportPipeline(req.channel, req.user, req.params.worktreeId, req.body),
        }),
    decide: async (req, res) =>
        res.status(201).json({
            worktree: await worktreeService.decide(req.channel, req.user, req.params.worktreeId, req.body),
        }),
    consent: async (req, res) =>
        res.status(200).json({
            worktree: await worktreeService.consentTerminal(
                req.channel,
                req.user,
                req.params.worktreeId,
                req.body.consent
            ),
        }),
    openTerminal: async (req, res) =>
        res.status(201).json({
            worktree: await worktreeService.openTerminal(req.channel, req.user, req.params.worktreeId),
        }),
    writeTerminal: async (req, res) =>
        res.status(202).json(
            await worktreeService.writeTerminal(
                req.channel,
                req.user,
                req.params.worktreeId,
                req.params.sessionId,
                req.body
            )
        ),
    terminalLog: async (req, res) =>
        res.status(200).json(
            await worktreeService.terminalLog(
                req.channel,
                req.user,
                req.params.worktreeId,
                req.params.sessionId,
                req.validatedQuery ?? {}
            )
        ),
    closeTerminal: async (req, res) =>
        res.status(200).json({
            worktree: await worktreeService.closeTerminal(
                req.channel,
                req.user,
                req.params.worktreeId,
                req.params.sessionId
            ),
        }),
    cursor: async (req, res) =>
        res.status(200).json(await worktreeService.moveCursor(req.channel, req.user, req.params.worktreeId, req.body)),
};

module.exports = worktreeController;
