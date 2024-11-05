const userModel = require('../models/userModel');
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");
const {saveProfileImage} = require("../services/fileServices");

function CreateToken(username,userId,passwordUpdatedAt) {
    return jwt.sign(
        { username: username, userId:userId, passwordUpdatedAt: passwordUpdatedAt },
        process.env.SECRET_KEY);
}

async function AuthenticateAndDecodeToken(token){
    if (!token) {
        return { valid: false, message: 'Token manquant', decodedToken: null };
    }

    try {
        const decodedToken = jwt.verify(token, process.env.SECRET_KEY);
        const existingUser = await userModel.getUserByUsername(decodedToken.username);
        if (existingUser.length === 0) {
            return { valid: false, message: 'Utilisateur introuvable', decodedToken: null };
        }
        console.log(decodedToken);

        if(new Date(existingUser[0].passwordUpdatedAt).getTime() <= new Date(decodedToken.passwordUpdatedAt).getTime()) {
            return { valid: true, message: 'Token Valide', decodedToken};
        } else {
            return { valid: false, message: 'Le token est invalide, le mot de passe a été changé', decodedToken: null };
        }
    }catch (err){
        logger.error(err);
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

          const imagePath = saveProfileImage(profileImage);

          if (!imagePath) {
              return res.json({ success: false, message: "Erreur lors de l\'écriture de l'image." });
          }

          const resp = await userModel.createUser(username,password,mail,imagePath);
          console.log(resp)
          if (!resp.success) {
              return res.json({ success: false, message: 'Erreur lors de l\'inscription.' });
          }
          const token = CreateToken(username, resp.userId, resp.currentDateTime);
      
          res.json({ success: true, token: token });
        } catch (error) {
          logger.error(error);
          res.json({ success: false, message: 'Erreur lors de l\'inscription.' });
        }
    },
    connect: async (req, res) => {
        try {
            const { username, password } = req.body;
            const users = await userModel.getUserByUsername(username)
            if (!(await userModel.checkPassword(users, password)).success) {
                return res.json({ success: false, message: 'Nom d\'utilisateur ou mot de passe incorrect.' });
            }
                const token = CreateToken(username, users[0].idUser, users[0].passwordUpdatedAt)
                res.json({ success: true,token: token}); // Renvoie le token au client
        } catch (error) {
            console.error('Erreur lors de la connexion :', error);
            res.json({ success: false, message: 'Erreur lors de la connexion.' });
        }
    },

    authenticateToken: async (req, res) => {
        const token = req.body.token;

        // Utiliser la fonction de vérification du token
        const { valid, message, decodedToken } = await AuthenticateAndDecodeToken(token);

        if (valid) {
            res.json({ success: true, message, username: decodedToken.username });
        } else {
            res.json({ success: false, message });
        }
    }
    ,
    AuthenticateAndDecodeToken

}