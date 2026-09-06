"use strict";

const { Router } = require("express");
const authenticate = require("../middlewares/authenticate");
const validate = require("../middlewares/validate");
const controller = require("../controllers/organisationController");
const { asyncHandler } = require("../errors");
const {
    guildIdParam,
    channelIdParam,
    folderIdParam,
    createFolderSchema,
    updateFolderSchema,
    placeGuildSchema,
    channelFavoriteSchema,
    displayPrefsSchema,
} = require("../validators/schemas");

const router = Router();
router.use(authenticate);

router.get("/", asyncHandler(controller.overview));

router.post("/folders", validate({ body: createFolderSchema }), asyncHandler(controller.createFolder));
router.patch("/folders/:folderId", validate({ params: folderIdParam, body: updateFolderSchema }), asyncHandler(controller.updateFolder));
router.delete("/folders/:folderId", validate({ params: folderIdParam }), asyncHandler(controller.deleteFolder));

router.put("/guilds/:guildId", validate({ params: guildIdParam, body: placeGuildSchema }), asyncHandler(controller.placeGuild));
router.put("/channels/:channelId", validate({ params: channelIdParam, body: channelFavoriteSchema }), asyncHandler(controller.setChannelFavorite));
router.put("/display", validate({ body: displayPrefsSchema }), asyncHandler(controller.setDisplay));

module.exports = router;
