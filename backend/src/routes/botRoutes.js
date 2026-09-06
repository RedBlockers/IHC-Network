"use strict";

const { Router } = require("express");
const { z } = require("zod");

const botService = require("../services/botService");
const validate = require("../middlewares/validate");
const { asyncHandler } = require("../errors");

const router = Router();

const botAuth = z.object({
    publicId: z.string().trim().min(8).max(32),
});

const botPost = z.object({
    channelId: z.coerce.number().int().positive(),
    content: z.string().trim().min(1).max(4000),
});

const botPoll = z.object({
    after: z.coerce.number().int().min(0).default(0),
});

function tokenOf(req) {
    const header = req.get("Authorization") || "";
    return header.startsWith("Bot ") ? header.slice(4) : req.get("X-Bot-Token") || "";
}

router.post(
    "/:publicId/messages",
    validate({ params: botAuth, body: botPost }),
    asyncHandler(async (req, res) => {
        const message = await botService.post(req.params.publicId, tokenOf(req), req.body.channelId, req.body.content);
        res.status(201).json({ message });
    })
);

router.get(
    "/:publicId/events",
    validate({ params: botAuth, query: botPoll }),
    asyncHandler(async (req, res) => {
        const result = await botService.pollEvents(req.params.publicId, tokenOf(req), req.validatedQuery.after);
        res.status(200).json(result);
    })
);

module.exports = router;
