# Auto-hébergement

Une installation contient ses comptes, ses communautés, sa base et ses fichiers.
Elle fonctionne indépendamment des autres instances de Qweillo. Le menu Instances
permet de passer de l’une à l’autre ; il ne partage pas les comptes entre serveurs.

## Essai sur votre ordinateur

Docker doit être installé et démarré. Utilisez Docker Desktop sur Windows/macOS,
ou Docker Engine et Compose récent sur Linux. Le profil Internet utilise Linux.
Node.js n’est pas requis : s’il manque, l’assistant s’exécute dans un conteneur
temporaire, supprimé à la fin de la configuration.

Sur Linux ou macOS, une commande télécharge Qweillo dans `~/qweillo` et ouvre
l’assistant :

```sh
curl -fsSL https://raw.githubusercontent.com/RedBlockers/qweillo/dev-leka/scripts/install.sh | sh
```

Sur Windows, ouvrez PowerShell :

```powershell
irm https://raw.githubusercontent.com/RedBlockers/qweillo/dev-leka/scripts/install.ps1 | iex
```

Ces commandes ciblent la branche `dev-leka`. Si ce dossier contient déjà Qweillo,
elles ouvrent son menu de gestion et conservent sa configuration. Pour choisir
un autre dossier, définissez `QWEILLO_INSTALL_DIR` avant de lancer la commande.

Depuis les sources, lancez `./qweillo` ou `powershell -ExecutionPolicy Bypass -File .\qweillo.ps1`.
Choisissez avec les flèches **↑ ↓**, validez avec **Entrée** et quittez avec
**Échap** ou **Ctrl+C**. L’assistant demande un nom, le mode d’accès et le port
ou les domaines, puis présente un récapitulatif avant d’installer. Il prépare :

- secrets de session, mots de passe de base et accès du serveur vocal ;
- MySQL, Redis, deux processus d’API, client web et LiveKit ;
- volumes persistants et migrations de la base ;
- configuration du vocal et adresses de connexion.

Ouvrez l’adresse affichée (`http://localhost:8080` par défaut), créez un compte,
puis une communauté.
`localhost` est utilisable avec le micro, la caméra et les fonctions cryptographiques
du navigateur. Son adresse ne désigne que l’ordinateur sur lequel elle est ouverte :
un téléphone scannant ce QR code chercherait une instance sur le téléphone lui-même.

Pour choisir un autre port sans répondre aux questions :

```sh
./qweillo --yes --name "Notre atelier" --url http://localhost:8090
```

Les options `--name` et `--url` permettent aussi de renommer une installation ou
de changer son port local, en conservant ses secrets et ses données. L’ancienne
configuration est sauvegardée dans `.runtime/`. Choisissez une adresse stable
avant d’utiliser les salons chiffrés : le stockage des clés du navigateur est
lié à cette adresse.

La configuration est conservée dans `.env`, avec des permissions restreintes.
Les clés privées du chiffrement des conversations sont créées et conservées sur
les appareils ; l’administrateur ne les configure pas.
Une interruption avant la validation finale ne crée aucune configuration.
Si la construction échoue après cette validation, relancez `./qweillo` : les
secrets déjà générés sont conservés. Le détail du démarrage est disponible dans
`.runtime/install.log`.

## Gérer une installation

Relancez `./qweillo` dans son dossier, ou `qweillo.ps1` sur Windows. Le menu propose
le démarrage, l’état des services, une sauvegarde, la configuration du courrier,
le changement de nom, l’arrêt et la sortie. L’arrêt demande une confirmation.
Les modifications de configuration sauvegardent l’ancienne version dans
`.runtime/config-<date>.env` et conservent les autres secrets.

Les actions sont aussi accessibles sans menu :

```sh
./qweillo --action status
./qweillo --action backup
./qweillo --action stop
./qweillo --yes
```

`--yes` démarre une installation existante ou crée un essai local avec les
valeurs par défaut. Pour une installation Internet sans questions, ajoutez
`--yes` à la commande contenant vos domaines. Les mêmes options sont reconnues
par `qweillo.ps1`, limité au profil local.

## Instance sur Internet

Prévoyez un serveur Linux et deux noms de domaine : un pour l’application,
un pour le vocal et la vidéo. Faites pointer leurs enregistrements DNS A vers
l’adresse IPv4 du serveur. Le premier lancement peut ensuite être guidé :

```sh
./qweillo
```

Choisissez l’accès Internet et indiquez les deux domaines. Vous pouvez aussi lancer :

```sh
./qweillo --name "Notre communauté" --url https://chat.exemple.fr --media-domain media.exemple.fr
```

Caddy obtient et renouvelle les certificats HTTPS. LiveKit utilise le domaine média
et l’adresse IPv4 résolue depuis le domaine de l’application. `--node-ip` permet
de choisir une autre IPv4 lorsqu’un proxy DNS masque l’adresse du serveur.

Si nginx, Caddy ou Traefik utilise déjà les ports 80 et 443, choisissez **proxy
existant** dans l’assistant ou ajoutez `--external-proxy`. Orientez le proxy vers
`127.0.0.1:8080` pour l’application et `127.0.0.1:7880` pour LiveKit. Votre proxy
doit terminer HTTPS pour les deux domaines et transmettre les connexions
WebSocket. Les ports média ci-dessous restent nécessaires. L’assistant ne
reconfigure pas votre proxy. Les options réseau d’une première installation
ne remplacent pas silencieusement celles d’une instance existante.

Ouvrez ces ports dans le pare-feu du serveur et, si nécessaire, sur le routeur :

| Ports | Usage |
|---|---|
| TCP 80, 443 | HTTPS et validation des certificats |
| UDP 443 | HTTP/3 |
| TCP 7881 | transport média de secours |
| UDP 3478 | relais TURN |
| UDP 50000–50200 | transport média et relais |

MySQL et Redis ne sont pas exposés publiquement. Les répertoires durables sont
préparés dans `runtime/data/`, avec les propriétaires nécessaires aux conteneurs.
Les domaines doivent atteindre ce serveur pour que les certificats soient émis.
Un accès HTTP sur une adresse de réseau local ne remplace pas HTTPS pour le micro,
la caméra ou le chiffrement dans les navigateurs.

## Inviter et changer d’instance

Le bouton **Instances** affiche l’adresse actuelle et son QR code. L’adresse peut
être copiée, saisie dans une autre application Qweillo ou reconnue par le scanner.
Une image QR enregistrée peut également être importée. L’adresse reconnue est
présentée avant la connexion.

Pour rejoindre une communauté précise, utilisez son lien d’invitation. Une personne
qui arrive sur une autre instance crée un compte sur celle-ci. Le client bureau
conserve les instances utilisées et sépare cookies, stockage et permissions.

## Courrier sortant

Le courrier est facultatif pour démarrer et tester. La vérification d’adresse,
la récupération du mot de passe et les alertes par e-mail nécessitent un serveur SMTP.
Relancez `./qweillo` et choisissez **Configurer l’envoi des e-mails**. Le menu
propose les ports courants et un port personnalisé. Le mot de passe est masqué ;
laissez-le vide pour conserver celui du même compte sur le même serveur SMTP.
La configuration est appliquée au redémarrage automatique des services.
Ces valeurs peuvent aussi être renseignées dans `.env`, avant de relancer :

| Variable | Valeur |
|---|---|
| `SMTP_HOST` | nom du serveur SMTP |
| `SMTP_PORT` | généralement `587` ou `465` |
| `SMTP_USER`, `SMTP_PASSWORD` | identifiants fournis par votre hébergeur de courrier |
| `MAIL_FROM` | adresse d’expédition autorisée, par exemple `Qweillo <contact@exemple.fr>` |

Les liens utilisent `PUBLIC_URL`. Les messages et les liens de récupération ne
sont pas écrits dans les journaux quand aucun SMTP n’est configuré.
Les notifications push et le stockage S3 restent optionnels ; leurs variables
figurent dans `.env.example`.

## Arrêt et relance

Utilisez le menu ou les commandes suivantes, avec le même dossier d’installation :

```sh
./qweillo --action stop
./qweillo --yes
```

L’assistant choisit automatiquement les fichiers Compose du profil installé.
Il conserve les données lors de l’arrêt. Une commande Docker manuelle
`down -v` supprime les données des volumes nommés ; elle n’est jamais utilisée
par l’assistant.

## Sauvegarde et conservation des clés

Le menu **Créer une sauvegarde** écrit un dossier daté dans `backups/` contenant
la base, les fichiers envoyés, les fichiers de contrôle et `configuration.env`,
copie de la configuration `.env` avec ses secrets. `SHA256SUMS` permet de vérifier
l’intégrité des fichiers. La base et le serveur doivent être en marche pour
créer la sauvegarde. Conservez ce dossier dans un emplacement privé : il permet
de restaurer l’instance et contient ses identifiants.

Lors d’une restauration, copiez `configuration.env` vers `.env` dans les sources
compatibles avant de lancer Qweillo, puis restaurez la base et les fichiers selon
le [guide d’exploitation](operations.md). Ce fichier conserve les secrets de
session, de base, de notifications et de voix, ainsi que le nom du projet Compose.
Si vous changez de dossier, adaptez `QWEILLO_DATA_DIR` pour le profil Internet et
replacez-y les données ; ne laissez pas ce chemin pointer vers une autre instance.

Conserver `PUBLIC_URL` évite de changer l’origine utilisée par les navigateurs.
Les clés privées des salons chiffrés restent sur les appareils des membres :
la sauvegarde serveur ne les contient pas et ne remplace pas leur conservation.

## Mise à jour

Sauvegardez d’abord, puis récupérez la version souhaitée et relancez `./qweillo`.
Les migrations manquantes sont appliquées automatiquement. Avec un clone Git :

```sh
./qweillo --action backup
git pull --ff-only
./qweillo --yes
```

Avec l’archive téléchargée par l’installeur, téléchargez la nouvelle version dans
un dossier séparé. Conservez `.env` et les données de `runtime/data/` pour le profil
Internet ; pour le profil local, conservez le nom du projet Compose et ses volumes.
Ne remplacez pas une installation qui fonctionne sans sauvegarde.
Le choix **Démarrer ou mettre à jour** reconstruit les sources présentes dans le
dossier ; il ne télécharge pas une nouvelle version à lui seul.

Voir [Exploitation](operations.md) pour vérifier une sauvegarde et préparer
le retour à une version antérieure.
