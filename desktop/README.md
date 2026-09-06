# Application de bureau

Le client Electron permet de choisir une instance publique ou auto-hébergée.
Sans adresse préconfigurée, il ouvre le sélecteur d’instances. Ce sélecteur reste
accessible dans le menu Qweillo et s’affiche lorsqu’une instance est indisponible.

Chaque origine utilise une partition distincte pour les cookies et le stockage.
Les permissions du micro, de la caméra et du partage d’écran sont limitées à
l’instance ouverte. Le navigateur intégré n’a pas accès à Node.js.

## Développement

```sh
npm ci
npm start
```

`npm start` installe le moteur Electron si nécessaire et ouvre le sélecteur d’instances.
Pour ouvrir directement une instance locale :

```sh
QWEILLO_PUBLIC_URL=http://localhost:5173 npm start
```

Sous Linux, un lancement depuis les sources nécessite le mécanisme de sandbox
Chromium fourni par Electron. Sur un système qui restreint les espaces de noms
utilisateurs, le helper `node_modules/electron/dist/chrome-sandbox` doit appartenir
à root et avoir le mode `4755`. Le paquet Debian installe le profil AppArmor
prévu par Electron Builder ; privilégiez ce paquet pour une utilisation normale.

## Construction

```sh
npm run build:windows
npm run build:linux
npm run build:mac
```

La construction macOS se fait sur macOS. Pour proposer une instance par défaut,
définissez `QWEILLO_PUBLIC_URL=https://communaute.exemple.fr` pendant la construction.
Cette adresse est facultative et peut être changée ensuite avec le sélecteur.
Une adresse distante doit utiliser HTTPS ; une instance sur localhost peut
utiliser HTTP.

`runtime-config.json` est créé lors de la construction et n’est pas versionné.
Les paquets sont écrits dans `dist/`. Avant distribution, exécutez `npm test`
et publiez les empreintes des fichiers. La signature des exécutables requiert
les certificats du distributeur ; aucun certificat n’est fourni avec les sources.
