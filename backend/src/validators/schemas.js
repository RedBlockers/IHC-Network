"use strict";

const { z } = require("zod");
const { PERMISSIONS } = require("../domain/permissions");
const { TYPES: CHANNEL_TYPES } = require("../domain/channelModes");
const { TEMPLATE_IDS } = require("../domain/roleTemplates");

const handle = z
    .string()
    .trim()
    .min(3, "Le pseudo doit comporter au moins 3 caractères.")
    .max(20, "Le pseudo ne peut pas dépasser 20 caractères.")
    .regex(/^[a-zA-Z0-9._-]+$/, "Le pseudo ne peut contenir que lettres, chiffres, point, tiret et souligné.");

const password = z
    .string()
    .min(15, "Le mot de passe doit comporter au moins 15 caractères.")
    .max(200, "Le mot de passe ne peut pas dépasser 200 caractères.");

const idParam = z.coerce.number().int().positive();

const registerSchema = z.object({
    handle,
    email: z.string().trim().toLowerCase().email("L'adresse email est invalide.").max(254),
    password,
    displayName: z.string().trim().min(1, "Le nom d'affichage est requis.").max(32).optional(),
    bio: z.string().trim().max(200, "La bio ne peut pas dépasser 200 caractères.").default(""),
});

const loginSchema = z.object({
    handle: z.string().trim().min(3, "Identifiant requis.").max(254),
    password: z.string().min(1, "Le mot de passe est requis.").max(200),
    code: z
        .string()
        .trim()
        .regex(/^\d{6}$/, "Code à 6 chiffres.")
        .optional(),
    recoveryCode: z.string().trim().min(4).max(32).optional(),
});

const totpConfirmSchema = z.object({
    code: z
        .string()
        .trim()
        .regex(/^\d{6}$/, "Code à 6 chiffres."),
});
const totpDisableSchema = z.object({ password: z.string().min(1).max(200) });

const changePasswordSchema = z
    .object({
        currentPassword: z.string().min(1, "Le mot de passe actuel est requis.").max(200),
        newPassword: password,
    })
    .refine((data) => data.currentPassword !== data.newPassword, {
        message: "Le nouveau mot de passe doit être différent de l'actuel.",
        path: ["newPassword"],
    });

const emailTokenSchema = z.object({ token: z.string().trim().min(16).max(128) });
const requestResetSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });
const resetPasswordSchema = z.object({
    token: z.string().trim().min(16).max(128),
    newPassword: password,
});

const sessionIdParam = z.object({ sessionId: z.string().uuid("Appareil inconnu.") });
const loginHistorySchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(30) });

const availabilitySchema = z
    .object({ handle: handle.optional() })
    .refine((data) => data.handle !== undefined, { message: "Le paramètre 'handle' est requis." });

const userSearchSchema = z.object({
    q: z
        .string()
        .trim()
        .min(2, "Saisissez au moins 2 caractères.")
        .max(20)
        .regex(/^[a-zA-Z0-9._-]+$/, "Recherche invalide."),
});

const bannerPreset = z.enum(["nebula", "dawn", "ocean", "ember", "forest", "mono", "aurora"]);
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide (format #RRGGBB).");
const formBoolean = z.preprocess((value) => {
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
}, z.boolean());

const updateProfileSchema = z
    .object({
        handle: handle.optional(),
        displayName: z.string().trim().min(1).max(32).optional(),
        aboutMe: z.string().trim().max(200).optional(),
        activityText: z.string().trim().max(80).optional(),
        statusPreference: z.enum(["online", "idle", "dnd", "invisible"]).optional(),
        removeAvatar: formBoolean.optional(),
        removeBannerImage: formBoolean.optional(),
        avatarDecoration: z.string().trim().max(24).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, { message: "Aucune modification fournie." });

const updatePreferencesSchema = z
    .object({
        theme: z.enum(["dark", "light", "oled", "contrast", "midnight"]).optional(),
        density: z.enum(["comfortable", "compact"]).optional(),
        accent: hexColor.nullable().optional(),
        reduceMotion: z.boolean().optional(),
        highContrast: z.boolean().optional(),
        hideBanners: z.boolean().optional(),
        neutralizeCommunityThemes: z.boolean().optional(),
        bannerBehaviour: z.enum(["auto", "fixed", "compact"]).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, { message: "Aucune préférence fournie." });

const createGuildSchema = z.object({
    name: z.string().trim().min(3, "Le nom de la guilde doit comporter au moins 3 caractères.").max(50),
    description: z.string().trim().max(200).default(""),
    banner: bannerPreset.default("nebula"),
    accent: hexColor.optional(),
});

const updateGuildSchema = z
    .object({
        name: z.string().trim().min(3).max(50).optional(),
        description: z.string().trim().max(200).optional(),
        banner: bannerPreset.optional(),
        accent: hexColor.nullable().optional(),
        removeIcon: formBoolean.optional(),
        removeBannerImage: formBoolean.optional(),
        bannerFocusX: z.coerce.number().int().min(0).max(100).optional(),
        bannerFocusY: z.coerce.number().int().min(0).max(100).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, { message: "Aucune modification fournie." });

const createChannelSchema = z.object({
    type: z.enum(CHANNEL_TYPES).default("text"),
    name: z.string().trim().min(1, "Le nom du salon est requis.").max(50),
    description: z.string().trim().max(200).default(""),
    categoryId: z.coerce.number().int().positive().nullable().optional(),
    customModeId: idParam.nullable().optional(),
    expiresInHours: z.coerce.number().int().min(1).max(8760).default(24),
});

const updateChannelSchema = z
    .object({
        name: z.string().trim().min(1).max(50).optional(),
        description: z.string().trim().max(200).optional(),
        expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, { message: "Aucune modification fournie." });
const deleteChannelSchema = z.object({ confirm: z.string().trim().min(1).max(50) });
const accessRequestSchema = z.object({ reason: z.string().trim().max(1000).default("") });
const accessDecisionSchema = z.object({ status: z.enum(["approved", "declined"]) });
const stageSpeakerSchema = z.object({ speaking: z.boolean() });
const channelAccessUserParam = z.object({ channelId: idParam, userId: idParam });

const createCategorySchema = z.object({
    name: z.string().trim().min(1, "Le nom de la catégorie est requis.").max(40),
});

const updateCategorySchema = z
    .object({
        name: z.string().trim().min(1).max(40).optional(),
        position: z.coerce.number().int().min(0).max(999).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, { message: "Aucune modification fournie." });

const pushSubscribeSchema = z.object({
    subscription: z.object({
        endpoint: z.string().url().max(2000),
        keys: z.object({ p256dh: z.string().min(1).max(255), auth: z.string().min(1).max(255) }),
    }),
    deviceLabel: z.string().trim().max(120).optional(),
});
const pushUnsubscribeSchema = z.object({ endpoint: z.string().url().max(2000) });

const credentialParam = z.object({ credentialId: z.string().min(16).max(400) });
const securityKeyRegisterSchema = z.object({
    challenge: z.string().min(16).max(255),
    label: z.string().trim().min(1).max(60),
    credential: z.object({ id: z.string().min(1) }).passthrough(),
});
const securityKeyLoginSchema = z.object({
    challenge: z.string().min(16).max(255),
    credential: z.object({ id: z.string().min(1) }).passthrough(),
});
const securityKeyRenameSchema = z.object({ label: z.string().trim().min(1).max(60) });

const transferGuildSchema = z.object({ userId: idParam, confirm: z.string().min(1).max(50) });
const lever = z.boolean().nullable().optional();
const modeIdParam = z.object({ guildId: idParam, modeId: idParam });
const channelModeSchema = z.object({
    name: z.string().trim().min(2).max(40),
    baseType: z.string().min(2).max(32),
    icon: z.string().trim().max(24).optional(),
    acceptsMessages: lever,
    requiresThread: lever,
    requiresPoll: lever,
    requiresAttachment: lever,
    pinnedFirst: lever,
    refusal: z.string().trim().max(200).nullable().optional(),
});

const themeIdParam = z.object({ guildId: idParam, themeId: idParam });
const publishThemeSchema = z.object({
    tokens: z
        .object({
            accent: z
                .string()
                .regex(/^#[0-9a-fA-F]{6}$/)
                .optional(),
            accent2: z
                .string()
                .regex(/^#[0-9a-fA-F]{6}$/)
                .optional(),
            surfaceTint: z.number().min(0).max(8).optional(),
            radiusDelta: z.number().int().min(-6).max(6).optional(),
        })
        .strict(),
    label: z.string().trim().max(60).optional(),
    scheduledFor: z.string().datetime().nullable().optional(),
});

const suspendGuildSchema = z.object({ reason: z.string().trim().min(10).max(300) });
const deleteGuildSchema = z.object({ confirm: z.string().min(1).max(50) });

const deleteAccountSchema = z.object({ password: z.string().min(1).max(200) });
const acceptPolicySchema = z.object({ version: z.string().trim().min(1).max(20) });

const linkPreviewSchema = z.object({ url: z.string().trim().min(8).max(2000) });

const activitySchema = z.object({
    kind: z.enum(["playing", "listening", "editing", "reviewing", "meeting", "custom"]),
    name: z.string().trim().min(1, "Indiquez ce que vous faites.").max(80),
    detail: z.string().trim().max(120).optional(),
    context: z.string().trim().max(160).optional(),
    minutes: z.coerce.number().int().min(1).max(720).optional(),
});
const visibilitySchema = z.object({
    presence: z.enum(["everyone", "friends", "nobody"]),
    activity: z.enum(["everyone", "friends", "nobody"]),
});
const guildProfileSchema = z.object({
    displayName: z.string().trim().max(32).optional(),
    aboutMe: z.string().trim().max(200).optional(),
});

const folderIdParam = z.object({ folderId: idParam });
const createFolderSchema = z.object({
    name: z.string().trim().min(1, "Le nom du dossier est requis.").max(40),
    color: hexColor.nullable().default(null),
});
const updateFolderSchema = z
    .object({ name: z.string().trim().min(1).max(40).optional(), color: hexColor.nullable().optional() })
    .refine((data) => Object.keys(data).length > 0, { message: "Aucune modification fournie." });
const placeGuildSchema = z
    .object({
        folderId: idParam.nullable().optional(),
        isFavorite: z.boolean().optional(),
        position: z.coerce.number().int().min(0).max(999).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, { message: "Aucune modification fournie." });
const channelFavoriteSchema = z.object({ isFavorite: z.boolean() });
const displayPrefsSchema = z.object({ hideReadChannels: z.boolean() });

const friendGroupParam = z.object({ groupId: idParam });
const friendGroupMemberParam = z.object({ groupId: idParam, userId: idParam });
const friendGroupSchema = z.object({ name: z.string().trim().min(1, "Le nom du groupe est requis.").max(40) });
const friendGroupMemberSchema = z.object({ inGroup: z.boolean() });

const discoverSchema = z.object({
    q: z.string().trim().max(60).default(""),
    limit: z.coerce.number().int().min(1).max(50).default(24),
});
const discoverySettingsSchema = z.object({
    isDiscoverable: z.boolean(),
    pitch: z.string().trim().max(280).nullable().optional(),
    tags: z.string().trim().max(200).nullable().optional(),
});

const emojiIdParam = z.object({ guildId: idParam, emojiId: idParam });
const mediaKind = z.enum(["emoji", "sticker", "gif", "sound"]);
const createEmojiSchema = z.object({
    name: z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9_]{2,32}$/, "2 à 32 caractères : minuscules, chiffres, souligné."),
    kind: mediaKind.default("emoji"),
});
const listEmojiSchema = z.object({ kind: mediaKind.optional() });

const inviteIdParam = z.object({ guildId: idParam, inviteId: idParam });
const reorderCategoriesSchema = z.object({ order: z.array(idParam).min(1).max(200) });
const reorderChannelsSchema = z.object({
    categoryId: idParam.nullable().default(null),
    order: z.array(idParam).max(500),
});

const createInviteSchema = z.object({
    maxUses: z.coerce.number().int().min(1).max(1000).nullable().default(null),
    expiresInHours: z.coerce.number().int().min(1).max(720).nullable().default(null),
});

const messageId = z.string().regex(/^\d{1,20}$/, "Identifiant de message invalide.");

const ENVELOPE = /^QW1:[0-9]{1,9}:[A-Za-z0-9+/]+={0,2}:[A-Za-z0-9+/]+={0,2}$/;
const CLEAR_MAX = 2000;
const ENVELOPE_MAX = 3400;

const messageContent = z
    .string()
    .trim()
    .min(1, "Le message ne peut pas être vide.")
    .max(ENVELOPE_MAX)
    .refine((value) => (ENVELOPE.test(value) ? true : value.length <= CLEAR_MAX), {
        message: "Le message ne peut pas dépasser 2000 caractères.",
    });

const postMessageSchema = z.object({
    content: messageContent,
    replyToId: messageId.optional(),
    attachmentIds: z.array(idParam).max(10).default([]),
    clientNonce: z.string().uuid("Marque d'envoi invalide.").optional(),
});

const createGroupSchema = z.object({
    name: z.string().trim().max(50).optional(),
    userIds: z.array(idParam).min(2, "Un groupe réunit au moins trois personnes.").max(9),
});
const groupParticipantParam = z.object({ channelId: idParam, userId: idParam });

const webhookIdParam = z.object({ channelId: idParam, webhookId: idParam });
const webhookTokenParam = z.object({ token: z.string().min(20).max(120) });
const createWebhookSchema = z.object({ name: z.string().trim().min(1, "Nommez ce webhook.").max(50) });
const webhookPostSchema = z.object({
    content: z.string().trim().min(1, "Le message ne peut pas être vide.").max(2000),
    name: z.string().trim().max(50).optional(),
});

const draftSchema = z.object({ content: z.string().max(3400).default("") });

const attachmentPathSchema = z.object({ path: z.string().max(512).default("") });
const attachmentVersionsSchema = z.object({ name: z.string().trim().min(1).max(255) });

const editMessageSchema = z.object({
    content: messageContent,
});

const reactionSchema = z.object({
    emoji: z.string().min(1, "Emoji requis.").max(32),
});

const paginationSchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    before: z
        .string()
        .regex(/^\d{1,20}$/, "Curseur invalide.")
        .optional(),
});

const channelIdParam = z.object({ channelId: idParam });
const channelMessageParam = z.object({ channelId: idParam, messageId });
const reactionRemoveParam = z.object({ channelId: idParam, messageId, emoji: z.string().min(1).max(32) });
const guildIdParam = z.object({ guildId: idParam });
const friendshipIdParam = z.object({ friendshipId: idParam });
const userIdParam = z.object({ userId: idParam });
const inviteCodeParam = z.object({ code: z.string().trim().length(22) });
const friendHandleParam = z.object({ handle });
const roleTemplateParam = z.object({ guildId: idParam, templateId: z.enum(TEMPLATE_IDS) });
const applyTemplateSchema = z.object({
    name: z.string().trim().min(1).max(50).optional(),
    color: hexColor.optional(),
});

const memberDirectorySchema = z.object({
    search: z.string().trim().max(60).default(""),
    roleId: z.coerce.number().int().positive().optional(),
    sort: z.enum(["joined", "oldest", "name"]).default("joined"),
    limit: z.coerce.number().int().min(1).max(100).default(40),
    page: z.coerce.number().int().min(0).max(500).default(0),
});

const notificationFilter = z.enum(["all", "mentions", "threads"]).default("all");
const notificationListSchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(30),
    filter: notificationFilter,
    before: z.string().regex(/^\d+$/, "Curseur invalide.").optional(),
});
const notificationFilterSchema = z.object({ filter: notificationFilter });
const notificationIdParam = z.object({ notificationId: idParam });
const rolePermissionRules = z.partialRecord(z.enum(PERMISSIONS), z.enum(["allow", "deny", "inherit"]));
const roleShape = {
    name: z.string().trim().min(1, "Le nom du rôle est requis.").max(50),
    iconEmoji: z.string().trim().max(32).nullable().optional(),
    color: hexColor.default("#8895A5"),
    position: z.coerce.number().int().min(1).max(999).optional(),
    mentionable: z.boolean().default(false),
    permissions: rolePermissionRules.optional(),
};
const createRoleSchema = z.object(roleShape);
const updateRoleSchema = z
    .object({
        ...roleShape,
        name: roleShape.name.optional(),
        color: roleShape.color.optional(),
        mentionable: roleShape.mentionable.optional(),
    })
    .refine((data) => Object.keys(data).length > 0, { message: "Aucune modification fournie." });
const roleIdParam = z.object({ guildId: idParam, roleId: idParam });
const memberRoleParam = z.object({ guildId: idParam, userId: idParam, roleId: idParam });
const channelPermissionParam = z.object({ guildId: idParam, channelId: idParam });
const channelPermissionTargetParam = z.object({
    guildId: idParam,
    channelId: idParam,
    targetType: z.enum(["role", "member"]),
    targetId: idParam,
});
const channelPermissionSchema = z.object({ permissions: rolePermissionRules });
const explainPermissionSchema = z.object({
    userId: idParam,
    permissions: z.string().trim().max(600).optional(),
});
const reorderRolesSchema = z.object({
    order: z.array(idParam).min(1).max(200),
});

const base64Key = z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, "Matériel de clé invalide.")
    .max(512);

const base64Kem = z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, "Matériel de clé invalide.")
    .max(2048);

const registerDeviceSchema = z.object({
    publicKey: base64Key,
    kemPublicKey: base64Kem,
    label: z.string().trim().max(60).default(""),
});

const rotateEpochSchema = z.object({
    deviceId: idParam,
    ephemeralPublicKey: base64Key,
    shares: z
        .array(z.object({ deviceId: idParam, wrappedKey: base64Key, kemCipherText: base64Kem }))
        .min(1, "Une distribution de clé ne peut pas être vide.")
        .max(500),
});

const epochQuerySchema = z.object({ deviceId: idParam });
const encryptionSettingSchema = z.object({ enabled: z.boolean() });
const deviceIdParam = z.object({ deviceId: idParam });
const categoryIdParam = z.object({ guildId: idParam, categoryId: idParam });

const reason = z.string().trim().min(3, "Le motif doit être explicite.").max(500);

const sanctionSchema = z
    .object({
        type: z.enum(["kick", "ban", "timeout"]),
        reason,
        durationMinutes: z.coerce
            .number()
            .int()
            .min(1)
            .max(60 * 24 * 28)
            .nullable()
            .optional(),
    })
    .refine((data) => data.type !== "timeout" || data.durationMinutes != null, {
        message: "Un timeout exige une durée.",
        path: ["durationMinutes"],
    });

const revokeSanctionSchema = z.object({ reason });
const appealSchema = z.object({ text: z.string().trim().min(3).max(1000) });
const moderationNoteSchema = z.object({ body: z.string().trim().min(1).max(1000) });
const auditQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(200).default(50),
    action: z.string().trim().max(60).optional(),
});
const openTopicSchema = z.object({
    title: z.string().trim().min(1, "Un sujet a besoin d'un titre.").max(100),
    content: messageContent,
});

const createPollSchema = z.object({
    question: z.string().trim().min(1, "Un sondage a besoin d'une question.").max(300),
    options: z.array(z.string().trim().min(1).max(120)).min(2, "Au moins deux réponses.").max(10),
    anonymous: z.boolean().default(true),
    closesInHours: z.coerce.number().int().min(1).max(720).nullable().default(null),
});

const voteSchema = z.object({ optionId: idParam });

const createEventSchema = z.object({
    title: z.string().trim().min(1, "Un événement a besoin d'un titre.").max(120),
    description: z.string().trim().max(2000).default(""),
    location: z.string().trim().max(160).default(""),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }).nullable().default(null),
});

const updateEventSchema = z
    .object({
        title: z.string().trim().min(1).max(120).optional(),
        description: z.string().trim().max(2000).optional(),
        location: z.string().trim().max(160).optional(),
        startsAt: z.string().datetime({ offset: true }).optional(),
        endsAt: z.string().datetime({ offset: true }).nullable().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, { message: "Aucune modification fournie." });

const eventResponseSchema = z.object({ response: z.enum(["going", "maybe", "no"]) });
const eventIdParam = z.object({ channelId: idParam, eventId: idParam });

const openTicketSchema = z.object({
    title: z.string().trim().min(1, "Un ticket a besoin d'un objet.").max(140),
    body: z.string().trim().min(1, "Décrivez votre demande.").max(3400),
    priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
});
const updateTicketSchema = z.object({ priority: z.enum(["low", "normal", "high", "urgent"]) });

const ticketReplySchema = z.object({
    body: z.string().trim().min(1).max(3400),
    internal: z.boolean().default(false),
});

const ticketStatusSchema = z.object({ status: z.enum(["open", "pending", "resolved", "closed"]) });
const ticketAssignSchema = z.object({ assigneeId: idParam.nullable().default(null) });
const ticketQuerySchema = z.object({
    status: z.enum(["open", "pending", "resolved", "closed"]).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    page: z.coerce.number().int().min(0).max(10000).default(0),
    search: z.string().trim().max(100).default(""),
});
const ticketIdParam = z.object({ channelId: idParam, ticketId: idParam });

const createTaskSchema = z.object({
    title: z.string().trim().min(1, "Une tâche a besoin d'un intitulé.").max(160),
    details: z.string().trim().max(2000).default(""),
    assigneeId: idParam.nullable().default(null),
    dueAt: z.string().datetime({ offset: true }).nullable().default(null),
});

const updateTaskSchema = z
    .object({
        title: z.string().trim().min(1).max(160).optional(),
        details: z.string().trim().max(2000).optional(),
        status: z.enum(["todo", "doing", "done"]).optional(),
        assigneeId: idParam.nullable().optional(),
        dueAt: z.string().datetime({ offset: true }).nullable().optional(),
        position: z.coerce.number().int().min(0).max(9999).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, { message: "Aucune modification fournie." });

const taskIdParam = z.object({ channelId: idParam, taskId: idParam });

const createWorktreeSchema = z.object({
    name: z.string().trim().min(1, "Un worktree a besoin d'un nom.").max(80),
    baseBranch: z.string().trim().min(1).max(120).default("main"),
    headBranch: z.string().trim().min(1).max(120).optional(),
});

const worktreeIdParam = z.object({ channelId: idParam, worktreeId: idParam });
const worktreeReviewParam = z.object({ channelId: idParam, worktreeId: idParam, reviewId: idParam });
const worktreeSessionParam = z.object({ channelId: idParam, worktreeId: idParam, sessionId: idParam });

const worktreeSnapshotSchema = z.object({
    headBranch: z.string().trim().min(1).max(120).optional(),
    baseBranch: z.string().trim().min(1).max(120).optional(),
    headSha: z.string().trim().min(7).max(40).optional(),
    files: z
        .array(
            z.object({
                path: z.string().trim().min(1).max(500),
                status: z.enum(["clean", "modified", "added", "deleted"]),
                language: z.string().trim().max(40).optional(),
                patch: z.string().max(200_000).nullable().optional(),
            })
        )
        .max(200)
        .default([]),
    commits: z
        .array(
            z.object({
                sha: z.string().trim().min(7).max(40),
                subject: z.string().trim().min(1).max(200),
                authorHandle: z.string().trim().max(32).optional(),
                committedAt: z.string().datetime({ offset: true }).optional(),
            })
        )
        .max(50)
        .default([]),
});

const worktreeReviewSchema = z.object({
    title: z.string().trim().min(1, "Une revue a besoin d'un titre.").max(160),
    baseSha: z.string().trim().min(7).max(40).optional(),
    headSha: z.string().trim().min(7).max(40).optional(),
});

const worktreeCommentSchema = z.object({
    path: z.string().trim().min(1).max(500),
    lineStart: z.coerce.number().int().min(1).max(100_000),
    lineEnd: z.coerce.number().int().min(1).max(100_000).optional(),
    body: z.string().trim().min(1).max(2000),
});

const worktreeReviewStatusSchema = z.object({
    status: z.enum(["open", "approved", "merged", "closed"]),
});

const worktreePipelineSchema = z.object({
    name: z.string().trim().min(1).max(80),
    status: z.enum(["queued", "running", "passed", "failed"]),
    logExcerpt: z.string().max(2000).default(""),
});

const worktreeDecisionSchema = z.object({
    title: z.string().trim().min(1).max(160),
    body: z.string().trim().min(1).max(4000),
});

const worktreeConsentSchema = z.object({ consent: z.boolean() });

const worktreeCursorSchema = z.object({
    path: z.string().trim().min(1).max(500),
    line: z.coerce.number().int().min(1).max(100_000),
    column: z.coerce.number().int().min(0).max(1000).default(0),
});

const worktreeTerminalChunkSchema = z.object({
    data: z.string().min(1, "Aucun octet à relayer.").max(4000),
    direction: z.enum(["input", "output"]).default("input"),
});

const worktreeTerminalQuerySchema = z.object({
    after: z.coerce.number().int().min(0).default(0),
    limit: z.coerce.number().int().min(1).max(500).default(200),
});

const createAccessTokenSchema = z.object({
    label: z.string().trim().min(1, "Donnez un nom au jeton.").max(80),
    expiresInDays: z.coerce.number().int().min(1).max(365).optional(),
});

const accessTokenIdParam = z.object({ tokenId: idParam });

const createBotSchema = z.object({
    name: z.string().trim().min(2).max(80),
    events: z.array(z.string().trim().min(1).max(60)).max(20).default(["message.created"]),
});

const createActivitySchema = z.object({
    name: z.string().trim().min(2).max(80),
    origin: z.string().trim().url().max(300),
});

const activityLaunchSchema = z.object({ channelId: idParam });

const createAutomationSchema = z.object({
    name: z.string().trim().min(1).max(80),
    event: z.enum(["message.created", "member.joined"]),
    action: z.enum(["post_message", "create_task"]),
    channelId: idParam,
    template: z.string().trim().max(500).default(""),
});

const whiteboardStrokeSchema = z.object({
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide."),
    points: z
        .array(z.object({ x: z.number(), y: z.number() }))
        .min(2)
        .max(2000),
});

const transcriptSchema = z.object({
    text: z.string().trim().min(1).max(4000),
    consented: z.literal(true),
});

const summarySchema = z.object({
    optedIn: z.literal(true),
});

const activityVerifySchema = z.object({
    token: z.string().trim().min(20).max(4000),
});

const updateAutomationSchema = z.object({
    enabled: z.boolean(),
});

const botIdParam = z.object({ guildId: idParam, botId: idParam });
const activityIdParam = z.object({ guildId: idParam, activityId: idParam });
const automationIdParam = z.object({ guildId: idParam, automationId: idParam });

const createDocumentSchema = z.object({
    title: z.string().trim().min(1, "Une page a besoin d'un titre.").max(160),
    body: z.string().max(100_000).default(""),
    summary: z.string().trim().max(200).default(""),
});

const editDocumentSchema = z
    .object({
        title: z.string().trim().min(1).max(160).optional(),
        body: z.string().max(100_000).optional(),
        summary: z.string().trim().max(200).default(""),
        baseRevisionId: idParam.optional(),
    })
    .refine((data) => data.title !== undefined || data.body !== undefined, { message: "Aucune modification fournie." });

const restoreDocumentSchema = z.object({ revisionId: idParam });
const documentIdParam = z.object({ channelId: idParam, documentId: idParam });
const documentRevisionParam = z.object({ channelId: idParam, documentId: idParam, revisionId: idParam });

const openThreadSchema = z.object({ title: z.string().trim().min(1, "Un fil a besoin d'un titre.").max(100) });
const updateThreadSchema = z
    .object({ title: z.string().trim().min(1).max(100).optional(), resolved: z.boolean().optional() })
    .refine((data) => data.title !== undefined || data.resolved !== undefined, {
        message: "Aucune modification fournie.",
    });
const threadListSchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(30) });

const onboardingSchema = z.object({
    enabled: z.boolean(),
    rules: z.string().trim().max(4000).default(""),
    quarantineMinutes: z.coerce
        .number()
        .int()
        .min(0)
        .max(60 * 24 * 7)
        .default(0),
    questions: z
        .array(
            z.object({
                prompt: z.string().trim().min(1, "Une question a besoin d'un intitulé.").max(200),
                options: z
                    .array(z.object({ label: z.string().trim().min(1).max(80), roleId: idParam.nullable().optional() }))
                    .min(1)
                    .max(12),
            })
        )
        .max(10)
        .default([]),
});

const completeOnboardingSchema = z.object({
    accepted: z.boolean(),
    optionIds: z.array(idParam).max(60).default([]),
});

const automodSchema = z.object({
    enabled: z.boolean(),
    blockedWords: z.string().max(4000).default(""),
    blockedDomains: z.string().max(4000).default(""),
    spamMessages: z.coerce.number().int().min(0).max(100).default(0),
    spamSeconds: z.coerce.number().int().min(0).max(3600).default(0),
    raidJoins: z.coerce.number().int().min(0).max(500).default(0),
    raidSeconds: z.coerce.number().int().min(0).max(3600).default(0),
    action: z.enum(["flag", "delete"]).default("flag"),
});

const notificationLevelSchema = z.object({ level: z.enum(["all", "mentions", "none", "inherit"]) });
const quietHoursSchema = z.object({
    start: z.coerce.number().int().min(0).max(23).nullable().default(null),
    end: z.coerce.number().int().min(0).max(23).nullable().default(null),
    desktopNotifications: z.boolean().default(true),
    digestFrequency: z.enum(["off", "daily", "weekly"]).optional(),
});
const unreadQuerySchema = z.object({ channels: z.string().trim().min(1).max(2000) });

const contactNoteSchema = z.object({ body: z.string().trim().max(500) });
const reportSchema = z.object({ reason: z.string().trim().min(3, "Un signalement a besoin d'un motif.").max(500) });
const reportQuerySchema = z.object({
    status: z.enum(["open", "resolved", "rejected"]).default("open"),
    limit: z.coerce.number().int().min(1).max(100).default(50),
});
const resolveReportSchema = z.object({
    status: z.enum(["resolved", "rejected"]),
    resolution: z.string().trim().min(1, "Dites pourquoi ce signalement est clos.").max(500),
});
const reportIdParam = z.object({ guildId: idParam, reportId: idParam });

const searchQuerySchema = z.object({
    q: z.string().trim().min(2, "Saisissez au moins 2 caractères.").max(100),
    limit: z.coerce.number().int().min(1).max(100).default(30),
});

const guildMemberParam = z.object({ guildId: idParam, userId: idParam });
const sanctionIdParam = z.object({ guildId: idParam, sanctionId: idParam });

module.exports = {
    registerSchema,
    loginSchema,
    totpConfirmSchema,
    totpDisableSchema,
    changePasswordSchema,
    emailTokenSchema,
    requestResetSchema,
    resetPasswordSchema,
    sessionIdParam,
    loginHistorySchema,
    availabilitySchema,
    userSearchSchema,
    updateProfileSchema,
    updatePreferencesSchema,
    createGuildSchema,
    updateGuildSchema,
    createChannelSchema,
    updateChannelSchema,
    deleteChannelSchema,
    accessRequestSchema,
    accessDecisionSchema,
    stageSpeakerSchema,
    channelAccessUserParam,
    createCategorySchema,
    inviteIdParam,
    emojiIdParam,
    friendGroupParam,
    friendGroupMemberParam,
    friendGroupSchema,
    friendGroupMemberSchema,
    discoverSchema,
    discoverySettingsSchema,
    createEmojiSchema,
    listEmojiSchema,
    deleteAccountSchema,
    acceptPolicySchema,
    linkPreviewSchema,
    activitySchema,
    visibilitySchema,
    guildProfileSchema,
    folderIdParam,
    createFolderSchema,
    updateFolderSchema,
    placeGuildSchema,
    channelFavoriteSchema,
    displayPrefsSchema,
    pushSubscribeSchema,
    pushUnsubscribeSchema,
    credentialParam,
    securityKeyRegisterSchema,
    securityKeyLoginSchema,
    securityKeyRenameSchema,
    transferGuildSchema,
    modeIdParam,
    channelModeSchema,
    themeIdParam,
    publishThemeSchema,
    suspendGuildSchema,
    deleteGuildSchema,
    reorderCategoriesSchema,
    reorderChannelsSchema,
    updateCategorySchema,
    categoryIdParam,
    searchQuerySchema,
    contactNoteSchema,
    notificationLevelSchema,
    quietHoursSchema,
    unreadQuerySchema,
    automodSchema,
    onboardingSchema,
    completeOnboardingSchema,
    reportSchema,
    reportQuerySchema,
    resolveReportSchema,
    reportIdParam,
    openThreadSchema,
    updateThreadSchema,
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
    createAccessTokenSchema,
    accessTokenIdParam,
    createBotSchema,
    createActivitySchema,
    activityLaunchSchema,
    createAutomationSchema,
    whiteboardStrokeSchema,
    transcriptSchema,
    summarySchema,
    activityVerifySchema,
    updateAutomationSchema,
    botIdParam,
    activityIdParam,
    automationIdParam,
    createDocumentSchema,
    editDocumentSchema,
    restoreDocumentSchema,
    documentIdParam,
    documentRevisionParam,
    threadListSchema,
    sanctionSchema,
    revokeSanctionSchema,
    appealSchema,
    moderationNoteSchema,
    auditQuerySchema,
    guildMemberParam,
    sanctionIdParam,
    createInviteSchema,
    postMessageSchema,
    draftSchema,
    createGroupSchema,
    groupParticipantParam,
    webhookIdParam,
    webhookTokenParam,
    createWebhookSchema,
    webhookPostSchema,
    attachmentPathSchema,
    attachmentVersionsSchema,
    editMessageSchema,
    reactionSchema,
    paginationSchema,
    channelIdParam,
    channelMessageParam,
    reactionRemoveParam,
    guildIdParam,
    friendshipIdParam,
    userIdParam,
    inviteCodeParam,
    friendHandleParam,
    memberDirectorySchema,
    roleTemplateParam,
    applyTemplateSchema,
    notificationListSchema,
    notificationFilterSchema,
    notificationIdParam,
    createRoleSchema,
    updateRoleSchema,
    roleIdParam,
    memberRoleParam,
    channelPermissionParam,
    channelPermissionTargetParam,
    channelPermissionSchema,
    explainPermissionSchema,
    reorderRolesSchema,
    registerDeviceSchema,
    rotateEpochSchema,
    epochQuerySchema,
    encryptionSettingSchema,
    deviceIdParam,
};
