"use strict";

const emissions = [];

module.exports = {
    init: () => null,
    close: async () => {},
    emitToChannel: (channelId, event, payload) => emissions.push({ target: "channel", channelId, event, payload }),
    emitToGuild: (guildId, event, payload) => emissions.push({ target: "guild", guildId, event, payload }),
    emitToUser: (userId, event, payload) => emissions.push({ target: "user", userId, event, payload }),
    getIo: () => null,
    userRoom: (id) => `user:${id}`,
    channelRoom: (id) => `channel:${id}`,
    __emissions: emissions,
    __reset: () => emissions.splice(0, emissions.length),
};
