"use strict";

const { PERMISSION_SET } = require("./permissions");

const TEMPLATES = Object.freeze([
    {
        id: "moderator",
        name: "Modération",
        iconEmoji: "🛡️",
        color: "#4C8DFF",
        summary: "Fait respecter les règles au quotidien.",
        excludes: "Ne peut pas modifier les rôles ni les réglages de la communauté.",
        permissions: [
            "VIEW_CHANNEL",
            "SEND_MESSAGES",
            "READ_MESSAGE_HISTORY",
            "ADD_REACTIONS",
            "ATTACH_FILES",
            "MANAGE_MESSAGES",
            "MODERATE_MEMBERS",
            "KICK_MEMBERS",
            "MUTE_MEMBERS",
            "MOVE_MEMBERS",
            "VIEW_AUDIT_LOG",
            "CONNECT",
            "SPEAK",
        ],
    },
    {
        id: "host",
        name: "Animation",
        iconEmoji: "🎙️",
        color: "#12B5A2",
        summary: "Anime les salons vocaux et les événements.",
        excludes: "Aucun pouvoir de sanction.",
        permissions: [
            "VIEW_CHANNEL",
            "SEND_MESSAGES",
            "READ_MESSAGE_HISTORY",
            "ADD_REACTIONS",
            "ATTACH_FILES",
            "MENTION_EVERYONE",
            "CONNECT",
            "SPEAK",
            "VIDEO",
            "STREAM",
            "MUTE_MEMBERS",
            "MOVE_MEMBERS",
        ],
    },
    {
        id: "builder",
        name: "Structure",
        iconEmoji: "🧱",
        color: "#B583FF",
        summary: "Organise les salons, les catégories et l’accueil.",
        excludes: "Ne modère pas les membres.",
        permissions: [
            "VIEW_CHANNEL",
            "SEND_MESSAGES",
            "READ_MESSAGE_HISTORY",
            "ADD_REACTIONS",
            "ATTACH_FILES",
            "MANAGE_CHANNELS",
            "MANAGE_EMOJIS",
            "CREATE_INVITE",
            "CONNECT",
            "SPEAK",
        ],
    },
    {
        id: "member",
        name: "Membre",
        iconEmoji: "💬",
        color: "#8895A5",
        summary: "Le nécessaire pour participer, et rien de plus.",
        excludes: "Aucun pouvoir d’administration.",
        permissions: [
            "VIEW_CHANNEL",
            "SEND_MESSAGES",
            "READ_MESSAGE_HISTORY",
            "ADD_REACTIONS",
            "ATTACH_FILES",
            "CONNECT",
            "SPEAK",
            "VIDEO",
        ],
    },
    {
        id: "guest",
        name: "Invité",
        iconEmoji: "👋",
        color: "#6C7688",
        summary: "Peut lire et écouter, sans prendre la parole.",
        excludes: "Ne peut ni écrire, ni parler, ni inviter.",
        permissions: ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY", "CONNECT"],
    },
]);

for (const template of TEMPLATES) {
    for (const permission of template.permissions) {
        if (!PERMISSION_SET.has(permission)) {
            throw new Error(`Modèle de rôle « ${template.id} » : permission inconnue « ${permission} ».`);
        }
    }
}

const byId = new Map(TEMPLATES.map((template) => [template.id, template]));

const findTemplate = (id) => byId.get(String(id)) ?? null;

const rulesOf = (template) =>
    Object.fromEntries(template.permissions.map((permission) => [permission, "allow"]));

module.exports = { TEMPLATES, findTemplate, rulesOf, TEMPLATE_IDS: TEMPLATES.map((t) => t.id) };
