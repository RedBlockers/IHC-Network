# NoScord - [1.0.2]

**NoScord** est une application de chat en temps réel développée avec Node.js, Express, MySQL et Socket.IO. Ce projet permet de discuter en temps réel à travers des serveurs et des discussions privées. Le formatage Markdown permet une conversation plus ergonomique et agréable.

## Fonctionnalités

### Chat en temps réel

NoScord offre une expérience de chat instantané, améliorant la fluidité des conversations.

### Utilisation de guildes

La création et l'utilisation de guildes permettent une meilleure organisation des communautés.

### Gestion des amis

Ajoutez des amis et conversez avec eux dans des salons privés.

## Technologies Utilisées

-   **Backend** : Node.js, Express.js, MySQL, Socket.IO
-   **Frontend** : Bootstrap, Axios
-   **Authentification** : JSON Web Tokens (JWT), bcrypt pour le hachage des mots de passe
-   **Base de données** : MySQL
-   **Contrôle de version** : Git

## Démarrage

### Prérequis

-   Node.js (v14 ou plus)
-   Serveur MySQL
-   Certificats SSL (optionnel, mais recommandé pour HTTPS)

### Installation

1. **Cloner le dépôt :**

    ```bash
    git clone https://github.com/RedBlockers/IHC-Network.git
    cd noscord
    ```

2. **Installer les dépendances :**

    ```bash
    npm install
    ```

3. **Configurer l'environnement :**

    - Connectez-vous à votre serveur MySQL ou créez-en un.
    - Créez une base de données MySQL.
    - Créez un fichier `.env` avec vos informations de connexion.
      Exemple de fichier `.env` :

    ```env
    DB_HOST=XX.XX.XX.XX
    DB_USER=ADMIN
    DB_PASSWORD=CHANGE_ME
    DB_DATABASE=YOUR_DATABASE

    # App config
    HTTP_PORT=80
    HTTPS_PORT=443
    HOSTNAME=http://YOUR_HOST.com
    USE_SSL=false

    # SSL config
    SSL_KEY_PATH=
    SSL_CERT_PATH=
    SSL_CA_PATH=

    # Configuration Token
    SECRET_KEY=TOKEN_POUR_JWT
    ```

4. **Lancer l'application :**
    ```bash
    node server.js
    ```

## Configuration SSL

Pour activer SSL pour des connexions sécurisées :

1. Obtenez un certificat SSL (par exemple via Let's Encrypt).
2. Mettez à jour la configuration du serveur pour utiliser HTTPS.
3. Redémarrez le serveur.

## A Venir

-   Téléchargement de fichiers
-   Permissions de guilde
-   Permissions de channels
-   Application desktop
-   Vérification de l'adresse mail

## Contribution

N'hésitez pas à forker ce projet, à apporter des modifications et à soumettre une pull request !

## Licence

Ce projet est sous licence MIT - voir le fichier `LICENCE` pour plus de détails.
