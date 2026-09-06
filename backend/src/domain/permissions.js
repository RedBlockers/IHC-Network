"use strict";

const PERMISSIONS = Object.freeze([
    "VIEW_CHANNEL",
    "SEND_MESSAGES",
    "READ_MESSAGE_HISTORY",
    "ADD_REACTIONS",
    "MENTION_EVERYONE",
    "MANAGE_MESSAGES",
    "ATTACH_FILES",
    "CREATE_INVITE",
    "CONNECT",
    "SPEAK",
    "VIDEO",
    "STREAM",
    "MUTE_MEMBERS",
    "MOVE_MEMBERS",
    "MANAGE_CHANNELS",
    "MANAGE_ROLES",
    "MANAGE_GUILD",
    "MANAGE_EMOJIS",
    "MANAGE_WEBHOOKS",
    "MODERATE_MEMBERS",
    "KICK_MEMBERS",
    "BAN_MEMBERS",
    "VIEW_AUDIT_LOG",
]);

const PERMISSION_SET = new Set(PERMISSIONS);
const EFFECTS = Object.freeze(["allow", "deny"]);

module.exports = { PERMISSIONS, PERMISSION_SET, EFFECTS };
