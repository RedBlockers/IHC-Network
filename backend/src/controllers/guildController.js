"use strict";

const guildService = require("../services/guildService");
const themeService = require("../services/themeService");
const channelModeService = require("../services/channelModeService");
const categoryService = require("../services/categoryService");
const emojiService = require("../services/emojiService");
const guildExportService = require("../services/guildExportService");

const guildController = {
    exportGuild: async (req, res) => {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="qweillo-${req.guild.guildId}.json"`);
        await guildExportService.stream(req.guild, req.user, res);
        res.end();
    },

    discover: async (req, res) => {
        res.status(200).json({ guilds: await guildService.discover(req.validatedQuery) });
    },
    setDiscovery: async (req, res) => {
        res.status(200).json(await guildService.setDiscovery(req.guild, req.body));
    },

    listEmojis: async (req, res) => {
        res.status(200).json({ emojis: await emojiService.list(req.params.guildId, req.validatedQuery?.kind ?? null) });
    },
    createEmoji: async (req, res) => {
        const media = await emojiService.create(req.guild, req.user, req.file, req.body.name, req.body.kind);
        res.status(201).json({ emoji: media });
    },
    removeEmoji: async (req, res) => {
        await emojiService.remove(req.guild, req.params.emojiId);
        res.status(204).end();
    },

    transferOwnership: async (req, res) => {
        res.status(200).json(await guildService.transferOwnership(req.guild, req.user, req.body.userId, req.body.confirm));
    },
    listChannelModes: async (req, res) => {
        res.status(200).json({ modes: await channelModeService.list(req.params.guildId) });
    },
    createChannelMode: async (req, res) => {
        res.status(201).json(await channelModeService.create(req.guild, req.user, req.body));
    },
    updateChannelMode: async (req, res) => {
        res.status(200).json(await channelModeService.update(req.guild, req.params.modeId, req.body));
    },
    removeChannelMode: async (req, res) => {
        res.status(200).json(await channelModeService.remove(req.guild, req.params.modeId));
    },

    activeTheme: async (req, res) => {
        res.status(200).json({ theme: await themeService.active(req.params.guildId) });
    },
    themeHistory: async (req, res) => {
        res.status(200).json({ themes: await themeService.history(req.params.guildId) });
    },
    publishTheme: async (req, res) => {
        res.status(201).json(await themeService.publish(req.guild, req.user, req.body));
    },
    rollbackTheme: async (req, res) => {
        res.status(201).json(await themeService.rollback(req.guild, req.user, req.params.themeId));
    },
    cancelTheme: async (req, res) => {
        res.status(200).json(await themeService.cancel(req.guild, req.params.themeId));
    },

    suspend: async (req, res) => {
        res.status(200).json(await guildService.suspend(req.guild, req.user, req.body.reason));
    },
    resume: async (req, res) => {
        res.status(200).json(await guildService.resume(req.guild, req.user));
    },
    remove: async (req, res) => {
        res.status(200).json(await guildService.deleteGuild(req.guild, req.user, req.body.confirm));
    },

    listInvites: async (req, res) => {
        res.status(200).json({ invites: await guildService.listInvites(req.params.guildId) });
    },
    revokeInvite: async (req, res) => {
        res.status(200).json(await guildService.revokeInvite(req.guild, req.params.inviteId));
    },

    home: async (req, res) => {
        res.status(200).json(await guildService.home(req.params.guildId, req.user.userId));
    },

    reorderCategories: async (req, res) => {
        res.status(200).json({ categories: await categoryService.reorder(req.params.guildId, req.body.order) });
    },
    reorderChannels: async (req, res) => {
        const { categoryId = null, order } = req.body;
        res.status(200).json(await categoryService.reorderChannels(req.params.guildId, categoryId, order));
    },

    members: async (req, res) => {
        res.status(200).json(await guildService.listMembersPage(req.params.guildId, req.validatedQuery));
    },
    overview: async (req, res) => {
        res.status(200).json(await guildService.overview(req.params.guildId));
    },

    create: async (req, res) => {
        const guild = await guildService.createGuild(req.user, {
            name: req.body.name,
            description: req.body.description,
            banner: req.body.banner,
            accent: req.body.accent,
            iconBuffer: req.file?.buffer,
        });
        res.status(201).json({ guild });
    },

    update: async (req, res) => {
        const guild = await guildService.updateGuild(req.guild.guildId, req.body, {
            iconBuffer: req.files?.icon?.[0]?.buffer,
            bannerImageBuffer: req.files?.bannerImage?.[0]?.buffer,
        });
        res.status(200).json({ guild });
    },

    getById: async (req, res) => {
        const detail = await guildService.getGuildDetail(req.guild.guildId, req.user.userId);
        res.status(200).json({ guild: detail });
    },

    listChannels: async (req, res) => {
        const channels = await guildService.listChannels(req.guild.guildId, req.user.userId);
        res.status(200).json({ channels });
    },

    getDefaultChannel: async (req, res) => {
        const channel = await guildService.getDefaultChannel(req.guild.guildId, req.user.userId);
        res.status(200).json({ channel });
    },

    createChannel: async (req, res) => {
        const channel = await guildService.createChannel(req.guild.guildId, req.body);
        res.status(201).json({ channel });
    },

    listCategories: async (req, res) => {
        const categories = await categoryService.list(req.guild.guildId);
        res.status(200).json({ categories });
    },

    createCategory: async (req, res) => {
        const category = await categoryService.create(req.guild.guildId, req.body);
        res.status(201).json({ category });
    },

    updateCategory: async (req, res) => {
        const category = await categoryService.update(req.guild.guildId, req.params.categoryId, req.body);
        res.status(200).json({ category });
    },

    removeCategory: async (req, res) => {
        await categoryService.remove(req.guild.guildId, req.params.categoryId);
        res.status(204).end();
    },

    createInvite: async (req, res) => {
        const invite = await guildService.createInvite(req.guild, req.user, req.body);
        res.status(201).json({ invite });
    },

    previewInvite: async (req, res) => {
        const invite = await guildService.previewInvite(req.params.code);
        res.status(200).json({ invite });
    },

    acceptInvite: async (req, res) => {
        const result = await guildService.acceptInvite(req.user, req.params.code);
        res.status(200).json(result);
    },
};

module.exports = guildController;
