"use strict";

const { Router } = require("express");

const userController = require("../controllers/userController");
const authenticate = require("../middlewares/authenticate");
const validate = require("../middlewares/validate");
const { asyncHandler } = require("../errors");
const { friendHandleParam, friendshipIdParam } = require("../validators/schemas");

const router = Router();

router.use(authenticate);

router.get("/", asyncHandler(userController.listFriends));
router.post("/:handle", validate({ params: friendHandleParam }), asyncHandler(userController.sendFriendRequest));
router.patch("/:friendshipId", validate({ params: friendshipIdParam }), asyncHandler(userController.acceptFriendRequest));
router.delete("/:friendshipId", validate({ params: friendshipIdParam }), asyncHandler(userController.removeFriend));

module.exports = router;
