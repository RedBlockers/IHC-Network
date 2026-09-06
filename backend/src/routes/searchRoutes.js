"use strict";

const { Router } = require("express");
const authenticate = require("../middlewares/authenticate");
const validate = require("../middlewares/validate");
const searchController = require("../controllers/searchController");
const { asyncHandler } = require("../errors");
const { searchQuerySchema } = require("../validators/schemas");

const router = Router();
router.use(authenticate);

router.get("/", validate({ query: searchQuerySchema }), asyncHandler(searchController.searchAll));
router.get("/files", validate({ query: searchQuerySchema }), asyncHandler(searchController.searchFiles));
router.get("/semantic", validate({ query: searchQuerySchema }), asyncHandler(searchController.searchSemantic));

module.exports = router;
