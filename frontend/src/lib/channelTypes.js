export const CHANNEL_GROUPS = [
    {
        id: "conversation",
        label: "Conversation",
        types: [
            { id: "text", icon: "hash", label: "Salon textuel", note: "Messages, fichiers et fils." },
            { id: "voice", icon: "volume", label: "Salon vocal", note: "Audio, caméra et écran." },
            { id: "video", icon: "volume", label: "Salon vidéo", note: "La caméra s’allume en entrant." },
            { id: "stage", icon: "volume", label: "Scène", note: "Le public écoute ; la parole se donne." },
            {
                id: "announcement",
                icon: "bell",
                label: "Annonces",
                note: "Seuls les autorisés publient ; tous réagissent.",
            },
            { id: "forum", icon: "channels", label: "Forum", note: "Chaque sujet est un fil séparé." },
        ],
    },
    {
        id: "work",
        label: "Travail",
        types: [
            { id: "support", icon: "invite", label: "Support", note: "Chaque demande a son fil, et se suit." },
            { id: "review", icon: "check", label: "Revue", note: "Worktrees, diffs commentables, un fil par revue." },
            { id: "design", icon: "smile", label: "Design", note: "On montre avant d’en parler : image obligatoire." },
            {
                id: "development",
                icon: "edit",
                label: "Développement",
                note: "Worktrees partagés, Git en direct, pair et mob.",
            },
            {
                id: "meeting",
                icon: "calendar",
                label: "Réunion",
                note: "Créneaux, ordre du jour, présences et calendrier.",
            },
            {
                id: "incident",
                icon: "bell",
                label: "Incident",
                note: "Tout le monde écrit ; l’essentiel reste en tête.",
            },
            { id: "task", icon: "edit", label: "Tâches", note: "Trois colonnes, un responsable, une échéance." },
            { id: "ticket", icon: "invite", label: "Tickets", note: "Chaque demande, un échange privé avec l’équipe." },
        ],
    },
    {
        id: "reference",
        label: "Référence",
        types: [
            { id: "wiki", icon: "channels", label: "Wiki", note: "Des pages, un sommaire, un historique." },
            {
                id: "documentation",
                icon: "channels",
                label: "Documentation",
                note: "Le même moteur, présenté comme un manuel.",
            },
            { id: "resources", icon: "channels", label: "Ressources", note: "Des fiches à retrouver vite." },
            { id: "faq", icon: "channels", label: "FAQ", note: "Une question, une réponse." },
        ],
    },
    {
        id: "collect",
        label: "Collecte",
        types: [
            { id: "gallery", icon: "smile", label: "Galerie", note: "Des images déposées, en grille." },
            {
                id: "poll",
                icon: "check",
                label: "Sondages",
                note: "Une question, des réponses, une voix par personne.",
            },
            {
                id: "event",
                icon: "calendar",
                label: "Événements",
                note: "Dates, inscriptions et export vers votre calendrier.",
            },
        ],
    },
    {
        id: "access",
        label: "Accès et présentation",
        types: [
            {
                id: "gated",
                icon: "lock",
                label: "Privé sur validation",
                note: "Demande d’accès, validation et révocation par l’équipe.",
            },
            {
                id: "ephemeral",
                icon: "close",
                label: "Temporaire",
                note: "Fermeture automatique à la date prévue ; historique conservé.",
            },
            { id: "spoiler", icon: "smile", label: "Spoiler", note: "Contenu masqué jusqu’au clic." },
        ],
    },
];

export const CHANNEL_TYPES = CHANNEL_GROUPS.flatMap((group) => group.types);

export const PRIMARY_CHANNEL_TYPE_IDS = ["text", "voice", "announcement"];

export const channelTypeOf = (id) => CHANNEL_TYPES.find((type) => type.id === id) ?? CHANNEL_TYPES[0];

export const isPrimaryChannelType = (id) => PRIMARY_CHANNEL_TYPE_IDS.includes(id);
