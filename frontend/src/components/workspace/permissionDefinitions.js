export const PERMISSION_GROUPS = [
    ["Messages", [
        ["VIEW_CHANNEL", "Voir les salons", "Accéder aux salons visibles pour ce rôle."],
        ["SEND_MESSAGES", "Envoyer des messages", "Écrire dans les salons textuels autorisés."],
        ["READ_MESSAGE_HISTORY", "Lire l’historique", "Consulter les messages envoyés avant l’arrivée."],
        ["ADD_REACTIONS", "Ajouter des réactions", "Réagir avec les emojis disponibles."],
        ["MENTION_EVERYONE", "Mentionner @everyone et @here", "@everyone notifie les membres visibles ; @here signale uniquement les membres connectés."],
        ["MANAGE_MESSAGES", "Gérer les messages", "Modifier, épingler ou retirer les messages des autres."],
    ]],
    ["Vocal et vidéo", [
        ["CONNECT", "Rejoindre le vocal", "Entrer dans les salons vocaux autorisés."],
        ["SPEAK", "Prendre la parole", "Transmettre son microphone."],
        ["VIDEO", "Activer la caméra", "Publier une piste vidéo."],
        ["STREAM", "Partager son écran", "Publier un partage d’écran."],
        ["MUTE_MEMBERS", "Couper le micro des membres", "Modérer la parole dans un appel."],
        ["MOVE_MEMBERS", "Déplacer les membres", "Déplacer une personne entre salons vocaux."],
    ]],
    ["Communauté", [
        ["CREATE_INVITE", "Créer des invitations", "Générer des liens ou codes d’accès traçables."],
        ["MANAGE_CHANNELS", "Gérer les salons", "Créer, modifier et réordonner les salons."],
        ["MANAGE_ROLES", "Gérer les rôles", "Modifier uniquement les rôles situés plus bas."],
        ["MANAGE_EMOJIS", "Gérer emojis et stickers", "Ajouter ou retirer les éléments personnalisés."],
        ["MANAGE_WEBHOOKS", "Gérer les webhooks", "Connecter des services externes."],
        ["MANAGE_GUILD", "Gérer la communauté", "Modifier l’identité et les réglages globaux."],
    ]],
    ["Modération", [
        ["MODERATE_MEMBERS", "Mettre en timeout", "Suspendre temporairement les interactions."],
        ["KICK_MEMBERS", "Exclure des membres", "Retirer un membre avec motif obligatoire."],
        ["BAN_MEMBERS", "Bannir des membres", "Interdire le retour avec confirmation typée."],
        ["VIEW_AUDIT_LOG", "Voir le journal d’audit", "Consulter les actions sensibles et leur auteur."],
    ]],
];

export const PERMISSION_STATES = [
    ["deny", "Refuser"],
    ["inherit", "Hériter"],
    ["allow", "Autoriser"],
];
