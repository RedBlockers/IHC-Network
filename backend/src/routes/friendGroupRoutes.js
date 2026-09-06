"use strict";

const { Router } = require("express");
const authenticate = require("../middlewares/authenticate");
const validate = require("../middlewares/validate");
const controller = require("../controllers/friendGroupController");
const { asyncHandler } = require("../errors");
const { friendGroupParam, friendGroupMemberParam, friendGroupSchema, friendGroupMemberSchema } = require("../validators/schemas");

const router = Router();
router.use(authenticate);

router.get("/", asyncHandler(controller.list));
router.post("/", validate({ body: friendGroupSchema }), asyncHandler(controller.create));
router.patch("/:groupId", validate({ params: friendGroupParam, body: friendGroupSchema }), asyncHandler(controller.rename));
router.delete("/:groupId", validate({ params: friendGroupParam }), asyncHandler(controller.remove));
router.put(
    "/:groupId/members/:userId",
    validate({ params: friendGroupMemberParam, body: friendGroupMemberSchema }),
    asyncHandler(controller.setMember)
);

module.exports = router;
