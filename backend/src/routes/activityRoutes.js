"use strict";

const { Router } = require("express");

const communityAppsController = require("../controllers/communityAppsController");
const validate = require("../middlewares/validate");
const { asyncHandler } = require("../errors");
const { strictLimiter } = require("../middlewares/rateLimit");
const { activityVerifySchema } = require("../validators/schemas");

const router = Router();

router.post(
    "/verify",
    strictLimiter,
    validate({ body: activityVerifySchema }),
    asyncHandler(communityAppsController.verifyActivity)
);

module.exports = router;
