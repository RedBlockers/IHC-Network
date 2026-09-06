"use strict";

const friendshipService = require("../services/friendshipService");
const guildService = require("../services/guildService");
const channelRepository = require("../repositories/channelRepository");
const userRepository = require("../repositories/userRepository");
const { NotFound } = require("../errors");
const { toPublicUser } = require("../domain/mappers");
const userProfileService = require("../services/userProfileService");
const profileDecorations = require("../domain/profileDecorations");

const userController = {
    decorations: async (_req, res) => {
        res.status(200).json({ decorations: Object.values(profileDecorations.DECORATIONS) });
    },

    updateMe: async (req, res) => {
        const user = await userProfileService.update(req.user, req.body, {
            avatarBuffer: req.files?.avatar?.[0]?.buffer,
            bannerImageBuffer: req.files?.bannerImage?.[0]?.buffer,
        });
        res.status(200).json({ user });
    },

    updatePreferences: async (req, res) => {
        const preferences = await userProfileService.updatePreferences(req.user, req.body);
        res.status(200).json({ preferences });
    },

    getById: async (req, res) => {
        const user = await userRepository.findById(req.params.userId);
        if (!user) throw new NotFound("Utilisateur introuvable.");
        res.status(200).json({ user: toPublicUser(user) });
    },

    search: async (req, res) => {
        const rows = await userRepository.searchByHandle(req.validatedQuery.q, req.user.userId);
        res.status(200).json({ users: rows.map(toPublicUser) });
    },

    listFriends: async (req, res) => {
        const friends = await friendshipService.listFriends(req.user.userId);
        res.status(200).json({ friends });
    },

    sendFriendRequest: async (req, res) => {
        const friend = await friendshipService.sendRequest(req.user, req.params.handle);
        res.status(201).json({ friend });
    },

    acceptFriendRequest: async (req, res) => {
        await friendshipService.acceptRequest(req.user, req.params.friendshipId);
        res.status(200).json({ status: "accepted" });
    },

    removeFriend: async (req, res) => {
        await friendshipService.removeFriend(req.user, req.params.friendshipId);
        res.status(204).end();
    },

    listGuilds: async (req, res) => {
        const guilds = await guildService.listUserGuilds(req.user.userId);
        res.status(200).json({ guilds });
    },

    listDirectChannels: async (req, res) => {
        const rows = await channelRepository.listDirectForUser(req.user.userId);
        const channels = rows.map((row) => ({
            channelId: Number(row.channelId),
            type: row.type,
            user: {
                userId: Number(row.userId),
                handle: row.handle,
                displayName: row.displayName,
                avatar: row.avatar,
                bannerImage: row.bannerImage ?? null,
                aboutMe: row.aboutMe ?? "",
                activityText: row.activityText ?? "",
                presence: row.presence,
            },
        }));
        res.status(200).json({ channels });
    },
};

module.exports = userController;
