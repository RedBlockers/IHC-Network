"use strict";

const { Router } = require("express");

const guildController = require("../controllers/guildController");
const roleController = require("../controllers/roleController");
const moderationController = require("../controllers/moderationController");
const searchController = require("../controllers/searchController");
const reportController = require("../controllers/reportController");
const onboardingController = require("../controllers/onboardingController");
const automodController = require("../controllers/automodController");
const communityAppsController = require("../controllers/communityAppsController");
const channelPermissionController = require("../controllers/channelPermissionController");
const presenceController = require("../controllers/presenceController");
const authenticate = require("../middlewares/authenticate");
const validate = require("../middlewares/validate");
const { uploadImage, uploadImages } = require("../middlewares/upload");
const { requireGuildRole, requireGuildPermission } = require("../middlewares/authorize");
const { asyncHandler } = require("../errors");
const {
    createGuildSchema, updateGuildSchema, createChannelSchema, createInviteSchema, guildIdParam, memberDirectorySchema, roleTemplateParam, applyTemplateSchema,
    createRoleSchema, updateRoleSchema, roleIdParam, memberRoleParam,
    channelPermissionParam, channelPermissionTargetParam, channelPermissionSchema,
    explainPermissionSchema, reorderRolesSchema,
    createCategorySchema, updateCategorySchema, categoryIdParam,
    reorderCategoriesSchema, reorderChannelsSchema, inviteIdParam, transferGuildSchema, suspendGuildSchema, themeIdParam, publishThemeSchema, modeIdParam, channelModeSchema, deleteGuildSchema, emojiIdParam, createEmojiSchema, listEmojiSchema, guildProfileSchema, discoverSchema, discoverySettingsSchema,
    sanctionSchema, revokeSanctionSchema, appealSchema, moderationNoteSchema,
    auditQuerySchema, guildMemberParam, sanctionIdParam, searchQuerySchema,
    reportQuerySchema, resolveReportSchema, reportIdParam,
    onboardingSchema, completeOnboardingSchema, automodSchema,
    createBotSchema, createActivitySchema, activityLaunchSchema, createAutomationSchema,
    updateAutomationSchema, botIdParam, activityIdParam, automationIdParam,
} = require("../validators/schemas");

const router = Router();

router.get("/discover", validate({ query: discoverSchema }), asyncHandler(guildController.discover));

router.use(authenticate);

router.post("/", uploadImage("icon"), validate({ body: createGuildSchema }), asyncHandler(guildController.create));

router.get("/:guildId", validate({ params: guildIdParam }), requireGuildRole("member"), asyncHandler(guildController.getById));

router.patch(
    "/:guildId",
    validate({ params: guildIdParam }),
    requireGuildPermission("MANAGE_GUILD"),
    uploadImages(["icon", "bannerImage"]),
    validate({ body: updateGuildSchema }),
    asyncHandler(guildController.update)
);
router.get(
    "/:guildId/channels",
    validate({ params: guildIdParam }),
    requireGuildRole("member"),
    asyncHandler(guildController.listChannels)
);
router.get(
    "/:guildId/default-channel",
    validate({ params: guildIdParam }),
    requireGuildRole("member"),
    asyncHandler(guildController.getDefaultChannel)
);

router.post(
    "/:guildId/channels",
    validate({ params: guildIdParam, body: createChannelSchema }),
    requireGuildPermission("MANAGE_CHANNELS"),
    asyncHandler(guildController.createChannel)
);

router.get(
    "/:guildId/categories",
    validate({ params: guildIdParam }),
    requireGuildRole("member"),
    asyncHandler(guildController.listCategories)
);

router.post(
    "/:guildId/categories",
    validate({ params: guildIdParam, body: createCategorySchema }),
    requireGuildPermission("MANAGE_CHANNELS"),
    asyncHandler(guildController.createCategory)
);

router.patch(
    "/:guildId/categories/order",
    validate({ params: guildIdParam, body: reorderCategoriesSchema }),
    requireGuildPermission("MANAGE_CHANNELS"),
    asyncHandler(guildController.reorderCategories)
);

router.patch(
    "/:guildId/channels/order",
    validate({ params: guildIdParam, body: reorderChannelsSchema }),
    requireGuildPermission("MANAGE_CHANNELS"),
    asyncHandler(guildController.reorderChannels)
);

router.patch(
    "/:guildId/categories/:categoryId",
    validate({ params: categoryIdParam, body: updateCategorySchema }),
    requireGuildPermission("MANAGE_CHANNELS"),
    asyncHandler(guildController.updateCategory)
);

router.delete(
    "/:guildId/categories/:categoryId",
    validate({ params: categoryIdParam }),
    requireGuildPermission("MANAGE_CHANNELS"),
    asyncHandler(guildController.removeCategory)
);

router.get(
    "/:guildId/channels/:channelId/permissions",
    validate({ params: channelPermissionParam }),
    requireGuildPermission("MANAGE_CHANNELS"),
    asyncHandler(channelPermissionController.list)
);

router.get(
    "/:guildId/channels/:channelId/permissions/explain",
    validate({ params: channelPermissionParam, query: explainPermissionSchema }),
    requireGuildPermission("MANAGE_CHANNELS"),
    asyncHandler(channelPermissionController.explain)
);

router.put(
    "/:guildId/channels/:channelId/permissions/:targetType/:targetId",
    validate({ params: channelPermissionTargetParam, body: channelPermissionSchema }),
    requireGuildPermission("MANAGE_CHANNELS"),
    asyncHandler(channelPermissionController.replace)
);

router.get(
    "/:guildId/roles",
    validate({ params: guildIdParam }),
    requireGuildPermission("CREATE_INVITE"),
    asyncHandler(roleController.list)
);

router.post(
    "/:guildId/roles",
    validate({ params: guildIdParam, body: createRoleSchema }),
    requireGuildPermission("MANAGE_ROLES"),
    asyncHandler(roleController.create)
);

router.get(
    "/:guildId/home",
    validate({ params: guildIdParam }),
    requireGuildRole("member"),
    asyncHandler(guildController.home)
);

router.get(
    "/:guildId/roles/templates",
    validate({ params: guildIdParam }),
    requireGuildPermission("MANAGE_ROLES"),
    asyncHandler(roleController.templates)
);

router.post(
    "/:guildId/roles/templates/:templateId",
    validate({ params: roleTemplateParam, body: applyTemplateSchema }),
    requireGuildPermission("MANAGE_ROLES"),
    asyncHandler(roleController.createFromTemplate)
);

router.get(
    "/:guildId/members",
    validate({ params: guildIdParam, query: memberDirectorySchema }),
    requireGuildPermission("KICK_MEMBERS"),
    asyncHandler(guildController.members)
);

router.get(
    "/:guildId/overview",
    validate({ params: guildIdParam }),
    requireGuildPermission("VIEW_AUDIT_LOG"),
    asyncHandler(guildController.overview)
);

router.patch(
    "/:guildId/roles/order",
    validate({ params: guildIdParam, body: reorderRolesSchema }),
    requireGuildPermission("MANAGE_ROLES"),
    asyncHandler(roleController.reorder)
);

router.patch(
    "/:guildId/roles/:roleId",
    validate({ params: roleIdParam, body: updateRoleSchema }),
    requireGuildPermission("MANAGE_ROLES"),
    asyncHandler(roleController.update)
);

router.delete(
    "/:guildId/roles/:roleId",
    validate({ params: roleIdParam }),
    requireGuildPermission("MANAGE_ROLES"),
    asyncHandler(roleController.remove)
);

router.put(
    "/:guildId/members/:userId/roles/:roleId",
    validate({ params: memberRoleParam }),
    requireGuildPermission("MANAGE_ROLES"),
    asyncHandler(roleController.assign)
);

router.delete(
    "/:guildId/members/:userId/roles/:roleId",
    validate({ params: memberRoleParam }),
    requireGuildPermission("MANAGE_ROLES"),
    asyncHandler(roleController.unassign)
);

router.get(
    "/:guildId/search",
    validate({ params: guildIdParam, query: searchQuerySchema }),
    requireGuildRole("member"),
    asyncHandler(searchController.searchGuild)
);

router.get(
    "/:guildId/bots",
    validate({ params: guildIdParam }),
    requireGuildPermission("MANAGE_WEBHOOKS"),
    asyncHandler(communityAppsController.listBots)
);

router.post(
    "/:guildId/bots",
    validate({ params: guildIdParam, body: createBotSchema }),
    requireGuildPermission("MANAGE_WEBHOOKS"),
    asyncHandler(communityAppsController.createBot)
);

router.delete(
    "/:guildId/bots/:botId",
    validate({ params: botIdParam }),
    requireGuildPermission("MANAGE_WEBHOOKS"),
    asyncHandler(communityAppsController.revokeBot)
);

router.get(
    "/:guildId/activities",
    validate({ params: guildIdParam }),
    requireGuildRole("member"),
    asyncHandler(communityAppsController.listActivities)
);

router.post(
    "/:guildId/activities",
    validate({ params: guildIdParam, body: createActivitySchema }),
    requireGuildPermission("MANAGE_GUILD"),
    asyncHandler(communityAppsController.createActivity)
);

router.delete(
    "/:guildId/activities/:activityId",
    validate({ params: activityIdParam }),
    requireGuildPermission("MANAGE_GUILD"),
    asyncHandler(communityAppsController.removeActivity)
);

router.post(
    "/:guildId/activities/:activityId/launch",
    validate({ params: activityIdParam, body: activityLaunchSchema }),
    requireGuildRole("member"),
    asyncHandler(communityAppsController.launchActivity)
);

router.get(
    "/:guildId/automations",
    validate({ params: guildIdParam }),
    requireGuildPermission("MANAGE_GUILD"),
    asyncHandler(communityAppsController.listAutomations)
);

router.post(
    "/:guildId/automations",
    validate({ params: guildIdParam, body: createAutomationSchema }),
    requireGuildPermission("MANAGE_GUILD"),
    asyncHandler(communityAppsController.createAutomation)
);

router.delete(
    "/:guildId/automations/:automationId",
    validate({ params: automationIdParam }),
    requireGuildPermission("MANAGE_GUILD"),
    asyncHandler(communityAppsController.removeAutomation)
);

router.patch(
    "/:guildId/automations/:automationId",
    validate({ params: automationIdParam, body: updateAutomationSchema }),
    requireGuildPermission("MANAGE_GUILD"),
    asyncHandler(communityAppsController.setAutomation)
);

router.get(
    "/:guildId/automod",
    validate({ params: guildIdParam }),
    requireGuildPermission("MODERATE_MEMBERS"),
    asyncHandler(automodController.describe)
);

router.put(
    "/:guildId/automod",
    validate({ params: guildIdParam, body: automodSchema }),
    requireGuildPermission("MANAGE_GUILD"),
    asyncHandler(automodController.configure)
);

router.get(
    "/:guildId/onboarding",
    validate({ params: guildIdParam }),
    requireGuildRole("member"),
    asyncHandler(onboardingController.describe)
);

router.put(
    "/:guildId/onboarding",
    validate({ params: guildIdParam, body: onboardingSchema }),
    requireGuildPermission("MANAGE_GUILD"),
    asyncHandler(onboardingController.configure)
);

router.post(
    "/:guildId/onboarding/complete",
    validate({ params: guildIdParam, body: completeOnboardingSchema }),
    requireGuildRole("member"),
    asyncHandler(onboardingController.complete)
);

router.get(
    "/:guildId/reports",
    validate({ params: guildIdParam, query: reportQuerySchema }),
    requireGuildPermission("MODERATE_MEMBERS"),
    asyncHandler(reportController.queue)
);

router.get(
    "/:guildId/reports/:reportId/context",
    validate({ params: reportIdParam }),
    requireGuildPermission("MODERATE_MEMBERS"),
    asyncHandler(reportController.context)
);

router.patch(
    "/:guildId/reports/:reportId",
    validate({ params: reportIdParam, body: resolveReportSchema }),
    requireGuildPermission("MODERATE_MEMBERS"),
    asyncHandler(reportController.resolve)
);

router.post(
    "/:guildId/members/:userId/sanctions",
    validate({ params: guildMemberParam, body: sanctionSchema }),
    requireGuildPermission("MODERATE_MEMBERS"),
    asyncHandler(moderationController.sanction)
);

router.delete(
    "/:guildId/sanctions/:sanctionId",
    validate({ params: sanctionIdParam, body: revokeSanctionSchema }),
    requireGuildPermission("MODERATE_MEMBERS"),
    asyncHandler(moderationController.revoke)
);

router.post(
    "/:guildId/sanctions/:sanctionId/appeal",
    validate({ params: sanctionIdParam, body: appealSchema }),
    asyncHandler(moderationController.appeal)
);

router.get(
    "/:guildId/members/:userId/record",
    validate({ params: guildMemberParam }),
    requireGuildPermission("MODERATE_MEMBERS"),
    asyncHandler(moderationController.memberRecord)
);

router.post(
    "/:guildId/members/:userId/notes",
    validate({ params: guildMemberParam, body: moderationNoteSchema }),
    requireGuildPermission("MODERATE_MEMBERS"),
    asyncHandler(moderationController.addNote)
);

router.get(
    "/:guildId/audit",
    validate({ params: guildIdParam, query: auditQuerySchema }),
    requireGuildPermission("MODERATE_MEMBERS"),
    asyncHandler(moderationController.auditLog)
);

router.post(
    "/:guildId/invites",
    validate({ params: guildIdParam, body: createInviteSchema }),
    requireGuildRole("member"),
    asyncHandler(guildController.createInvite)
);

router.get(
    "/:guildId/invites",
    validate({ params: guildIdParam }),
    requireGuildPermission("MANAGE_GUILD"),
    asyncHandler(guildController.listInvites)
);

router.delete(
    "/:guildId/invites/:inviteId",
    validate({ params: inviteIdParam }),
    requireGuildPermission("MANAGE_GUILD"),
    asyncHandler(guildController.revokeInvite)
);

router.post(
    "/:guildId/transfer",
    validate({ params: guildIdParam, body: transferGuildSchema }),
    requireGuildRole("owner"),
    asyncHandler(guildController.transferOwnership)
);

router.get(
    "/:guildId/channel-modes",
    validate({ params: guildIdParam }),
    requireGuildRole("member"),
    asyncHandler(guildController.listChannelModes)
);
router.post(
    "/:guildId/channel-modes",
    validate({ params: guildIdParam, body: channelModeSchema }),
    requireGuildPermission("MANAGE_GUILD"),
    asyncHandler(guildController.createChannelMode)
);
router.patch(
    "/:guildId/channel-modes/:modeId",
    validate({ params: modeIdParam, body: channelModeSchema }),
    requireGuildPermission("MANAGE_GUILD"),
    asyncHandler(guildController.updateChannelMode)
);
router.delete(
    "/:guildId/channel-modes/:modeId",
    validate({ params: modeIdParam }),
    requireGuildPermission("MANAGE_GUILD"),
    asyncHandler(guildController.removeChannelMode)
);

router.get(
    "/:guildId/theme",
    validate({ params: guildIdParam }),
    requireGuildRole("member"),
    asyncHandler(guildController.activeTheme)
);
router.get(
    "/:guildId/themes",
    validate({ params: guildIdParam }),
    requireGuildPermission("MANAGE_GUILD"),
    asyncHandler(guildController.themeHistory)
);
router.post(
    "/:guildId/themes",
    validate({ params: guildIdParam, body: publishThemeSchema }),
    requireGuildPermission("MANAGE_GUILD"),
    asyncHandler(guildController.publishTheme)
);
router.post(
    "/:guildId/themes/:themeId/rollback",
    validate({ params: themeIdParam }),
    requireGuildPermission("MANAGE_GUILD"),
    asyncHandler(guildController.rollbackTheme)
);
router.delete(
    "/:guildId/themes/:themeId",
    validate({ params: themeIdParam }),
    requireGuildPermission("MANAGE_GUILD"),
    asyncHandler(guildController.cancelTheme)
);

router.post(
    "/:guildId/suspend",
    validate({ params: guildIdParam, body: suspendGuildSchema }),
    requireGuildRole("owner", { allowSuspended: true }),
    asyncHandler(guildController.suspend)
);

router.post(
    "/:guildId/resume",
    validate({ params: guildIdParam }),
    requireGuildRole("owner", { allowSuspended: true }),
    asyncHandler(guildController.resume)
);

router.delete(
    "/:guildId",
    validate({ params: guildIdParam, body: deleteGuildSchema }),
    requireGuildRole("owner"),
    asyncHandler(guildController.remove)
);

router.get(
    "/:guildId/emojis",
    validate({ params: guildIdParam, query: listEmojiSchema }),
    requireGuildRole("member"),
    asyncHandler(guildController.listEmojis)
);

router.post(
    "/:guildId/emojis",
    uploadImage("image"),
    validate({ params: guildIdParam, body: createEmojiSchema }),
    requireGuildPermission("MANAGE_EMOJIS"),
    asyncHandler(guildController.createEmoji)
);

router.delete(
    "/:guildId/emojis/:emojiId",
    validate({ params: emojiIdParam }),
    requireGuildPermission("MANAGE_EMOJIS"),
    asyncHandler(guildController.removeEmoji)
);

router.get(
    "/:guildId/profile",
    validate({ params: guildIdParam }),
    requireGuildRole("member"),
    asyncHandler(presenceController.getGuildProfile)
);

router.put(
    "/:guildId/profile",
    validate({ params: guildIdParam, body: guildProfileSchema }),
    requireGuildRole("member"),
    asyncHandler(presenceController.setGuildProfile)
);

router.get(
    "/:guildId/export",
    validate({ params: guildIdParam }),
    requireGuildRole("owner"),
    asyncHandler(guildController.exportGuild)
);

router.put(
    "/:guildId/discovery",
    validate({ params: guildIdParam, body: discoverySettingsSchema }),
    requireGuildPermission("MANAGE_GUILD"),
    asyncHandler(guildController.setDiscovery)
);

module.exports = router;
