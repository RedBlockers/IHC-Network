"use strict";

const MODES = {
    text: {
        id: "text",
        label: "Texte",
    },
    voice: {
        id: "voice",
        label: "Vocal",
        acceptsMessages: false,
        refusal: "Ce salon est vocal : il n'accueille pas de message écrit.",
    },
    video: {
        id: "video",
        label: "Vidéo",
        voice: true,
        camera: true,
        acceptsMessages: false,
        refusal: "Ce salon est un salon vidéo : il n'accueille pas de message écrit.",
    },
    announcement: {
        id: "announcement",
        label: "Annonces",
        postPermission: "MANAGE_MESSAGES",
        refusal: "Ce salon d'annonces est réservé aux personnes autorisées à publier. Vous pouvez y réagir.",
    },
    forum: {
        id: "forum",
        label: "Forum",
        requiresThread: true,
        refusal: "Dans un forum, ouvrez un sujet ou répondez dans un sujet existant.",
    },
    event: {
        id: "event",
        label: "Événements",
        acceptsMessages: false,
        refusal: "Ce salon accueille des événements : proposez-en un plutôt qu'un message.",
    },
    ticket: {
        id: "ticket",
        label: "Tickets",
        acceptsMessages: false,
        refusal: "Ce salon fonctionne par tickets : ouvrez une demande plutôt qu'un message.",
    },
    task: {
        id: "task",
        label: "Tâches",
        acceptsMessages: false,
        refusal: "Ce salon suit des tâches : créez-en une plutôt qu'un message.",
    },
    wiki: { id: "wiki", label: "Wiki", acceptsMessages: false, document: true, refusal: "Ce salon est un wiki : modifiez une page plutôt que d'écrire un message." },
    documentation: { id: "documentation", label: "Documentation", acceptsMessages: false, document: true, refusal: "Ce salon est une documentation : modifiez une page plutôt que d'écrire un message." },
    resources: { id: "resources", label: "Ressources", acceptsMessages: false, document: true, refusal: "Ce salon rassemble des ressources : ajoutez une fiche plutôt qu'un message." },
    faq: { id: "faq", label: "FAQ", acceptsMessages: false, document: true, refusal: "Ce salon est une FAQ : ajoutez une question plutôt qu'un message." },
    gallery: {
        id: "gallery",
        label: "Galerie",
        requiresAttachment: true,
        refusal: "Une galerie accueille des images : joignez au moins un fichier.",
    },
    poll: {
        id: "poll",
        label: "Sondages",
        requiresPoll: true,
        refusal: "Ce salon n'accueille que des sondages.",
    },

    stage: {
        id: "stage",
        label: "Scène",
        voice: true,
        stage: true,
    },

    support: {
        id: "support",
        label: "Support",
        requiresThread: true,
        refusal: "Dans un salon de support, ouvrez une demande ou répondez dans une demande existante.",
    },

    review: {
        id: "review",
        label: "Revue",
        requiresThread: true,
        refusal: "Une revue se tient dans un fil : ouvrez-en un ou répondez dans un fil existant.",
    },

    design: {
        id: "design",
        label: "Design",
        requiresAttachment: true,
        refusal: "Un salon design accueille des propositions visuelles : joignez au moins une image.",
    },

    meeting: {
        id: "meeting",
        label: "Réunion",
        acceptsMessages: false,
        event: true,
        refusal: "Ce salon organise des réunions : proposez un créneau plutôt qu'un message.",
    },

    development: {
        id: "development",
        label: "Développement",
        requiresThread: true,
        refusal: "Dans un salon de développement, ouvrez un sujet ou répondez dans un sujet existant.",
    },

    incident: {
        id: "incident",
        label: "Incident",
        pinnedFirst: true,
    },

    ephemeral: {
        id: "ephemeral",
        label: "Temporaire",
        temporary: true,
    },

    gated: {
        id: "gated",
        label: "Privé sur validation",
        gated: true,
    },

    spoiler: {
        id: "spoiler",
        label: "Spoiler",
        spoiler: true,
    },
};

const TYPES = Object.keys(MODES);

const modeOf = (type) => MODES[type] ?? MODES.text;

const acceptsMessages = (type) => modeOf(type).acceptsMessages !== false;

const postPermissionFor = (type) => modeOf(type).postPermission ?? null;

const requiresThread = (type) => Boolean(modeOf(type).requiresThread);

const requiresPoll = (type) => Boolean(modeOf(type).requiresPoll);

const requiresAttachment = (type) => Boolean(modeOf(type).requiresAttachment);

const isDocument = (type) => Boolean(modeOf(type).document);

const refusalFor = (type) => modeOf(type).refusal ?? "Ce salon n'accueille pas ce type de contenu.";

const isVoice = (type) => Boolean(modeOf(type).voice) || type === "voice";

const expectsCamera = (type) => Boolean(modeOf(type).camera);

const isStage = (type) => Boolean(modeOf(type).stage);

const isEvent = (type) => Boolean(modeOf(type).event) || type === "event";

const traitsOf = (type) => {
    const mode = modeOf(type);
    return {
        pinnedFirst: Boolean(mode.pinnedFirst),
        temporary: Boolean(mode.temporary),
        gated: Boolean(mode.gated),
        spoiler: Boolean(mode.spoiler),
        stage: Boolean(mode.stage),
    };
};

const OVERRIDABLE = ["acceptsMessages", "requiresThread", "requiresPoll", "requiresAttachment", "pinnedFirst"];

function resolveMode(type, custom) {
    const base = modeOf(type);
    if (!custom) return base;

    const merged = { ...base, id: `custom:${custom.modeId}`, label: custom.name, baseType: base.id };
    for (const key of OVERRIDABLE) {
        if (custom[key] !== null && custom[key] !== undefined) merged[key] = Boolean(custom[key]);
    }
    if (custom.refusal) merged.refusal = custom.refusal;
    return merged;
}

module.exports = {
    MODES,
    OVERRIDABLE,
    resolveMode,
    TYPES,
    modeOf,
    acceptsMessages,
    postPermissionFor,
    requiresThread,
    requiresPoll,
    requiresAttachment,
    isDocument,
    isVoice,
    expectsCamera,
    isStage,
    isEvent,
    traitsOf,
    refusalFor,
};
