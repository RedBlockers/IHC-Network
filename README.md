# Qweillo

Qweillo est une plateforme de communautés : salons texte, vocal et vidéo,
messages privés, rôles, permissions et outils de collaboration.

Chaque instance est autonome. Vous pouvez héberger la vôtre sur votre ordinateur
ou sur un serveur, puis inviter les personnes de votre choix. Une instance publique
utilise le même logiciel ; les comptes et les données restent propres à chaque instance.

## Essayer en une commande

Installez et démarrez Docker Desktop sur Windows ou macOS, ou Docker Engine avec
Compose sur Linux. L’installation télécharge Qweillo, génère les secrets et démarre
la base, le stockage, les services de messagerie et le serveur vocal.

**Linux et macOS**

```sh
curl -fsSL https://raw.githubusercontent.com/RedBlockers/qweillo/dev-leka/scripts/install.sh | sh
```

**Windows — PowerShell**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/RedBlockers/qweillo/dev-leka/scripts/install.ps1 | iex"
```

L’installation locale s’ouvre sur `http://localhost:8080`. Créez votre compte,
puis votre première communauté. Aucun fichier de configuration ni aucune clé
cryptographique ne sont à saisir pour cet essai. Les clés du chiffrement de bout
en bout sont générées automatiquement sur les appareils.

Le menu **Instances**, disponible avant et après connexion, permet de saisir une
adresse, scanner un QR code ou lire une image QR. Le client bureau conserve les
instances utilisées et isole leurs sessions.

Pour une instance accessible à d’autres appareils, le menu Linux propose le
profil Internet : deux domaines, HTTPS automatique et serveur média intégré,
ou raccordement à un proxy HTTPS existant.
Voir [l’auto-hébergement](docs/self-hosting.md) pour les domaines, le réseau et
le courrier sortant facultatif.

## Depuis les sources

```sh
git clone --branch dev-leka https://github.com/RedBlockers/qweillo.git
cd qweillo
./qweillo
```

Sous Windows : `powershell -ExecutionPolicy Bypass -File .\qweillo.ps1`.
La commande ouvre un menu utilisable avec les flèches, Entrée et Échap. Au premier
lancement, choisissez le nom de l’instance et son profil réseau. La configuration
`.env` et les secrets sont générés automatiquement.

Relancer la même commande conserve la configuration et les données, et permet de
démarrer ou mettre à jour les services, consulter leur état, sauvegarder, régler
le courrier sortant, renommer l’instance ou l’arrêter. Docker reste requis ; Node.js
est utilisé dans un conteneur si une version locale adaptée n’est pas disponible.

## Fonctionnalités

| Domaine | Contenu |
|---|---|
| Comptes | sessions révocables, vérification d’adresse, récupération du mot de passe, double authentification avec codes de secours, clés WebAuthn, export et suppression |
| Communautés | invitations, catégories, rôles et permissions par salon, règlement et questionnaire d’accueil, modération, thèmes et bannières |
| Salons | [24 types](docs/channel-types.md), du texte aux scènes, forums, tickets privés, tâches, documents, événements, galeries et accès sur validation |
| Conversations | Markdown, réponses, fils, réactions, mentions, épingles, fichiers, messages vocaux, brouillons et file d’envoi hors ligne |
| Confidentialité | chiffrement de bout en bout des messages dans les salons compatibles, échange de clés hybride post-quantique, détection de secrets avant envoi, blocage et signalements |
| Média | voix, caméra, partage d’écran, main levée, sous-titres navigateur, enregistrement local et soundboard |
| Profils | six décorations d’avatar animées, aperçu dans les réglages et respect de la réduction des animations |
| Intégrations | webhooks, bots, activités embarquées, notifications push et recherche |
| Exploitation | menu terminal, Docker, migrations versionnées, sondes de santé, métriques, maintenance, sauvegarde des données et de la configuration, exercice de restauration |

Les tickets proposent des échanges privés avec l’équipe, des notes internes, un
responsable, une priorité, quatre statuts, une recherche et un export texte.
Les pages gardent un historique consultable et restaurable ; les tâches suivent
leur responsable et leur échéance ; les événements et réunions proposent les
réponses de présence et l’export calendrier.

Les contenus structurés — tickets, tâches, documents, événements, réunions et
sondages — ne sont pas chiffrés de bout en bout. Leur accès dépend des permissions
de l’instance. L’option de chiffrement des messages est désactivée pour ces types
de salons ; elle ne chiffre ni la base de données ni les sauvegardes.

## Développement

Node.js 22, MySQL 8 et Redis. Les dépendances sont verrouillées avec npm.

```sh
cd backend
npm ci
cp .env.example .env
npm run migrate
npm run dev
```

Dans un autre terminal :

```sh
cd frontend
npm ci
npm run dev
```

Le client sur `http://localhost:5173` transmet l’API, le temps réel et les fichiers
à `http://localhost:3000`.

## Vérifications

```sh
cd backend && npm run lint && npm test
cd frontend && npm run lint && npm test && npm run build
cd desktop && npm test
```

Les parcours Playwright exercent une pile Docker réelle, notamment les comptes,
les permissions, les messages, les fichiers, le chiffrement, les types de salons
et le média. Le parcours du menu terminal utilise un pseudo-terminal Linux sans
démarrer Docker.
Instructions dans [le guide d’exploitation](docs/operations.md).

## Structure

| Répertoire | Contenu |
|---|---|
| `backend/` | API Express, MySQL, Redis et Socket.IO |
| `frontend/` | client React et Vite |
| `desktop/` | application Electron |
| `cli/` | intégration Git des espaces de développement |
| `infra/` | Caddy, LiveKit et exploitation |
| `scripts/` | installation, sauvegarde et restauration |
| `e2e/` | parcours navigateur |

[Architecture](ARCHITECTURE.md) · [Auto-hébergement](docs/self-hosting.md) ·
[Exploitation](docs/operations.md) · [API](docs/openapi.json) ·
[Application de bureau](desktop/README.md)

## Licence

[MIT](LICENCE.md).
