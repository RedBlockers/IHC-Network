"use strict";

const { Router } = require("express");

const guildController = require("../controllers/guildController");
const authenticate = require("../middlewares/authenticate");
const validate = require("../middlewares/validate");
const { asyncHandler } = require("../errors");
const { strictLimiter } = require("../middlewares/rateLimit");
const { inviteCodeParam } = require("../validators/schemas");

const router = Router();

router.get(
    "/:code",
    strictLimiter,
    validate({ params: inviteCodeParam }),
    asyncHandler(guildController.previewInvite)
);

router.post(
    "/:code/accept",
    authenticate,
    validate({ params: inviteCodeParam }),
    asyncHandler(guildController.acceptInvite)
);

module.exports = router;
