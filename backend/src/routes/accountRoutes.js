"use strict";

const { Router } = require("express");
const authenticate = require("../middlewares/authenticate");
const validate = require("../middlewares/validate");
const controller = require("../controllers/accountController");
const { asyncHandler } = require("../errors");
const { strictLimiter } = require("../middlewares/rateLimit");
const { deleteAccountSchema, acceptPolicySchema, createAccessTokenSchema, accessTokenIdParam } = require("../validators/schemas");

const router = Router();
router.use(authenticate);

router.post("/deletion", validate({ body: deleteAccountSchema }), asyncHandler(controller.requestDeletion));
router.delete("/deletion", asyncHandler(controller.cancelDeletion));

router.get("/export", asyncHandler(controller.exportData));

router.get("/policy", asyncHandler(controller.policyStatus));
router.post("/policy", validate({ body: acceptPolicySchema }), asyncHandler(controller.acceptPolicy));

router.get("/tokens", asyncHandler(controller.listTokens));
router.post("/tokens", strictLimiter, validate({ body: createAccessTokenSchema }), asyncHandler(controller.createToken));
router.delete("/tokens/:tokenId", validate({ params: accessTokenIdParam }), asyncHandler(controller.revokeToken));

module.exports = router;
