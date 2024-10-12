# NoScord - Application de Chat

NoScord est une application de chat anonyme développée avec Node.js, Express, MySQL et Socket.IO. Ce projet permet aux utilisateurs de discuter en temps réel avec prise en charge du formatage Markdown, des messages multi-lignes, ainsi que la possibilité de modifier et supprimer des messages. L'authentification est gérée via des JWT, et l'interface est construite avec Bootstrap.

## Fonctionnalités

- Chat en temps réel avec Socket.IO
- Authentification des utilisateurs avec des tokens JWT
- Support du formatage Markdown dans les messages
- Messages multi-lignes avec Shift+Entrée
- Modification et suppression des messages
- Interface en mode sombre
- Connexions sécurisées via des certificats SSL
- Intégration d'une base de données MySQL
- Gestion des versions avec Git

## Technologies Utilisées

- **Backend** : Node.js, Express.js, MySQL, Socket.IO
- **Frontend** : Bootstrap, Axios
- **Authentification** : JSON Web Tokens (JWT), bcrypt pour le hachage des mots de passe
- **Base de données** : MySQL
- **Contrôle de version** : Git
- **SSL** : Let's Encrypt

## Démarrage

### Prérequis

- Node.js (v14 ou plus)
- MySQL
- Git
- Certificats SSL Let's Encrypt (optionnel, mais recommandé pour HTTPS)

### Installation

1. **Cloner le dépôt :**

   ```bash
   git clone https://github.com/votreutilisateur/noscord.git
   cd noscord
   ```
2. **Installer les dépendances :**
    ```bash
    npm install
    ```
3. **Configurer MySQL :**

    - Créez une base de données MySQL.
    - Mettez à jour le fichier .env avec vos informations de connexion MySQL.
    Exemple de fichier `.env` :
    ```bash
    # SQL configuration
    DB_HOST = localhost
    DB_USER = root
    DB_PASSWORD = ""
    DB_DATABASE = chat_app_db

    # App config
    PORT = 3000
    HOSTNAME = http://localhost
    ```
4. Lancer l'application :
    ```bash
    npm start server.js
    ```
    L'application sera disponible par défaut sur http://localhost:[Le port renseigné dans `.env`].
## Configuration SSL
Pour activer SSL pour des connexions sécurisées :

1. Obtenez un certificat SSL (par exemple via Let's Encrypt).
2. Mettez à jour la configuration du serveur pour utiliser HTTPS (voir le fichier server.js pour un exemple).
3. Redémarrez le serveur.
## Déploiement sur VPS
1. Connectez-vous à votre VPS en SSH.
    ```bash
    ssh root@185.166.39.170
    ```

2. Installez Git, Node.js, et MySQL sur votre VPS.

3. Clonez votre dépôt de projet.

4. Installez PM2 pour exécuter votre application Node.js en arrière-plan :
    ```bash
    npm install pm2 -g
    ```
5. Démarrez l'application avec PM2 :
    ```bash
    pm2 start server.js
    ```
## Contribution
N'hésitez pas à forker ce projet, à apporter des modifications et à soumettre une pull request !

## Licence
Ce projet est sous licence MIT - voir le fichier LICENCE pour plus de détails.