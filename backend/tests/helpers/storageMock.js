"use strict";

module.exports = {
    saveAvatar: async () => "https://cdn.test/avatar.webp",
    saveGuildIcon: async () => "https://cdn.test/icon.webp",
    saveGuildBanner: async () => "https://cdn.test/banner.webp",
    saveUserBanner: async () => "https://cdn.test/user-banner.webp",
    normalizeImage: async (buffer) => buffer,
    putStream: async (key, stream) => {
        stream?.resume?.();
        return `/media/${key}`;
    },
    removeObject: async () => true,
    isEnabled: () => false,
};
