# Architecture

## Vue d'ensemble

```
navigateurs ──▶ edge (Caddy TLS) ──▶ nginx ──▶ api1 / api2 … apiN
                                                   │        │
                                               Redis      MySQL
                                        (coordination)  (données)
                       media.<domaine> ──▶ LiveKit (SFU)
```

Les instances d'API sont sans état : tout ce qui doit être partagé vit dans
Redis (présence, cache, limitation de débit, adaptateur Socket.IO) ou dans
MySQL (source de vérité). On ajoute une instance sans reconfigurer les autres.

## Chemin d'un message

1. `POST /api/v1/channels/:id/messages` sur une instance quelconque.
2. `authenticate` valide le JWT ; le compte est lu depuis le cache Redis (10 s).
3. `requireChannelAccess` vérifie en une requête indexée l'accès au salon
   (membre de la communauté ou partie de la conversation privée).
4. Les barrières d'écriture s'appliquent dans l'ordre : mode du salon, blocage,
   sanction active, onboarding ou quarantaine, filtres automatiques, masquage
   des secrets (`backend/tests/helpers/writePath.js` les recense).
5. Le message reçoit un identifiant Snowflake généré en mémoire et est inséré.
6. L'émission part dans la room `channel:<id>` ; l'adaptateur Redis la propage
   à toutes les instances.

## Décisions

**Sessions.** Jetons d'accès courts (15 min) et jetons de renouvellement
rotatifs par famille ; la réutilisation d'un jeton révoque la famille entière.
Le JWT porte la date de dernier changement de mot de passe : un changement
invalide immédiatement tous les jetons antérieurs.

**Identifiants Snowflake.** 64 bits `timestamp | nœud | séquence`, triés par le
temps. La pagination se fait par curseur (`WHERE messageId < ?`), sans `OFFSET`
ni `COUNT`. Les identifiants transitent en chaînes.

**Autorisation centralisée.** `accessService.resolveChannelAccess` décide de
l'accès à un salon, HTTP et WebSocket compris. Les permissions par rôle et par
salon se résolvent selon la règle refus explicite > autorisation explicite >
héritage > défaut (`channelPermissionService`).

**MySQL.** Pool borné par instance, requêtes préparées, index composites sur
les accès chauds (`messages(channelId, messageId)`, `guild_members(guildId,
userId)`). Les invariants sont dans le schéma : clés étrangères, `CHECK`, unicité.

**Chiffrement de bout en bout.** Le serveur ne détient que des clés publiques
d'appareils et des clés de salon enveloppées pour un appareil précis. Une époque
de clé est ouverte à chaque changement de composition du salon. La recherche,
les aperçus et le texte des notifications ne voient pas le contenu chiffré.

**Média.** L'API vérifie l'accès au salon vocal puis émet un jeton LiveKit de
courte durée ; la clé LiveKit ne quitte jamais le serveur. Le client active
`adaptiveStream` et `dynacast`, choisit le codec selon le navigateur, borne la
caméra à 720p/30 et l'écran à 1080p/15.

**Modes de salon.** `backend/src/domain/channelModes.js` décrit chaque type
(texte, forum, vocal, scène, vidéo, événements, tickets, tâches, documents,
worktrees, personnalisés). Ajouter un type n'oblige pas à toucher le chemin
d'écriture des messages.

**Salons de développement.** Un salon `development` suit des worktrees Git :
le serveur stocke ce que la CLI lui pousse (branche, diff, pipeline, revues,
décisions) et n'exécute jamais Git lui-même.

## Exploitation

- `/healthz` : vivacité, sans dépendance. `/readyz` : MySQL, Redis et joignabilité TURN.
- `/metrics` : Prometheus (latence par route, messages émis, sockets, lag de l'event loop), réseau interne seulement.
- Arrêt gracieux sur `SIGTERM` : plus de nouvelles connexions, drainage, fermeture du temps réel puis des pools.
- Chaque requête porte un `X-Request-Id` propagé aux journaux ; aucune donnée personnelle n'y est écrite.
- Mode maintenance par fichier posé sur l'hôte (`infra/control/maintenance`), lu par les instances sans redémarrage.

## Montée en charge

| Ressource | Levier |
|---|---|
| Connexions temps réel | ajouter des instances d'API |
| Lectures d'authentification | cache Redis, TTL ajustable |
| Écritures de messages | réplicas en lecture, puis partitionnement par salon (les Snowflake n'exigent pas d'auto-incrément central) |
| Diffusion | Redis en cluster, adaptateur partitionné |
| Média | plusieurs nœuds LiveKit derrière Redis |
