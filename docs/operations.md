# Exploitation

## État de l’instance

Relancez `./qweillo` et choisissez **Voir l’état des services**. Le même menu donne accès
au démarrage, à la sauvegarde, au courrier sortant, au nom de l’instance et à
l’arrêt des services. Sur Windows, utilisez
`powershell -ExecutionPolicy Bypass -File .\qweillo.ps1`.

Les actions courantes sont aussi accessibles sans menu :

```sh
./qweillo --action status
./qweillo --action start
./qweillo --action backup
./qweillo --action stop
```

Pour lire les détails des conteneurs locaux :

```sh
docker compose ps
docker compose logs --tail 100 api1
```

Pour le profil Internet, ajoutez `-f docker-compose.yml -f docker-compose.production.yml`
aux commandes Compose. Le profil avec proxy existant ajoute également
`-f docker-compose.external-proxy.yml`. Le menu sélectionne ces fichiers à partir
de la configuration conservée. Le point `/api/v1/status` décrit l’instance et la maintenance.
Les sondes `/healthz`, `/readyz` et `/metrics` sont réservées au réseau interne.

## Fichiers et capacité de stockage

L’API limite chaque pièce jointe à 2 Gio par défaut (`MAX_ATTACHMENT_BYTES=2147483648`).
Les avatars, icônes et bannières gardent leur limite de 5 Mio par image. Le proxy
fourni réserve 2 049 Mio au corps d’une requête de pièce jointe et 11 Mio aux
formulaires contenant deux images, enveloppe multipart comprise ; les autres
requêtes restent limitées à 6 Mio. Il transmet les envois à l’API sans mettre
leur corps complet en tampon sur disque.

Avec Compose, les fichiers temporaires se trouvent dans `/data/uploads/.tmp`,
sur le volume de stockage partagé par les API. Le tmpfs de 64 Mio de l’API et
celui de 16 Mio du proxy ne servent pas à contenir un fichier complet. Hors
Compose, choisissez avec `UPLOAD_TMP_DIR` un disque suffisamment grand ; toutes
les API d’une même instance doivent partager ce répertoire et la même base.

L’instance admet **quatre envois de pièces jointes simultanés**. Avant de recevoir
le fichier, elle réserve sa taille annoncée, l’espace d’une seconde copie en
stockage local et une marge libre de **16 Mio**. Un envoi sans `Content-Length`
réserve le plafond de fichier entier. Les réservations concurrentes comptent
aussi dans le quota de 5 Gio par communauté. Ces contrôles sont conservateurs :
un envoi peut être refusé tant qu’un autre n’a pas libéré sa réservation. La
limite de concurrence et la marge disque sont fixes dans cette version.

Une limite de taille renvoie `413`, quatre transferts déjà actifs renvoient `429`,
et un manque de disque ou de quota renvoie `507`, avec un message lisible dans le
client. Les refus, erreurs et interruptions libèrent les temporaires. Après la
perte d’une connexion de réservation, l’envoi suivant récupère son répertoire
orphelin ; les réservations encore actives sont conservées.

Les fichiers actifs tels que HTML, SVG et JavaScript sont servis en téléchargement
avec un type binaire ; le service local ajoute `nosniff` et une politique sandbox.
Les images usuelles, l’audio, la vidéo et les PDF gardent leurs aperçus. Les objets
S3 nouvellement envoyés portent leur type et leur disposition ; les métadonnées
des anciens objets S3 ne sont pas réécrites automatiquement.

Un proxy supplémentaire ou un CDN peut imposer un plafond inférieur au plafond
interne. Cloudflare annonce 100 Mo pour Free et Pro, 200 Mo pour Business, et
jusqu’à 5 Go configurables pour Enterprise ; le réglage de la zone peut être
inférieur. Vérifiez l’offre et la valeur réellement appliquées à votre domaine
dans la [documentation Cloudflare](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/4xx-client-error/error-413/).
Chaque fichier est envoyé dans une seule requête : le plafond interne de 2 Gio
ne garantit donc pas un envoi public de cette taille. Si vous changez le plafond
de l’API, alignez aussi les limites des proxies présents sur le chemin.

## Maintenance

Écrivez le message à afficher dans `infra/control/maintenance` pour une installation
locale, ou dans `runtime/data/control/maintenance` avec le profil Internet :

```sh
printf '%s\n' 'Maintenance en cours. Retour dans quelques minutes.' > infra/control/maintenance
```

Retirer ce fichier rouvre le service. Les sondes de santé continuent de répondre.

## Sauvegarde

Choisissez **Créer une sauvegarde** dans `./qweillo`, ou lancez
`./qweillo --action backup`. Depuis une installation Linux ou macOS, le script
accepte aussi un répertoire de destination :

```sh
./scripts/backup.sh
```

La sauvegarde contient la base (`qweillo.sql.gz`), les fichiers envoyés
(`uploads.tar.gz`), le contrôle de maintenance (`control.tar.gz`), une copie de
`.env` (`configuration.env`) et les sommes SHA-256. Elle lit les volumes réellement
montés dans les conteneurs ; elle fonctionne aussi avec les répertoires du profil Internet.
Le répertoire temporaire `uploads/.tmp` est exclu de l’archive de fichiers.

Le répertoire par défaut est `backups/` dans l’installation. Passez un autre chemin
en argument pour conserver les archives sur un autre support. `QWEILLO_STACK`,
`QWEILLO_ENV_FILE` et `QWEILLO_PROJECT_NAME` permettent de viser une installation
ou un nom de projet Compose différents. Les secrets ne sont pas placés dans les
arguments de commande de MySQL.

La configuration sauvegardée contient les secrets de l’instance. Le script
restreint ses permissions au compte courant ; conservez le répertoire de
sauvegarde sur un support privé. Ces fichiers ne sont pas chiffrés par le script.

Mettez l’instance en maintenance pour obtenir une sauvegarde sans modification
simultanée des conversations ou des fichiers. Les objets d’un stockage S3 externe
se sauvegardent auprès du fournisseur de stockage. Conservez également les
configurations du proxy externe et les éventuelles adaptations faites hors de
`.env` : elles ne sont pas incluses dans la sauvegarde.

## Vérifier une restauration

```sh
./scripts/restore-drill.sh backups/AAAAmmjj-HHMMSS
```

Le script vérifie les empreintes, restaure la base dans un schéma temporaire,
interroge les principales tables et supprime ce schéma. Il ne remplace pas la base
en service. Une sauvegarde d’une ancienne version contenant `CREATE DATABASE`
ou `USE` est refusée pour éviter de cibler la base active.

L’exercice vérifie aussi la lisibilité des archives de fichiers. Une restauration
complète doit remettre `uploads/` dans le stockage utilisé par l’API, avec ses
permissions, restaurer la base correspondante et remettre `configuration.env`
comme `.env` avant le démarrage. Cela conserve les secrets et le nom du projet
Compose. Les anciennes sauvegardes dépourvues de `configuration.env` nécessitent
la copie de configuration conservée séparément. Les clés privées conservées sur
les appareils ne sont pas contenues dans la sauvegarde serveur.

## Mise à jour et retour arrière

Conservez l’ancienne version des sources et une sauvegarde des données et de la
configuration. Après remplacement des sources par la version souhaitée, choisissez
**Démarrer ou mettre à jour** dans `./qweillo`, ou utilisez `./qweillo --action start`.
Cette action reconstruit les sources présentes, applique les migrations manquantes
et relance les services ; elle ne télécharge pas une nouvelle version de Git.
Si une migration rend la base incompatible avec l’ancienne version, revenir au
code précédent seul ne suffit pas : restaurez
la sauvegarde correspondante pendant la maintenance.

La migration `053_channel_workflows.sql` ajoute les priorités des tickets, les
demandes d’accès, les dates de fermeture, la résolution des sujets et les titres
des révisions de documents. Les salons temporaires existants sans échéance
reçoivent une fermeture 24 heures après la migration ; les salons sur validation
restreignent le rôle par défaut et les scènes retirent à ce rôle la publication
audio, caméra et écran. Vérifiez les droits des rôles personnalisés selon l’usage
de l’instance. La suppression d’un message racine supprime désormais les réponses
de son fil. Les révisions de documents antérieures à cette migration ne possèdent
pas leur ancien titre : leur restauration conserve alors le titre courant.

## Comptes

Une demande de suppression exige le mot de passe et ferme les sessions. Un
propriétaire doit transférer ou supprimer ses communautés auparavant. Une connexion
réussie pendant les 30 jours de délai annule la demande. Les échéances sont traitées
au démarrage de l’API, puis toutes les heures, même sans reconnexion de l’utilisateur.

## Parcours navigateur

Utilisez une pile dédiée avec des données de test. Python et Playwright sont requis :

```sh
./scripts/setup.sh --yes
python3 -m venv .runtime/e2e
.runtime/e2e/bin/pip install -r e2e/requirements.txt
.runtime/e2e/bin/playwright install chromium
docker compose -p qweillo-e2e -f docker-compose.yml -f e2e/docker-compose.e2e.yml up -d --build --wait
BASE_URL=http://127.0.0.1:18888 .runtime/e2e/bin/python e2e/core_flow.py
```

Les autres parcours sont `avatar_cropper_flow`, `channel_permissions_flow`,
`roles_notifications_flow`, `e2ee_two_browsers`, `media_flow`,
`account_security_flow`, `settings_instances_flow` et `guild_lifecycle_flow`.
`attachment_composer_flow` retient les transferts pour vérifier que le clic et la
touche Entrée attendent toutes les pièces jointes, puis vérifie leur interruption
au changement de salon.

`channel_types_flow` exerce les parcours des salons spécialisés, les échanges
de tickets entre comptes et leurs restrictions d’accès.
`stage_flow` vérifie le public en écoute, la main levée, l’attribution et le retrait
de la parole, le retour en public après reconnexion et la caméra d’un salon vidéo.
Le courrier de cette pile est capturé localement par Mailpit, sur le port 18025.
Le parcours d’instances accepte `SECOND_BASE_URL` pour vérifier le passage vers
une seconde installation indépendante.

Arrêtez la pile à la fin :

```sh
docker compose -p qweillo-e2e -f docker-compose.yml -f e2e/docker-compose.e2e.yml down
```

Les tests média emploient une caméra et un écran synthétiques, avec un vrai
transport LiveKit entre navigateurs. Ils mesurent les paquets audio et les images
vidéo reçus ; le parcours média vérifie aussi que l’audio continue lorsque l’on
navigue vers un salon texte. Ils ne remplacent pas un essai sur les
périphériques et les réseaux qui seront utilisés en production.

## Parcours du menu terminal

Sur Linux avec Node.js 22 et Python, le test utilise un pseudo-terminal et des
répertoires temporaires, sans démarrer Docker :

```sh
python3 e2e/installer_terminal_flow.py
```

Il vérifie notamment la navigation au clavier, la création et la conservation de
la configuration, l’annulation et la saisie masquée du mot de passe SMTP. Les
artefacts sont écrits dans `/tmp/qweillo-installer-check`, ou dans `ARTIFACT_DIR`
si cette variable est définie. Ce parcours vérifie le menu ; les installations
Docker et les accès depuis Internet demandent leurs contrôles réseau respectifs.
