"use strict";

const { Router } = require("express");

const messageController = require("../controllers/messageController");
const mediaController = require("../controllers/mediaController");
const e2eeController = require("../controllers/e2eeController");
const searchController = require("../controllers/searchController");
const threadController = require("../controllers/threadController");
const reportController = require("../controllers/reportController");
const pollController = require("../controllers/pollController");
const eventController = require("../controllers/eventController");
const ticketController = require("../controllers/ticketController");
const taskController = require("../controllers/taskController");
const worktreeController = require("../controllers/worktreeController");
const collaborationController = require("../controllers/collaborationController");
const documentController = require("../controllers/documentController");
const attachmentController = require("../controllers/attachmentController");
const draftController = require("../controllers/draftController");
const webhookController = require("../controllers/webhookController");
const groupChannelController = require("../controllers/groupChannelController");
const channelContextController = require("../controllers/channelContextController");
const channelLifecycleService = require("../services/channelLifecycleService");
const channelAccessService = require("../services/channelAccessService");
const stageService = require("../services/stageService");
const authenticate = require("../middlewares/authenticate");
const validate = require("../middlewares/validate");
const { requireChannelAccess, requireChannelPermission } = require("../middlewares/authorize");
const { uploadAttachment } = require("../middlewares/upload");
const { asyncHandler } = require("../errors");
const {
    channelIdParam,
    updateChannelSchema,
    deleteChannelSchema,
    accessRequestSchema,
    accessDecisionSchema,
    stageSpeakerSchema,
    channelAccessUserParam,
    channelMessageParam,
    reactionRemoveParam,
    paginationSchema,
    postMessageSchema,
    editMessageSchema,
    reactionSchema,
    rotateEpochSchema,
    epochQuerySchema,
    encryptionSettingSchema,
    searchQuerySchema,
    openThreadSchema,
    updateThreadSchema,
    threadListSchema,
    openTopicSchema,
    createPollSchema,
    voteSchema,
    createEventSchema,
    updateEventSchema,
    eventResponseSchema,
    eventIdParam,
    openTicketSchema,
    updateTicketSchema,
    ticketReplySchema,
    ticketStatusSchema,
    ticketAssignSchema,
    ticketQuerySchema,
    ticketIdParam,
    createTaskSchema,
    updateTaskSchema,
    taskIdParam,
    createWorktreeSchema,
    worktreeIdParam,
    worktreeReviewParam,
    worktreeSessionParam,
    worktreeSnapshotSchema,
    worktreeReviewSchema,
    worktreeCommentSchema,
    worktreeReviewStatusSchema,
    worktreePipelineSchema,
    worktreeDecisionSchema,
    worktreeConsentSchema,
    worktreeCursorSchema,
    worktreeTerminalChunkSchema,
    worktreeTerminalQuerySchema,
    whiteboardStrokeSchema,
    transcriptSchema,
    summarySchema,
    createDocumentSchema,
    attachmentPathSchema,
    attachmentVersionsSchema,
    editDocumentSchema,
    restoreDocumentSchema,
    documentIdParam,
    documentRevisionParam,
    reportSchema,
    draftSchema,
    webhookIdParam,
    createWebhookSchema,
    groupParticipantParam,
} = require("../validators/schemas");

const requireChannelFeature = require("../middlewares/channelFeature");

const router = Router();

router.use(authenticate);

router.get(
    "/:channelId/access",
    validate({ params: channelIdParam }),
    asyncHandler(async (req, res) => res.json(await channelAccessService.overview(req.params.channelId, req.user)))
);
router.post(
    "/:channelId/access",
    validate({ params: channelIdParam, body: accessRequestSchema }),
    asyncHandler(async (req, res) =>
        res.json(await channelAccessService.request(req.params.channelId, req.user, req.body.reason))
    )
);
router.patch(
    "/:channelId/access/:userId",
    validate({ params: channelAccessUserParam, body: accessDecisionSchema }),
    asyncHandler(async (req, res) =>
        res.json(await channelAccessService.decide(req.params.channelId, req.user, req.params.userId, req.body.status))
    )
);
router.patch(
    "/:channelId",
    validate({ params: channelIdParam, body: updateChannelSchema }),
    requireChannelAccess,
    requireChannelPermission("MANAGE_CHANNELS"),
    asyncHandler(async (req, res) => res.json({ channel: await channelLifecycleService.update(req.channel, req.body) }))
);
router.delete(
    "/:channelId",
    validate({ params: channelIdParam, body: deleteChannelSchema }),
    requireChannelAccess,
    requireChannelPermission("MANAGE_CHANNELS"),
    asyncHandler(async (req, res) => res.json(await channelLifecycleService.remove(req.channel, req.body.confirm)))
);

router.get(
    "/:channelId/context",
    validate({ params: channelIdParam }),
    requireChannelAccess,
    asyncHandler(channelContextController.read)
);
router.patch(
    "/:channelId/speakers/:userId",
    validate({ params: channelAccessUserParam, body: stageSpeakerSchema }),
    requireChannelAccess,
    requireChannelPermission("MUTE_MEMBERS"),
    asyncHandler(async (req, res) =>
        res.json(await stageService.setSpeaker(req.channel, req.user, req.params.userId, req.body.speaking))
    )
);

router.post(
    "/:channelId/media-token",
    validate({ params: channelIdParam }),
    requireChannelAccess,
    requireChannelPermission("CONNECT"),
    asyncHandler(mediaController.createToken)
);

router.get(
    "/:channelId/participants",
    validate({ params: channelIdParam }),
    requireChannelAccess,
    asyncHandler(groupChannelController.participants)
);

router.put(
    "/:channelId/participants/:userId",
    validate({ params: groupParticipantParam }),
    requireChannelAccess,
    asyncHandler(groupChannelController.add)
);

router.delete(
    "/:channelId/participants/:userId",
    validate({ params: groupParticipantParam }),
    requireChannelAccess,
    asyncHandler(groupChannelController.remove)
);

router.get(
    "/:channelId/webhooks",
    validate({ params: channelIdParam }),
    requireChannelAccess,
    requireChannelPermission("MANAGE_WEBHOOKS"),
    asyncHandler(webhookController.list)
);

router.post(
    "/:channelId/webhooks",
    validate({ params: channelIdParam, body: createWebhookSchema }),
    requireChannelAccess,
    requireChannelPermission("MANAGE_WEBHOOKS"),
    asyncHandler(webhookController.create)
);

router.delete(
    "/:channelId/webhooks/:webhookId",
    validate({ params: webhookIdParam }),
    requireChannelAccess,
    requireChannelPermission("MANAGE_WEBHOOKS"),
    asyncHandler(webhookController.revoke)
);

router.put(
    "/:channelId/draft",
    validate({ params: channelIdParam, body: draftSchema }),
    requireChannelAccess,
    requireChannelPermission("SEND_MESSAGES"),
    asyncHandler(draftController.save)
);

router.get(
    "/:channelId/messages",
    validate({ params: channelIdParam, query: paginationSchema }),
    requireChannelAccess,
    requireChannelPermission("READ_MESSAGE_HISTORY"),
    asyncHandler(messageController.list)
);

router.post(
    "/:channelId/messages",
    validate({ params: channelIdParam, body: postMessageSchema }),
    requireChannelAccess,
    requireChannelPermission("SEND_MESSAGES"),
    asyncHandler(messageController.post)
);

router.patch(
    "/:channelId/messages/:messageId",
    validate({ params: channelMessageParam, body: editMessageSchema }),
    requireChannelAccess,
    requireChannelPermission("SEND_MESSAGES"),
    asyncHandler(messageController.edit)
);

router.delete(
    "/:channelId/messages/:messageId",
    validate({ params: channelMessageParam }),
    requireChannelAccess,
    asyncHandler(messageController.remove)
);

router.post(
    "/:channelId/messages/:messageId/reactions",
    validate({ params: channelMessageParam, body: reactionSchema }),
    requireChannelAccess,
    requireChannelPermission("ADD_REACTIONS"),
    asyncHandler(messageController.addReaction)
);

router.get(
    "/:channelId/messages/:messageId/reactions/:emoji",
    validate({ params: channelMessageParam }),
    requireChannelAccess,
    requireChannelPermission("READ_MESSAGE_HISTORY"),
    asyncHandler(messageController.reactionAuthors)
);

router.delete(
    "/:channelId/messages/:messageId/reactions/:emoji",
    validate({ params: reactionRemoveParam }),
    requireChannelAccess,
    requireChannelPermission("ADD_REACTIONS"),
    asyncHandler(messageController.removeReaction)
);

router.post(
    "/:channelId/messages/:messageId/report",
    validate({ params: channelMessageParam, body: reportSchema }),
    requireChannelAccess,
    requireChannelPermission("READ_MESSAGE_HISTORY"),
    asyncHandler(reportController.report)
);

router.get(
    "/:channelId/threads",
    validate({ params: channelIdParam, query: threadListSchema }),
    requireChannelAccess,
    requireChannelPermission("READ_MESSAGE_HISTORY"),
    asyncHandler(threadController.list)
);

router.post(
    "/:channelId/messages/:messageId/thread",
    validate({ params: channelMessageParam, body: openThreadSchema }),
    requireChannelAccess,
    requireChannelPermission("SEND_MESSAGES"),
    asyncHandler(threadController.open)
);

router.get(
    "/:channelId/threads/:messageId/messages",
    validate({ params: channelMessageParam }),
    requireChannelAccess,
    requireChannelPermission("READ_MESSAGE_HISTORY"),
    asyncHandler(threadController.messages)
);

router.post(
    "/:channelId/threads/:messageId/messages",
    validate({ params: channelMessageParam, body: postMessageSchema }),
    requireChannelAccess,
    requireChannelPermission("SEND_MESSAGES"),
    asyncHandler(threadController.reply)
);

router.put(
    "/:channelId/threads/:messageId/follow",
    validate({ params: channelMessageParam }),
    requireChannelAccess,
    requireChannelPermission("READ_MESSAGE_HISTORY"),
    asyncHandler(threadController.follow)
);

router.patch(
    "/:channelId/threads/:messageId",
    validate({ params: channelMessageParam, body: updateThreadSchema }),
    requireChannelAccess,
    requireChannelPermission("SEND_MESSAGES"),
    asyncHandler(threadController.update)
);

router.delete(
    "/:channelId/threads/:messageId/follow",
    validate({ params: channelMessageParam }),
    requireChannelAccess,
    requireChannelPermission("READ_MESSAGE_HISTORY"),
    asyncHandler(threadController.unfollow)
);

router.post(
    "/:channelId/topics",
    validate({ params: channelIdParam, body: openTopicSchema }),
    requireChannelAccess,
    requireChannelPermission("SEND_MESSAGES"),
    asyncHandler(threadController.openTopic)
);

router.post(
    "/:channelId/polls",
    validate({ params: channelIdParam, body: createPollSchema }),
    requireChannelAccess,
    requireChannelPermission("SEND_MESSAGES"),
    asyncHandler(pollController.create)
);

router.get(
    "/:channelId/polls/:messageId",
    validate({ params: channelMessageParam }),
    requireChannelAccess,
    requireChannelPermission("READ_MESSAGE_HISTORY"),
    asyncHandler(pollController.get)
);

router.put(
    "/:channelId/polls/:messageId/vote",
    validate({ params: channelMessageParam, body: voteSchema }),
    requireChannelAccess,
    requireChannelPermission("READ_MESSAGE_HISTORY"),
    asyncHandler(pollController.vote)
);

router.delete(
    "/:channelId/polls/:messageId",
    validate({ params: channelMessageParam }),
    requireChannelAccess,
    requireChannelPermission("READ_MESSAGE_HISTORY"),
    asyncHandler(pollController.close)
);

router.get(
    "/:channelId/events",
    validate({ params: channelIdParam }),
    requireChannelAccess,
    requireChannelFeature("events"),
    requireChannelPermission("READ_MESSAGE_HISTORY"),
    asyncHandler(eventController.list)
);

router.post(
    "/:channelId/events",
    validate({ params: channelIdParam, body: createEventSchema }),
    requireChannelAccess,
    requireChannelFeature("events"),
    requireChannelPermission("SEND_MESSAGES"),
    asyncHandler(eventController.create)
);

router.put(
    "/:channelId/events/:eventId/response",
    validate({ params: eventIdParam, body: eventResponseSchema }),
    requireChannelAccess,
    requireChannelFeature("events"),
    requireChannelPermission("READ_MESSAGE_HISTORY"),
    asyncHandler(eventController.respond)
);

router.patch(
    "/:channelId/events/:eventId",
    validate({ params: eventIdParam, body: updateEventSchema }),
    requireChannelAccess,
    requireChannelFeature("events"),
    requireChannelPermission("SEND_MESSAGES"),
    asyncHandler(eventController.update)
);

router.delete(
    "/:channelId/events/:eventId",
    validate({ params: eventIdParam }),
    requireChannelAccess,
    requireChannelFeature("events"),
    requireChannelPermission("SEND_MESSAGES"),
    asyncHandler(eventController.cancel)
);

router.post(
    "/:channelId/attachments",
    validate({ params: channelIdParam }),
    requireChannelAccess,
    requireChannelPermission("ATTACH_FILES"),
    uploadAttachment,
    validate({ body: attachmentPathSchema }),
    asyncHandler(attachmentController.upload)
);

router.get(
    "/:channelId/attachments",
    validate({ params: channelIdParam }),
    requireChannelAccess,
    requireChannelPermission("READ_MESSAGE_HISTORY"),
    asyncHandler(attachmentController.gallery)
);

router.get(
    "/:channelId/attachments/versions",
    validate({ params: channelIdParam, query: attachmentVersionsSchema }),
    requireChannelAccess,
    requireChannelPermission("READ_MESSAGE_HISTORY"),
    asyncHandler(attachmentController.versions)
);

router.get(
    "/:channelId/documents",
    validate({ params: channelIdParam }),
    requireChannelAccess,
    requireChannelFeature("documents"),
    requireChannelPermission("READ_MESSAGE_HISTORY"),
    asyncHandler(documentController.outline)
);

router.post(
    "/:channelId/documents",
    validate({ params: channelIdParam, body: createDocumentSchema }),
    requireChannelAccess,
    requireChannelFeature("documents"),
    requireChannelPermission("SEND_MESSAGES"),
    asyncHandler(documentController.create)
);

router.get(
    "/:channelId/documents/:documentId",
    validate({ params: documentIdParam }),
    requireChannelAccess,
    requireChannelFeature("documents"),
    requireChannelPermission("READ_MESSAGE_HISTORY"),
    asyncHandler(documentController.read)
);

router.patch(
    "/:channelId/documents/:documentId",
    validate({ params: documentIdParam, body: editDocumentSchema }),
    requireChannelAccess,
    requireChannelFeature("documents"),
    requireChannelPermission("SEND_MESSAGES"),
    asyncHandler(documentController.edit)
);

router.get(
    "/:channelId/documents/:documentId/history",
    validate({ params: documentIdParam }),
    requireChannelAccess,
    requireChannelFeature("documents"),
    requireChannelPermission("READ_MESSAGE_HISTORY"),
    asyncHandler(documentController.history)
);

router.post(
    "/:channelId/documents/:documentId/restore",
    validate({ params: documentIdParam, body: restoreDocumentSchema }),
    requireChannelAccess,
    requireChannelFeature("documents"),
    requireChannelPermission("SEND_MESSAGES"),
    asyncHandler(documentController.restore)
);

router.get(
    "/:channelId/documents/:documentId/history/:revisionId",
    validate({ params: documentRevisionParam }),
    requireChannelAccess,
    requireChannelFeature("documents"),
    requireChannelPermission("READ_MESSAGE_HISTORY"),
    asyncHandler(documentController.revision)
);

router.delete(
    "/:channelId/documents/:documentId",
    validate({ params: documentIdParam }),
    requireChannelAccess,
    requireChannelFeature("documents"),
    requireChannelPermission("MANAGE_CHANNELS"),
    asyncHandler(documentController.remove)
);

router.get(
    "/:channelId/tasks",
    validate({ params: channelIdParam }),
    requireChannelAccess,
    requireChannelFeature("tasks"),
    requireChannelPermission("READ_MESSAGE_HISTORY"),
    asyncHandler(taskController.board)
);

router.post(
    "/:channelId/tasks",
    validate({ params: channelIdParam, body: createTaskSchema }),
    requireChannelAccess,
    requireChannelFeature("tasks"),
    requireChannelPermission("SEND_MESSAGES"),
    asyncHandler(taskController.create)
);

router.patch(
    "/:channelId/tasks/:taskId",
    validate({ params: taskIdParam, body: updateTaskSchema }),
    requireChannelAccess,
    requireChannelFeature("tasks"),
    requireChannelPermission("SEND_MESSAGES"),
    asyncHandler(taskController.update)
);

router.delete(
    "/:channelId/tasks/:taskId",
    validate({ params: taskIdParam }),
    requireChannelAccess,
    requireChannelFeature("tasks"),
    requireChannelPermission("SEND_MESSAGES"),
    asyncHandler(taskController.remove)
);

router.get(
    "/:channelId/worktrees",
    validate({ params: channelIdParam }),
    requireChannelAccess,
    requireChannelFeature("worktrees"),
    requireChannelPermission("READ_MESSAGE_HISTORY"),
    asyncHandler(worktreeController.board)
);

router.post(
    "/:channelId/worktrees",
    validate({ params: channelIdParam, body: createWorktreeSchema }),
    requireChannelAccess,
    requireChannelFeature("worktrees"),
    requireChannelPermission("SEND_MESSAGES"),
    asyncHandler(worktreeController.create)
);

router.post(
    "/:channelId/worktrees/:worktreeId/join",
    validate({ params: worktreeIdParam }),
    requireChannelAccess,
    requireChannelFeature("worktrees"),
    requireChannelPermission("SEND_MESSAGES"),
    asyncHandler(worktreeController.join)
);

router.put(
    "/:channelId/worktrees/:worktreeId/snapshot",
    validate({ params: worktreeIdParam, body: worktreeSnapshotSchema }),
    requireChannelAccess,
    requireChannelFeature("worktrees"),
    requireChannelPermission("SEND_MESSAGES"),
    asyncHandler(worktreeController.snapshot)
);

router.post(
    "/:channelId/worktrees/:worktreeId/reviews",
    validate({ params: worktreeIdParam, body: worktreeReviewSchema }),
    requireChannelAccess,
    requireChannelFeature("worktrees"),
    requireChannelPermission("SEND_MESSAGES"),
    asyncHandler(worktreeController.openReview)
);

router.get(
    "/:channelId/worktrees/:worktreeId/reviews/:reviewId/comments",
    validate({ params: worktreeReviewParam }),
    requireChannelAccess,
    requireChannelFeature("worktrees"),
    requireChannelPermission("READ_MESSAGE_HISTORY"),
    asyncHandler(worktreeController.comments)
);

router.post(
    "/:channelId/worktrees/:worktreeId/reviews/:reviewId/comments",
    validate({ params: worktreeReviewParam, body: worktreeCommentSchema }),
    requireChannelAccess,
    requireChannelFeature("worktrees"),
    requireChannelPermission("SEND_MESSAGES"),
    asyncHandler(worktreeController.comment)
);

router.patch(
    "/:channelId/worktrees/:worktreeId/reviews/:reviewId",
    validate({ params: worktreeReviewParam, body: worktreeReviewStatusSchema }),
    requireChannelAccess,
    requireChannelFeature("worktrees"),
    requireChannelPermission("SEND_MESSAGES"),
    asyncHandler(worktreeController.reviewStatus)
);

router.post(
    "/:channelId/worktrees/:worktreeId/pipelines",
    validate({ params: worktreeIdParam, body: worktreePipelineSchema }),
    requireChannelAccess,
    requireChannelFeature("worktrees"),
    requireChannelPermission("SEND_MESSAGES"),
    asyncHandler(worktreeController.pipeline)
);

router.post(
    "/:channelId/worktrees/:worktreeId/decisions",
    validate({ params: worktreeIdParam, body: worktreeDecisionSchema }),
    requireChannelAccess,
    requireChannelFeature("worktrees"),
    requireChannelPermission("SEND_MESSAGES"),
    asyncHandler(worktreeController.decide)
);

router.put(
    "/:channelId/worktrees/:worktreeId/consent",
    validate({ params: worktreeIdParam, body: worktreeConsentSchema }),
    requireChannelAccess,
    requireChannelFeature("worktrees"),
    requireChannelPermission("SEND_MESSAGES"),
    asyncHandler(worktreeController.consent)
);

router.post(
    "/:channelId/worktrees/:worktreeId/terminal",
    validate({ params: worktreeIdParam }),
    requireChannelAccess,
    requireChannelFeature("worktrees"),
    requireChannelPermission("SEND_MESSAGES"),
    asyncHandler(worktreeController.openTerminal)
);

router.post(
    "/:channelId/worktrees/:worktreeId/terminal/:sessionId",
    validate({ params: worktreeSessionParam, body: worktreeTerminalChunkSchema }),
    requireChannelAccess,
    requireChannelFeature("worktrees"),
    requireChannelPermission("SEND_MESSAGES"),
    asyncHandler(worktreeController.writeTerminal)
);

router.get(
    "/:channelId/worktrees/:worktreeId/terminal/:sessionId",
    validate({ params: worktreeSessionParam, query: worktreeTerminalQuerySchema }),
    requireChannelAccess,
    requireChannelFeature("worktrees"),
    requireChannelPermission("READ_MESSAGE_HISTORY"),
    asyncHandler(worktreeController.terminalLog)
);

router.delete(
    "/:channelId/worktrees/:worktreeId/terminal/:sessionId",
    validate({ params: worktreeSessionParam }),
    requireChannelAccess,
    requireChannelFeature("worktrees"),
    requireChannelPermission("SEND_MESSAGES"),
    asyncHandler(worktreeController.closeTerminal)
);

router.put(
    "/:channelId/worktrees/:worktreeId/cursor",
    validate({ params: worktreeIdParam, body: worktreeCursorSchema }),
    requireChannelAccess,
    requireChannelFeature("worktrees"),
    requireChannelPermission("SEND_MESSAGES"),
    asyncHandler(worktreeController.cursor)
);

router.get(
    "/:channelId/whiteboard",
    validate({ params: channelIdParam }),
    requireChannelAccess,
    requireChannelPermission("READ_MESSAGE_HISTORY"),
    asyncHandler(collaborationController.whiteboard)
);

router.post(
    "/:channelId/whiteboard",
    validate({ params: channelIdParam, body: whiteboardStrokeSchema }),
    requireChannelAccess,
    requireChannelPermission("SEND_MESSAGES"),
    asyncHandler(collaborationController.stroke)
);

router.delete(
    "/:channelId/whiteboard",
    validate({ params: channelIdParam }),
    requireChannelAccess,
    requireChannelPermission("MANAGE_CHANNELS"),
    asyncHandler(collaborationController.clearBoard)
);

router.post(
    "/:channelId/transcripts",
    validate({ params: channelIdParam, body: transcriptSchema }),
    requireChannelAccess,
    requireChannelPermission("SEND_MESSAGES"),
    asyncHandler(collaborationController.transcript)
);

router.get(
    "/:channelId/transcripts",
    validate({ params: channelIdParam }),
    requireChannelAccess,
    requireChannelPermission("READ_MESSAGE_HISTORY"),
    asyncHandler(collaborationController.listTranscripts)
);

router.post(
    "/:channelId/summary",
    validate({ params: channelIdParam, body: summarySchema }),
    requireChannelAccess,
    requireChannelPermission("READ_MESSAGE_HISTORY"),
    asyncHandler(collaborationController.summarize)
);

router.get(
    "/:channelId/summaries",
    validate({ params: channelIdParam }),
    requireChannelAccess,
    requireChannelPermission("READ_MESSAGE_HISTORY"),
    asyncHandler(collaborationController.listSummaries)
);

router.get(
    "/:channelId/tickets",
    validate({ params: channelIdParam, query: ticketQuerySchema }),
    requireChannelAccess,
    requireChannelFeature("tickets"),
    requireChannelPermission("READ_MESSAGE_HISTORY"),
    asyncHandler(ticketController.list)
);

router.post(
    "/:channelId/tickets",
    validate({ params: channelIdParam, body: openTicketSchema }),
    requireChannelAccess,
    requireChannelFeature("tickets"),
    requireChannelPermission("READ_MESSAGE_HISTORY"),
    asyncHandler(ticketController.open)
);

router.get(
    "/:channelId/tickets/:ticketId",
    validate({ params: ticketIdParam }),
    requireChannelAccess,
    requireChannelFeature("tickets"),
    requireChannelPermission("READ_MESSAGE_HISTORY"),
    asyncHandler(ticketController.thread)
);

router.get(
    "/:channelId/ticket-assignees",
    validate({ params: channelIdParam }),
    requireChannelAccess,
    requireChannelPermission("READ_MESSAGE_HISTORY"),
    asyncHandler(ticketController.assignees)
);
router.patch(
    "/:channelId/tickets/:ticketId",
    validate({ params: ticketIdParam, body: updateTicketSchema }),
    requireChannelAccess,
    requireChannelPermission("READ_MESSAGE_HISTORY"),
    asyncHandler(ticketController.updateDetails)
);

router.post(
    "/:channelId/tickets/:ticketId/messages",
    validate({ params: ticketIdParam, body: ticketReplySchema }),
    requireChannelAccess,
    requireChannelFeature("tickets"),
    requireChannelPermission("READ_MESSAGE_HISTORY"),
    asyncHandler(ticketController.reply)
);

router.patch(
    "/:channelId/tickets/:ticketId/status",
    validate({ params: ticketIdParam, body: ticketStatusSchema }),
    requireChannelAccess,
    requireChannelFeature("tickets"),
    requireChannelPermission("READ_MESSAGE_HISTORY"),
    asyncHandler(ticketController.setStatus)
);

router.put(
    "/:channelId/tickets/:ticketId/assignee",
    validate({ params: ticketIdParam, body: ticketAssignSchema }),
    requireChannelAccess,
    requireChannelFeature("tickets"),
    requireChannelPermission("READ_MESSAGE_HISTORY"),
    asyncHandler(ticketController.assign)
);

router.get(
    "/:channelId/search",
    validate({ params: channelIdParam, query: searchQuerySchema }),
    requireChannelAccess,
    requireChannelPermission("READ_MESSAGE_HISTORY"),
    asyncHandler(searchController.searchChannel)
);

router.get(
    "/:channelId/pins",
    validate({ params: channelIdParam }),
    requireChannelAccess,
    requireChannelPermission("READ_MESSAGE_HISTORY"),
    asyncHandler(searchController.listPins)
);

router.put(
    "/:channelId/messages/:messageId/pin",
    validate({ params: channelMessageParam }),
    requireChannelAccess,
    requireChannelPermission("MANAGE_MESSAGES"),
    asyncHandler(searchController.pin)
);

router.delete(
    "/:channelId/messages/:messageId/pin",
    validate({ params: channelMessageParam }),
    requireChannelAccess,
    requireChannelPermission("MANAGE_MESSAGES"),
    asyncHandler(searchController.unpin)
);

router.get(
    "/:channelId/e2ee/recipients",
    validate({ params: channelIdParam }),
    requireChannelAccess,
    requireChannelPermission("VIEW_CHANNEL"),
    asyncHandler(e2eeController.listRecipients)
);

router.get(
    "/:channelId/e2ee/epoch",
    validate({ params: channelIdParam, query: epochQuerySchema }),
    requireChannelAccess,
    requireChannelPermission("READ_MESSAGE_HISTORY"),
    asyncHandler(e2eeController.getEpoch)
);

router.post(
    "/:channelId/e2ee/epoch",
    validate({ params: channelIdParam, body: rotateEpochSchema }),
    requireChannelAccess,
    requireChannelPermission("SEND_MESSAGES"),
    asyncHandler(e2eeController.rotateEpoch)
);

router.patch(
    "/:channelId/e2ee",
    validate({ params: channelIdParam, body: encryptionSettingSchema }),
    requireChannelAccess,
    requireChannelPermission("MANAGE_CHANNELS"),
    asyncHandler(e2eeController.setEncryption)
);

module.exports = router;
