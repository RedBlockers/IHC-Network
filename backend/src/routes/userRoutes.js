"use strict";

const { Router } = require("express");

const userController = require("../controllers/userController");
const relationController = require("../controllers/relationController");
const authenticate = require("../middlewares/authenticate");
const validate = require("../middlewares/validate");
const { asyncHandler } = require("../errors");
const { uploadImages } = require("../middlewares/upload");
const presenceController = require("../controllers/presenceController");
const {
    userIdParam, userSearchSchema, updateProfileSchema, updatePreferencesSchema, contactNoteSchema,
    activitySchema,
    visibilitySchema,
} = require("../validators/schemas");

const router = Router();

router.use(authenticate);

router.get("/decorations", asyncHandler(userController.decorations));

router.get("/me/guilds", asyncHandler(userController.listGuilds));
router.get("/me/channels", asyncHandler(userController.listDirectChannels));
router.patch("/me", uploadImages(["avatar", "bannerImage"]), validate({ body: updateProfileSchema }), asyncHandler(userController.updateMe));
router.patch("/me/preferences", validate({ body: updatePreferencesSchema }), asyncHandler(userController.updatePreferences));
router.put("/me/activity", validate({ body: activitySchema }), asyncHandler(presenceController.setActivity));
router.delete("/me/activity", asyncHandler(presenceController.clearActivity));
router.put("/me/presence-visibility", validate({ body: visibilitySchema }), asyncHandler(presenceController.visibility));

router.get("/me/groups", asyncHandler(require("../controllers/groupChannelController").list));
router.post(
    "/me/groups",
    validate({ body: require("../validators/schemas").createGroupSchema }),
    asyncHandler(require("../controllers/groupChannelController").create)
);

router.get("/me/drafts", asyncHandler(require("../controllers/draftController").list));

router.get("/me/reactions", asyncHandler(require("../controllers/messageController").favoriteReactions));

router.get("/search", validate({ query: userSearchSchema }), asyncHandler(userController.search));

router.get("/me/blocked", asyncHandler(relationController.listBlocked));
router.put("/:userId/block", validate({ params: userIdParam }), asyncHandler(relationController.block));
router.delete("/:userId/block", validate({ params: userIdParam }), asyncHandler(relationController.unblock));
router.get("/:userId/note", validate({ params: userIdParam }), asyncHandler(relationController.getNote));
router.put("/:userId/note", validate({ params: userIdParam, body: contactNoteSchema }), asyncHandler(relationController.setNote));

router.get("/:userId", validate({ params: userIdParam }), asyncHandler(userController.getById));

module.exports = router;
