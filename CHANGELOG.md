# Changelog

## En développement

- Envoi d’un message bloqué jusqu’à la fin de toutes ses pièces jointes ; changement de salon interrompant les transferts en attente.
- Installation en une commande avec menu terminal au clavier, configuration préservée et profils local, HTTPS automatique ou proxy existant.
- Gestion depuis le même menu : démarrage, état, sauvegarde, courrier sortant, nom de l’instance et arrêt confirmé.
- Parcours des 24 types de salons : sujets avec réponses, suivi et résolution ; galeries et design avec image obligatoire ; sondages actualisés en direct et clôturables.
- Tickets privés : conversation détaillée, notes internes réservées à l’équipe, responsable, priorités, statuts, recherche, pagination et export texte.
- Tâches avec détail, responsable et échéance ; événements et réunions modifiables, réponses de présence et export calendrier.
- Pages et fiches avec historique, lecture des révisions, restauration du titre et du contenu, et détection des modifications concurrentes.
- Salons privés sur demande avec validation et révocation ; salons temporaires avec fermeture automatique, historique conservé et prolongation.
- Réglages des salons : nom, description, échéance et suppression avec confirmation du nom.
- Scènes avec public en écoute par défaut et attribution ou retrait de la parole par la modération.
- Audio conservé pendant la navigation vers un salon texte, et réception des mains levées dès l’entrée sur une scène.
- Six décorations d’avatar redessinées et animées, avec pause hors écran et prise en compte de la réduction des animations.
- Permissions vérifiées sur les opérations spécialisées et limites du chiffrement explicites pour les contenus structurés.
- Envois de fichiers : plafonds du proxy alignés, temporaires sur disque, réservation de l’espace et du quota pour les transferts concurrents, nettoyage après refus ou interruption.
- Fichiers HTML, SVG et JavaScript servis en téléchargement avec un type binaire ; les aperçus des images, de l’audio, de la vidéo et des PDF restent disponibles.
- Historique et éditions des messages chiffrés corrigés, avec actualisation du déchiffrement après modification ; recherche de fichiers corrigée.
- Choix des instances sur le web et le bureau, QR codes et sessions isolées.
- Navigation des paramètres revue sur ordinateur et mobile, clavier et contrastes corrigés.
- Parcours complets de vérification d’adresse, récupération du compte et double authentification.
- Export des données, suppression différée, transfert et suppression des communautés.
- Sauvegarde des données et de la configuration protégée, exercice de restauration et contrôles navigateur et terminal en CI.
- Correctifs de sessions, de double authentification et de dépendances.

## 2.0.0

Réécriture complète.

- API sans état multi-instances (Express, MySQL 8, Redis, Socket.IO), migrations versionnées.
- Sessions rotatives, TOTP, clés WebAuthn, vérification d'adresse, historique des connexions.
- Communautés : catégories, rôles et permissions par salon, onboarding, filtres automatiques, modération avec journal d'audit, thèmes et bannières.
- Vingt-quatre types de salons : conversations, média, événements, sondages, galeries, tickets, tâches, documents et espaces de travail ; modes personnalisés fondés sur ces types.
- Messages : Markdown assaini, réponses, fils, réactions, épingles, pièces jointes, aperçus de liens, messages vocaux, commandes, brouillons et envoi hors ligne.
- Chiffrement de bout en bout par salon, détection de secrets avant envoi.
- Voix, caméra et partage d'écran via LiveKit auto-hébergé.
- Webhooks, bots, activités embarquées, notifications push, recherche globale.
- Client de bureau Electron, CLI Git pour les salons de développement.
- Docker de production avec Caddy, sauvegarde et exercice de restauration, mode maintenance.
