"use strict";

const { Router } = require("express");
const authenticate = require("../middlewares/authenticate");
const validate = require("../middlewares/validate");
const linkController = require("../controllers/linkController");
const { strictLimiter } = require("../middlewares/rateLimit");
const { asyncHandler } = require("../errors");
const { linkPreviewSchema } = require("../validators/schemas");

const router = Router();
router.use(authenticate);

router.get("/preview", strictLimiter, validate({ query: linkPreviewSchema }), asyncHandler(linkController.preview));

module.exports = router;
