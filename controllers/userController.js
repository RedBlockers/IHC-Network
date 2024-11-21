const userModel = require('../models/userModel');
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");
const {saveProfileImage} = require("../services/fileServices");

function CreateToken(username,userId,passwordUpdatedAt,profilePicture) {
    logger.info(`Création d'un token pour l'utilisateur n°${userId}`);
    return jwt.sign(
        { username: username, userId:userId, passwordUpdatedAt: passwordUpdatedAt, profilePicture: profilePicture },
        process.env.SECRET_KEY);
}

async function AuthenticateAndDecodeToken(token){
    if (!token) {
        return { valid: false, message: 'Token manquant', decodedToken: null };
    }

    try {
        const decodedToken = jwt.verify(token, process.env.SECRET_KEY);
        const existingUser = await userModel.getUserByUsername(decodedToken.username);
        logger.info(`Authentification du token pour l'utilisateur n°${decodedToken.userId}`);
        if (existingUser.length === 0) {
            return { valid: false, message: 'Utilisateur introuvable', decodedToken: null };
        }

        if(new Date(existingUser[0].passwordUpdatedAt).getTime() <= new Date(decodedToken.passwordUpdatedAt).getTime()) {
            logger.info(`Authentification du token réussi pour l'utilisateur n°${decodedToken.userId}`);
            return { valid: true, message: 'Token Valide', decodedToken};
        } else {
            logger.warn(`échec de l'authentification du token pour l'utilisateur n°${decodedToken.userId}`);
            return { valid: false, message: 'Le token est invalide, le mot de passe a été changé', decodedToken: null };
        }
    }catch (err){
        logger.error(`Erreur lors le l'authentification du token de l'utilisateur \n ${err}`);
        return { valid: false, message: 'Token invalide ou expiré', decodedToken: null };
    }
}
module.exports = {
    register: async (req, res) => {
        const { username, password, mail, profileImage } = req.body;
        try {
          // Vérifier si l'utilisateur existe déjà
          const existingUser = await userModel.getUserByUsername(username);
          if (existingUser.length > 0) {
            return res.json({ success: false, message: 'Cet utilisateur existe déjà.' });
          }
          const existingEmail = await userModel.getUserByMail(mail);
          if (existingEmail.length > 0) {
            return res.json({ success: false, message: 'Cet Email est déjà associer a un compte.' });
          }
          logger.info("Création d'un nouvel utilisateur")
          const imagePath = saveProfileImage(profileImage);

          if (!imagePath) {
              return res.json({ success: false, message: "Erreur lors de l\'écriture de l'image." });
          }

          const resp = await userModel.createUser(username, password, mail, imagePath);
          if (!resp.success) {
              return res.json({ success: false, message: 'Erreur lors de l\'inscription.' });
          }
          const token = CreateToken(username, resp.userId, resp.currentDateTime, imagePath);
      
          res.json({ success: true, token: token });
        } catch (error) {
            logger.error('Erreur lors de la création de l\'utilisateur:\n' + error);
            res.json({ success: false, message: 'Erreur lors de l\'inscription.' });
        }
    },
    connect: async (req, res) => {
        try {
            const { username, password } = req.body;
            const users = await userModel.getUserByUsername(username)
            logger.info(`Connexion de l'utilisateur n°${users[0].userId}`);
            const userAttempts = await userModel.getUserAttempts(req.ip);
            console.log(userAttempts.length);
            if(userAttempts.length > 5) {
                return res.json({ success: false, message: 'Votre compte a été bloquer suite a une activité suspecte, veuillez rééssayer ultérieurement ' });
            }
            if (!(await userModel.checkPassword(users, password)).success) {
                await userModel.addUserAttempt(req.ip);
                return res.json({ success: false, message: 'Nom d\'utilisateur ou mot de passe incorrect.' });
            }
            await userModel.deleteUserAttempt(req.ip)
                const token = CreateToken(username, users[0].userId, users[0].passwordUpdatedAt, users[0].userImage)
                res.json({ success: true,token: token});
        } catch (error) {
            logger.error('Erreur lors de la connexion :\n'+ error);
            res.json({ success: false, message: 'Erreur lors de la connexion.' });
        }
    },

    authenticateToken: async (req, res) => {
        const token = req.body.token;

        // Utiliser la fonction de vérification du token
        const { valid, message, decodedToken } = await AuthenticateAndDecodeToken(token);

        if (valid) {
            res.json({ success: true, message, username: decodedToken.username, avatar: decodedToken.profilePicture });
        } else {
            res.json({ success: false, message });
        }
    }
    ,
    AuthenticateAndDecodeToken

}