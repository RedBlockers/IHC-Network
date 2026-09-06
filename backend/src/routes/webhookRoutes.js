"use strict";

const { Router } = require("express");
const validate = require("../middlewares/validate");
const webhookController = require("../controllers/webhookController");
const { strictLimiter } = require("../middlewares/rateLimit");
const { asyncHandler } = require("../errors");
const { webhookTokenParam, webhookPostSchema } = require("../validators/schemas");

const router = Router();

router.post(
    "/:token",
    strictLimiter,
    validate({ params: webhookTokenParam, body: webhookPostSchema }),
    asyncHandler(webhookController.post)
);

module.exports = router;
