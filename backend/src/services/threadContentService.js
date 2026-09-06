"use strict";

const channelModes = require("../domain/channelModes");
const accessService = require("./accessService");
const onboardingService = require("./onboardingService");
const automodService = require("./automodService");
const secretScanner = require("../domain/secretScanner");
const { BadRequest, Forbidden } = require("../errors");

async function prepare(channel, user, content) {
    const mode = channelModes.resolveMode(channel.type, channel.customMode);
    if (mode.acceptsMessages === false || mode.requiresPoll || mode.requiresAttachment) {
        throw new BadRequest("Ce type de salon ne permet pas les sujets textuels.");
    }
    if (
        mode.postPermission &&
        !(await accessService.hasChannelPermission(user.userId, channel.channelId, mode.postPermission, channel))
    ) {
        throw new Forbidden(mode.refusal);
    }
    if (channel.guildId) {
        await onboardingService.assertMaySpeak(channel.guildId, user.userId);
        await automodService.inspectMessage(channel.guildId, user.userId, content);
    }
    const matches = secretScanner.scan(content);
    return matches.length ? secretScanner.redact(content, matches) : content;
}

module.exports = { prepare };
