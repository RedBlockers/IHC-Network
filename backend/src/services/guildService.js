"use strict";

const crypto = require("node:crypto");

const { NotFound, Conflict, Forbidden, BadRequest } = require("../errors");
const contrast = require("../domain/contrast");
const storageQuota = require("../domain/storageQuota");
const { withTransaction } = require("../db/pool");
const { idAtTime } = require("../infra/snowflake");
const guildRepository = require("../repositories/guildRepository");
const channelRepository = require("../repositories/channelRepository");
const channelModeRepository = require("../repositories/channelModeRepository");
const categoryService = require("./categoryService");
const moderationService = require("./moderationService");
const userRepository = require("../repositories/userRepository");
const inviteRepository = require("../repositories/inviteRepository");
const roleRepository = require("../repositories/roleRepository");
const messageRepository = require("../repositories/messageRepository");
const attachmentRepository = require("../repositories/attachmentRepository");
const eventRepository = require("../repositories/eventRepository");
const storageService = require("./storageService");
const presenceService = require("./presenceService");
const voicePresenceService = require("./voicePresenceService");
const realtime = require("../realtime");
const { effectiveGuildPermissions, hasChannelPermission } = require("./accessService");
const { toGuild, toChannel, toPublicUser } = require("../domain/mappers");

const generateInviteCode = () => crypto.randomBytes(16).toString("base64url");

async function createGuild(owner, { name, description, iconBuffer, banner, accent }) {
    const icon = iconBuffer ? await storageService.saveGuildIcon(iconBuffer) : null;

    const guild = await withTransaction(async (connection) => {
        const created = await guildRepository.create(
            { name, description, icon, banner, accent: accent ?? null, ownerId: owner.userId },
            connection
        );
        await guildRepository.addMember(created.guildId, owner.userId, "owner", connection);
        await roleRepository.initializeGuild(created.guildId, owner.userId, connection);
        await channelRepository.createGuildChannel(
            { type: "text", name: "général", description: "Salon général", guildId: created.guildId, position: 0 },
            connection
        );
        return created;
    });

    return toGuild(guild);
}

async function updateGuild(guildId, fields, { iconBuffer, bannerImageBuffer } = {}) {
    if (fields.accent) {
        const audit = contrast.auditAccent(fields.accent);
        if (!audit.passes) {
            const failing = audit.checks.filter((check) => !check.passes);
            throw new BadRequest(
                `Cet accent reste illisible sur le thème ${failing.map((c) => c.label).join(" et ")}, même corrigé.`,
                {
                    details: {
                        target: audit.target,
                        checks: audit.checks.map(({ label, ratio, passes, applied }) => ({
                            label,
                            ratio,
                            passes,
                            applied,
                        })),
                    },
                }
            );
        }
    }

    const next = { ...fields };
    delete next.removeIcon;
    delete next.removeBannerImage;

    if (iconBuffer) next.icon = await storageService.saveGuildIcon(iconBuffer);
    else if (fields.removeIcon) next.icon = null;

    if (bannerImageBuffer) {
        next.bannerImage = await storageService.saveGuildBanner(bannerImageBuffer);
        if (fields.bannerFocusX === undefined) next.bannerFocusX = 50;
        if (fields.bannerFocusY === undefined) next.bannerFocusY = 50;
    } else if (fields.removeBannerImage) next.bannerImage = null;

    const ok = await guildRepository.update(guildId, next);
    if (!ok) throw new NotFound("Guilde introuvable.");
    const guild = await guildRepository.findById(guildId);
    const mapped = toGuild(guild);
    realtime.emitToGuild(guildId, "guild:update", mapped);
    return mapped;
}

async function getGuildDetail(guildId, userId) {
    const guild = await guildRepository.findById(guildId);
    if (!guild) throw new NotFound("Guilde introuvable.");

    const [members, allChannels, permissions, categories] = await Promise.all([
        userRepository.listByGuild(guildId),
        channelRepository.listByGuild(guildId),
        effectiveGuildPermissions(userId, guildId),
        categoryService.list(guildId),
    ]);
    const visibility = await Promise.all(
        allChannels.map((channel) => hasChannelPermission(userId, channel.channelId, "VIEW_CHANNEL", channel))
    );
    const channels = allChannels.filter((channel, index) => visibility[index] || channel.type === "gated");

    const [onlineMap, voicePresence] = await Promise.all([
        presenceService.areOnline(members.map((m) => Number(m.userId))),
        voicePresenceService.listForChannels(
            channels
                .filter((channel) => ["voice", "video", "stage"].includes(channel.type))
                .map((channel) => Number(channel.channelId))
        ),
    ]);

    return {
        ...toGuild(guild),
        members: members.map((row) => ({
            ...toPublicUser(row),
            role: row.role,
            roles: normalizeRoles(row.roles),
            presence: onlineMap.get(Number(row.userId))
                ? row.statusPreference === "invisible"
                    ? "offline"
                    : row.statusPreference || "online"
                : "offline",
        })),
        channels: channels.map(toChannel),
        categories,
        permissions,
        voicePresence,
    };
}

const WEEK = 7 * 24 * 3600 * 1000;

async function listMembersPage(guildId, { search = "", roleId = null, sort = "joined", limit = 40, page = 0 } = {}) {
    const take = Math.min(Math.max(limit, 1), 100);
    const offset = Math.max(page, 0) * take;

    const [rows, totals] = await Promise.all([
        guildRepository.searchMembers(guildId, { search, roleId, sort, limit: take, offset }),
        guildRepository.countMembers(guildId),
    ]);

    const hasMore = rows.length > take;
    const members = (hasMore ? rows.slice(0, take) : rows).map((row) => ({
        ...toPublicUser(row),
        role: row.role,
        roles: normalizeRoles(row.roles),
        joinedAt: row.joinedAt,
        accountCreatedAt: row.accountCreatedAt,
    }));

    return {
        members,
        page: Math.max(page, 0),
        hasMore,
        total: Number(totals?.total ?? 0),
    };
}

async function overview(guildId, now = Date.now()) {
    const sinceMessageId = idAtTime(now - WEEK);

    const [members, sanctions, reports, activity, structure, health, guild, storage] = await Promise.all([
        guildRepository.countMembers(guildId),
        guildRepository.countSanctions(guildId),
        guildRepository.countOpenReports(guildId),
        guildRepository.countActivity(guildId, sinceMessageId),
        guildRepository.countStructure(guildId),
        guildRepository.countHealth(guildId, sinceMessageId),
        guildRepository.findById(guildId),
        attachmentRepository.sumBytesForGuild(guildId),
    ]);

    const total = Number(members?.total ?? 0);
    const activeAuthors = Number(activity?.activeAuthors ?? 0);

    return {
        members: {
            total,
            bots: Number(members?.bots ?? 0),
            joinedWeek: Number(members?.joinedWeek ?? 0),
            joinedMonth: Number(members?.joinedMonth ?? 0),
        },
        activity: {
            messagesWeek: Number(activity?.messagesWeek ?? 0),
            activeAuthors,
            activeShare: total > 0 ? Math.round((activeAuthors / total) * 100) : null,
        },
        moderation: {
            activeBans: Number(sanctions?.bans ?? 0),
            activeTimeouts: Number(sanctions?.timeouts ?? 0),
            issuedWeek: Number(sanctions?.lastWeek ?? 0),
            openReports: Number(reports?.open ?? 0),
            oldestReportAt: reports?.oldestAt ?? null,
        },
        structure: {
            channels: Number(structure?.channels ?? 0),
            roles: Number(structure?.roles ?? 0),
            invites: Number(structure?.invites ?? 0),
        },
        health: healthOf(health, guild),
        storage: storageOf(storage),
    };
}

function storageOf(row) {
    const used = Number(row?.used ?? 0);
    return {
        usedBytes: used,
        files: Number(row?.files ?? 0),
        pendingBytes: Number(row?.pending ?? 0),
        quotaBytes: storageQuota.QUOTA_BYTES,
        remainingBytes: storageQuota.remainingOf(used),
        share: storageQuota.shareOf(used),
        level: storageQuota.levelOf(storageQuota.shareOf(used)),
    };
}

function healthOf(row, guild) {
    const members = Number(row?.members ?? 0);
    const eligible = Number(row?.eligible ?? 0);
    const messages = Number(row?.sanctionsMonth ?? 0);

    const accent = guild?.accent ?? null;
    const audit = accent ? contrast.auditAccent(accent) : null;

    return {
        onboardingRate: members > 0 ? Math.round((Number(row?.onboarded ?? 0) / members) * 100) : null,
        retentionRate: eligible > 0 ? Math.round((Number(row?.retained ?? 0) / eligible) * 100) : null,
        sanctionsPerMonth: messages,
        accentContrast: audit
            ? {
                  ok: audit.passes,
                  ratio: Math.min(...audit.checks.map((check) => check.ratio)),
                  corrected: audit.checks.some((check) => check.corrected),
              }
            : null,
    };
}

async function home(guildId, userId) {
    const guild = await guildRepository.findById(guildId);
    if (!guild) throw new NotFound("Guilde introuvable.");

    const allChannels = await channelRepository.listByGuild(guildId);
    const visibility = await Promise.all(
        allChannels.map((channel) => hasChannelPermission(userId, channel.channelId, "VIEW_CHANNEL", channel))
    );
    const visible = allChannels.filter((_channel, index) => visibility[index]);

    const idsOf = (...types) =>
        visible.filter((channel) => types.includes(channel.type)).map((channel) => Number(channel.channelId));

    const announcementIds = idsOf("announcement");
    const eventIds = idsOf("event");
    const conversationIds = visible
        .filter((channel) => channel.type === "text" || channel.type === "forum")
        .map((channel) => Number(channel.channelId));

    const [announcements, activity, events] = await Promise.all([
        messageRepository.latestAcrossChannels(announcementIds, 5),
        messageRepository.latestPerChannel(conversationIds),
        eventRepository.upcomingForChannels(eventIds, 5),
    ]);

    const nameOf = new Map(visible.map((channel) => [Number(channel.channelId), channel.name]));
    const withChannel = (row) => ({
        messageId: String(row.messageId),
        channelId: Number(row.channelId),
        channelName: nameOf.get(Number(row.channelId)) ?? null,
        content: row.content,
        createdAt: row.createdAt,
        author: {
            userId: Number(row.userId),
            handle: row.handle,
            displayName: row.displayName,
            avatar: row.avatar,
        },
    });

    return {
        guildId: Number(guildId),
        announcements: announcements.map(withChannel),
        activity: activity.slice(0, 8).map(withChannel),
        events: events.map((row) => ({
            eventId: Number(row.eventId),
            channelId: Number(row.channelId),
            channelName: nameOf.get(Number(row.channelId)) ?? null,
            title: row.title,
            startsAt: row.startsAt,
        })),
        visibleChannels: visible.length,
    };
}

async function listUserGuilds(userId) {
    const rows = await guildRepository.listForUser(userId);
    return rows.map(toGuild);
}

async function listChannels(guildId, userId) {
    const rows = await channelRepository.listByGuild(guildId);
    const visibility = await Promise.all(
        rows.map((channel) => hasChannelPermission(userId, channel.channelId, "VIEW_CHANNEL", channel))
    );
    return rows.filter((channel, index) => visibility[index] || channel.type === "gated").map(toChannel);
}

async function getDefaultChannel(guildId, userId) {
    const channel = (await listChannels(guildId, userId))[0];
    if (!channel) throw new NotFound("Aucun salon dans cette guilde.");
    return channel;
}

async function createChannel(
    guildId,
    { type, name, description, categoryId = null, customModeId = null, expiresInHours = 24 }
) {
    if (categoryId != null) await categoryService.requireOwned(guildId, categoryId);
    if (customModeId) {
        const custom = await channelModeRepository.findById(customModeId);
        if (!custom || Number(custom.guildId) !== Number(guildId)) throw new NotFound("Mode de salon introuvable.");
        type = custom.baseType;
    }
    const channel = await withTransaction(async (connection) => {
        const created = await channelRepository.createGuildChannel(
            { type, name, description, guildId, categoryId },
            connection
        );
        if (type === "gated") await channelRepository.restrictDefault(created.channelId, guildId, connection);
        if (type === "stage") await channelRepository.restrictStage(created.channelId, guildId, connection);
        const fields = {};
        if (type === "ephemeral") fields.expiresAt = new Date(Date.now() + expiresInHours * 3_600_000);
        if (customModeId) fields.customModeId = customModeId;
        if (Object.keys(fields).length) {
            await channelRepository.update(created.channelId, fields, connection);
            Object.assign(created, fields);
        }
        return created;
    });
    const mapped = toChannel(channel);
    realtime.emitToGuild(guildId, "channel:created", mapped);
    return mapped;
}

async function createInvite(guild, creator, { maxUses, expiresInHours }) {
    const expiresAt = expiresInHours ? new Date(Date.now() + expiresInHours * 3_600_000) : null;

    const code = generateInviteCode();
    await inviteRepository.create({ code, guildId: guild.guildId, createdBy: creator.userId, maxUses, expiresAt });
    return { code, guildId: guild.guildId, maxUses, expiresAt };
}

function inviteStatus(row, now = Date.now()) {
    if (row.revokedAt) return "revoked";
    if (row.expiresAt && new Date(row.expiresAt).getTime() <= now) return "expired";
    if (row.maxUses != null && Number(row.uses) >= Number(row.maxUses)) return "exhausted";
    return "active";
}

async function listInvites(guildId) {
    const rows = await inviteRepository.listByGuild(guildId);
    return rows.map((row) => ({
        inviteId: Number(row.inviteId),
        code: row.code,
        uses: Number(row.uses),
        maxUses: row.maxUses == null ? null : Number(row.maxUses),
        expiresAt: row.expiresAt,
        revokedAt: row.revokedAt,
        createdAt: row.createdAt,
        status: inviteStatus(row),
        author: {
            userId: Number(row.authorId),
            handle: row.authorHandle,
            displayName: row.authorDisplayName,
            avatar: row.authorAvatar,
        },
    }));
}

async function revokeInvite(guild, inviteId) {
    const { affectedRows } = await inviteRepository.revoke(inviteId, guild.guildId);
    if (!affectedRows) {
        const known = (await inviteRepository.listByGuild(guild.guildId)).some(
            (row) => Number(row.inviteId) === Number(inviteId)
        );
        if (!known) throw new NotFound("Invitation introuvable dans cette communauté.");
    }
    realtime.emitToGuild(Number(guild.guildId), "invite:revoked", { inviteId: Number(inviteId) });
    return { inviteId: Number(inviteId), status: "revoked" };
}

async function suspend(guild, actor, reason) {
    if (Number(guild.ownerId) !== Number(actor.userId)) {
        throw new Forbidden("Seul le propriétaire peut suspendre la communauté.");
    }
    if (guild.suspendedAt) throw new Conflict("Cette communauté est déjà suspendue.");

    const motive = String(reason ?? "").trim();
    if (motive.length < 10) {
        throw new BadRequest("Expliquez la suspension en une phrase : elle sera montrée aux membres.");
    }

    await guildRepository.setSuspension(guild.guildId, {
        suspendedAt: new Date(),
        reason: motive,
        by: actor.userId,
    });

    const mapped = toGuild(await guildRepository.findById(guild.guildId));
    realtime.emitToGuild(Number(guild.guildId), "guild:update", mapped);
    return { guild: mapped };
}

async function resume(guild, actor) {
    if (Number(guild.ownerId) !== Number(actor.userId)) {
        throw new Forbidden("Seul le propriétaire peut rouvrir la communauté.");
    }
    if (!guild.suspendedAt) throw new Conflict("Cette communauté n'est pas suspendue.");

    await guildRepository.setSuspension(guild.guildId, { suspendedAt: null, reason: null, by: null });

    const mapped = toGuild(await guildRepository.findById(guild.guildId));
    realtime.emitToGuild(Number(guild.guildId), "guild:update", mapped);
    return { guild: mapped };
}

async function transferOwnership(guild, actor, targetUserId, confirmation) {
    if (Number(guild.ownerId) !== Number(actor.userId)) {
        throw new Forbidden("Seul le propriétaire peut transférer la communauté.");
    }
    if (Number(targetUserId) === Number(actor.userId)) {
        throw new BadRequest("Vous êtes déjà propriétaire de cette communauté.");
    }
    if (String(confirmation ?? "").trim() !== guild.name) {
        throw new BadRequest("Saisissez le nom exact de la communauté pour confirmer.");
    }

    const role = await guildRepository.getMembership(guild.guildId, targetUserId);
    if (!role) throw new NotFound("Cette personne n'est pas membre de la communauté.");

    await withTransaction(async (connection) => {
        await guildRepository.setOwner(guild.guildId, targetUserId, connection);
        await guildRepository.setMemberRole(guild.guildId, targetUserId, "owner", connection);
        await guildRepository.setMemberRole(guild.guildId, actor.userId, "admin", connection);
    });

    realtime.emitToGuild(Number(guild.guildId), "guild:owner", {
        guildId: Number(guild.guildId),
        ownerId: Number(targetUserId),
    });
    return { guildId: Number(guild.guildId), ownerId: Number(targetUserId) };
}

async function deleteGuild(guild, actor, confirmation) {
    if (Number(guild.ownerId) !== Number(actor.userId)) {
        throw new Forbidden("Seul le propriétaire peut supprimer la communauté.");
    }
    if (String(confirmation ?? "").trim() !== guild.name) {
        throw new BadRequest("Saisissez le nom exact de la communauté pour confirmer.");
    }

    await guildRepository.delete(guild.guildId);
    realtime.emitToGuild(Number(guild.guildId), "guild:deleted", { guildId: Number(guild.guildId) });
    return { guildId: Number(guild.guildId) };
}

async function discover({ q = "", limit = 24 } = {}) {
    const rows = await guildRepository.listDiscoverable(
        String(q ?? "")
            .trim()
            .slice(0, 60),
        limit
    );
    return rows.map((row) => ({
        guildId: Number(row.guildId),
        name: row.name,
        icon: row.icon ?? null,
        banner: row.banner,
        accent: row.accent ?? null,
        pitch: row.discoveryPitch ?? null,
        tags: (row.discoveryTags ?? "")
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
            .slice(0, 6),
        members: Number(row.members),
    }));
}

async function setDiscovery(guild, { isDiscoverable, pitch, tags }) {
    await guildRepository.setDiscovery(guild.guildId, {
        isDiscoverable,
        pitch: isDiscoverable ? (pitch ?? null) : null,
        tags: isDiscoverable ? (tags ?? null) : null,
    });
    return { isDiscoverable: Boolean(isDiscoverable), pitch: pitch ?? null, tags: tags ?? null };
}

async function previewInvite(code) {
    const invite = await inviteRepository.findPreviewByCode(code);
    if (!invite) throw new NotFound("Invitation invalide ou expirée.");

    return {
        code: invite.code,
        guild: {
            guildId: Number(invite.guildId),
            name: invite.name,
            description: invite.description,
            icon: invite.icon ?? null,
            banner: invite.banner ?? null,
            accent: invite.accent ?? null,
            memberCount: Number(invite.memberCount),
        },
        expiresAt: invite.expiresAt ?? null,
    };
}

async function acceptInvite(user, code) {
    const result = await withTransaction(async (connection) => {
        const invite = await inviteRepository.findValidByCode(code, connection);
        if (!invite) throw new NotFound("Invitation invalide ou expirée.");

        const existing = await guildRepository.getMembership(invite.guildId, user.userId, connection);
        if (existing) throw new Conflict("Vous êtes déjà membre de cette guilde.");

        if (await moderationService.isBanned(invite.guildId, user.userId)) {
            throw new Forbidden("Vous êtes banni de cette communauté.");
        }

        const consumed = await inviteRepository.consume(invite.inviteId, connection);
        if (consumed.affectedRows === 0) throw new NotFound("Invitation invalide ou expirée.");

        await guildRepository.addMember(invite.guildId, user.userId, "member", connection);
        await roleRepository.assignDefault(invite.guildId, user.userId, connection);
        return invite.guildId;
    });

    realtime.emitToUser(user.userId, "guild:joined", { guildId: result });
    realtime.emitToGuild(result, "member:joined", { guildId: result, member: toPublicUser(user) });
    const automationService = require("./automationService");
    await automationService.dispatchGuild(result, user, "member.joined").catch(() => {});
    return { guildId: result };
}

function normalizeRoles(value) {
    if (!value) return [];
    const roles = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(roles)
        ? roles
              .map((role) => ({
                  roleId: Number(role.roleId),
                  name: role.name,
                  iconEmoji: role.iconEmoji ?? null,
                  color: role.color,
                  position: Number(role.position),
                  isDefault: Boolean(role.isDefault),
              }))
              .sort((a, b) => b.position - a.position)
        : [];
}

module.exports = {
    suspend,
    resume,
    home,
    listMembersPage,
    overview,
    createGuild,
    updateGuild,
    getGuildDetail,
    listUserGuilds,
    listChannels,
    getDefaultChannel,
    createChannel,
    discover,
    setDiscovery,
    transferOwnership,
    deleteGuild,
    createInvite,
    listInvites,
    revokeInvite,
    inviteStatus,
    previewInvite,
    acceptInvite,
};
