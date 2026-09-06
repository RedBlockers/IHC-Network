"use strict";

const { Router } = require("express");
const authenticate = require("../middlewares/authenticate");
const validate = require("../middlewares/validate");
const notificationController = require("../controllers/notificationController");
const settingsController = require("../controllers/notificationSettingsController");
const { asyncHandler } = require("../errors");
const {
    notificationListSchema,
    notificationFilterSchema,
    notificationIdParam,
    guildIdParam,
    channelIdParam,
    channelMessageParam,
    notificationLevelSchema,
    quietHoursSchema,
    unreadQuerySchema,
    pushSubscribeSchema,
    pushUnsubscribeSchema,
} = require("../validators/schemas");

const router = Router();
router.use(authenticate);
router.get("/", validate({ query: notificationListSchema }), asyncHandler(notificationController.list));
router.get("/digest", asyncHandler(notificationController.digest));
router.patch("/read", validate({ query: notificationFilterSchema }), asyncHandler(notificationController.markAllRead));

router.get("/push/key", asyncHandler(notificationController.pushKey));
router.get("/push/devices", asyncHandler(notificationController.pushDevices));
router.post("/push", validate({ body: pushSubscribeSchema }), asyncHandler(notificationController.subscribePush));
router.delete("/push", validate({ body: pushUnsubscribeSchema }), asyncHandler(notificationController.unsubscribePush));

router.get("/settings", asyncHandler(settingsController.list));
router.put(
    "/settings/guilds/:guildId",
    validate({ params: guildIdParam, body: notificationLevelSchema }),
    asyncHandler(settingsController.setGuild)
);
router.put(
    "/settings/channels/:channelId",
    validate({ params: channelIdParam, body: notificationLevelSchema }),
    asyncHandler(settingsController.setChannel)
);
router.put("/settings/quiet-hours", validate({ body: quietHoursSchema }), asyncHandler(settingsController.setQuietHours));

router.get("/unread", validate({ query: unreadQuerySchema }), asyncHandler(settingsController.unread));
router.put(
    "/read/:channelId",
    validate({ params: channelIdParam }),
    asyncHandler(settingsController.markChannelRead)
);

router.put(
    "/read/:channelId/:messageId",
    validate({ params: channelMessageParam }),
    asyncHandler(settingsController.markRead)
);

router.patch("/:notificationId/read", validate({ params: notificationIdParam }), asyncHandler(notificationController.markRead));

module.exports = router;
