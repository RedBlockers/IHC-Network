# Types de salons

Les 24 types partagent les permissions de la communauté et des salons. Le type
détermine le contenu à créer et sa présentation ; il ne donne pas de droit
supplémentaire au membre.

| Type API | Nom | Usage |
|---|---|---|
| `text` | Texte | Messages, fichiers, réactions et fils de discussion. |
| `voice` | Vocal | Audio, caméra et partage d’écran selon les permissions. |
| `video` | Vidéo | Salon média proposant la caméra à l’entrée, sous réserve de l’autorisation du navigateur. |
| `stage` | Scène | Public en écoute ; la modération peut donner ou reprendre la parole. |
| `announcement` | Annonces | Publication réservée aux membres ayant `MANAGE_MESSAGES` et `SEND_MESSAGES` ; réactions selon les permissions. |
| `forum` | Forum | Sujets séparés, réponses, suivi et résolution. |
| `support` | Support | Questions et réponses visibles par les membres ayant accès au salon. |
| `review` | Revue | Discussions par sujet et outils de revue de worktrees. |
| `design` | Design | Propositions visuelles avec au moins une image jointe. |
| `development` | Développement | Discussions par sujet et worktrees partagés. |
| `meeting` | Réunion | Créneaux, description, lieu, réponses de présence et export calendrier. |
| `incident` | Incident | Conversation avec les messages épinglés en tête et accès aux worktrees. |
| `task` | Tâches | Détails, responsable, échéance et colonnes À faire, En cours, Terminé. |
| `ticket` | Tickets | Demandes privées entre leur auteur et l’équipe du salon. |
| `wiki` | Wiki | Pages avec sommaire, recherche et historique. |
| `documentation` | Documentation | Même moteur de pages, présenté comme un manuel. |
| `resources` | Ressources | Fiches avec le même historique de révisions. |
| `faq` | FAQ | Questions et réponses avec le même moteur de pages. |
| `gallery` | Galerie | Images jointes présentées en grille. |
| `poll` | Sondages | Questions à choix unique, résultats actualisés et clôture. |
| `event` | Événements | Dates, réponses de présence et export calendrier. |
| `gated` | Privé sur validation | Métadonnées visibles dans la communauté et demande d’accès au contenu. |
| `ephemeral` | Temporaire | Fermeture automatique à l’échéance ; historique conservé. |
| `spoiler` | Spoiler | Contenu masqué dans le client jusqu’à sa révélation. |

Les modes personnalisés reprennent un type de base et ses opérations disponibles.
Le tableau blanc est un outil de collaboration, pas un vingt-cinquième type de salon.

## Tickets

Un membre voit ses propres demandes. L’équipe disposant de `MODERATE_MEMBERS`
dans le salon peut consulter les demandes de tous, attribuer un responsable,
modifier la priorité et le statut, et écrire des notes internes. Un responsable
doit avoir accès au salon et la permission de traiter les tickets.

Les quatre statuts sont `open`, `pending`, `resolved` et `closed`. Une réponse
publique de l’équipe passe le ticket à `pending` ; une réponse du demandeur le
repasse à `open`. Une note interne conserve le statut. Le demandeur peut fermer
son ticket ; l’équipe peut le rouvrir. Un ticket fermé reste consultable et
n’accepte plus de réponse. Les priorités sont `low`, `normal`, `high` et `urgent`.

La file propose une recherche, un filtre par statut et des pages de 50 demandes
au maximum. L’export texte est construit par le navigateur à partir de l’échange
autorisé : les notes internes ne sont pas envoyées au demandeur et ne figurent
donc pas dans son export.

## Sujets, pages, tâches et calendrier

Dans les forums, le support, les revues et le développement, chaque sujet possède
son échange et son suivi. L’auteur ou la modération peut marquer un sujet résolu
ou non résolu. Supprimer le message racine supprime aussi ses réponses.

Les quatre types de documents proposent création, lecture, modification et
suppression. La suppression demande `MANAGE_CHANNELS`. L’historique affiche les
50 dernières révisions ; une révision peut
être lue puis restaurée comme nouvelle version avec son titre et son contenu.
Les révisions anciennes sans titre enregistré conservent le titre courant lors
de la restauration. L’éditeur transmet la révision de départ pour détecter une
modification concurrente : en cas de conflit, le brouillon peut être conservé
avant de recharger la page.

Les tâches permettent de changer le titre, les détails, le responsable, la date
limite et la colonne. Le responsable doit avoir accès au salon ; seul l’auteur
peut supprimer la tâche. Une tâche terminée n’est plus comptée en retard.

Les événements et réunions partagent les mêmes opérations. Leur auteur peut
modifier les informations et les dates, y compris uniquement la fin, ou annuler.
Les réponses sont `going`, `maybe` et `no` ; un événement annulé ou passé n’accepte
plus de réponse. L’export `.ics` est produit dans le navigateur. Sans date de fin,
la durée utilisée pour le statut et le calendrier est de deux heures.

## Accès, fermeture et scènes

Les membres de la communauté voient le nom et la description d’un salon sur
validation avant d’y accéder. Ils peuvent envoyer un motif de demande. Les
personnes ayant `MANAGE_CHANNELS` dans la communauté valident, refusent ou
révoquent l’accès. Une validation crée une autorisation `VIEW_CHANNEL` pour le
membre ; un refus ou une révocation crée une interdiction. Les règles générales
de permissions, notamment celles du propriétaire et des administrateurs,
continuent de s’appliquer.

Un salon temporaire ferme par défaut après 24 heures. Sa durée initiale peut être
choisie entre 1 et 8 760 heures. À l’échéance, l’API refuse les écritures et laisse
l’historique accessible aux membres autorisés. Une personne ayant `MANAGE_CHANNELS`
peut prolonger la date de fermeture ou supprimer le salon. La suppression exige
de recopier exactement son nom.

Une scène retire au rôle par défaut les permissions de publier au microphone,
à la caméra et à l’écran. La modération ayant `MUTE_MEMBERS` peut donner ou retirer
la parole à une personne connectée : la permission est appliquée à LiveKit et au
salon. L’attribution de la parole autorise le microphone ; elle n’active pas la
caméra ou le partage d’écran.

## Chiffrement

L’option de chiffrement de bout en bout concerne les messages des salons
compatibles. Elle est indisponible pour `ticket`, `task`, `wiki`, `documentation`,
`resources`, `faq`, `event`, `meeting` et `poll`. Leurs contenus structurés sont
traités par le serveur avec un contrôle d’accès ; ils ne sont pas chiffrés de bout
en bout. Un sondage ne peut pas être créé dans une conversation chiffrée.

Le masquage spoiler est une présentation du client. Les permissions et l’option
de chiffrement des messages ne chiffrent ni la base de données ni les sauvegardes.

## Routes et données

L’[inventaire OpenAPI](openapi.json) est généré depuis les routes avec
`node scripts/generate-openapi.mjs > docs/openapi.json`. Il décrit les méthodes,
les chemins et l’authentification, sans schémas détaillés de requête ou de réponse ;
les codes de réponse y sont indicatifs.
Les chemins ci-dessous sont relatifs à `/api/v1/channels/{channelId}`.

| Opération | Méthode et chemin | Données principales |
|---|---|---|
| Contexte | `GET /context` | Renvoie `mode`, `permissions`, `writable`, `expired`, `suspended`, `timedOut`. |
| Réglages | `PATCH /` | `name` (50 caractères), `description` (200), `expiresAt` (date ISO avec fuseau). Au moins un champ. |
| Suppression | `DELETE /` | `confirm` : nom exact du salon. |
| Accès | `GET /access`, `POST /access` | Lecture de l’état ou demande avec `reason` facultatif (1 000 caractères). |
| Décision d’accès | `PATCH /access/{userId}` | `status` : `approved` ou `declined`. |
| Parole | `PATCH /speakers/{userId}` | `speaking` : booléen. |
| File de tickets | `GET /tickets` | `status` facultatif, `search` (100 caractères), `page` à partir de zéro, `limit` plafonné à 50 par le service ; réponse avec `hasMore`. |
| Ouvrir un ticket | `POST /tickets` | `title` (140 caractères), `body` (3 400), `priority` facultative. |
| Lire et répondre | `GET /tickets/{ticketId}`, `POST /tickets/{ticketId}/messages` | Réponse : `body` (3 400 caractères), `internal` booléen, faux par défaut. |
| Traiter un ticket | `PATCH /tickets/{ticketId}`, `PATCH /tickets/{ticketId}/status`, `PATCH /tickets/{ticketId}/assignee` | Respectivement `priority`, `status`, `assigneeId` ou `null`. |
| Responsables de tickets | `GET /ticket-assignees` | Membres autorisés, accessible à l’équipe. |
| Modifier un sujet | `PATCH /threads/{messageId}` | `title` facultatif (100 caractères), `resolved` facultatif ; au moins un champ. |
| Modifier une tâche | `PATCH /tasks/{taskId}` | `title`, `details`, `status`, `assigneeId`, `dueAt`, `position` ; au moins un champ. |
| Modifier un événement | `PATCH /events/{eventId}` | `title`, `description`, `location`, `startsAt`, `endsAt` ; au moins un champ. |
| Répondre à un événement | `PUT /events/{eventId}/response` | `response` : `going`, `maybe` ou `no`. |
| Modifier une page | `PATCH /documents/{documentId}` | `title` (160 caractères) ou `body` (100 000), `summary` facultatif (200), `baseRevisionId` facultatif. Réponse `409` si la révision de départ est dépassée. |
| Lire une révision | `GET /documents/{documentId}/history/{revisionId}` | Titre, contenu, résumé et date de la révision. |
| Restaurer une page | `POST /documents/{documentId}/restore` | `revisionId`. |

Les identifiants de messages et de racines de fils sont des chaînes décimales
Snowflake ; ne les convertissez pas en nombres JavaScript. Les autorisations
restent vérifiées par le serveur pour chaque opération, même si le client dispose
d’un contexte de permissions. Les exports texte et calendrier n’ajoutent pas de
route de téléchargement à l’API.
