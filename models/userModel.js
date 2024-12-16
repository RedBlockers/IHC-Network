const db = require('./connDB');
const bcrypt = require('bcrypt');
const logger = require('../utils/logger');

module.exports = {
  getUserByUsername: async (username) => {
      logger.info('getUserByUsername '+ username);
    const [rows] = await db.promise().execute('SELECT * FROM users WHERE userNickname = ?', [username]);
    return rows;
  },

  getUserByMail: async (mail) => {
      logger.info('getUserByMail '+ mail);
    const [rows] = await db.promise().execute('SELECT * FROM users WHERE userEmail = ?', [mail]);
    return rows;
  },

  createUser: async (username, password, mail, profileImagePath) => {
    try {
        // Hachage du mot de passe
        const hashedPassword = await bcrypt.hash(password, 10);
        const currentDateTime = new Date();
        console.log(username, hashedPassword, mail, profileImagePath, currentDateTime)
        // Exécution de la requête d'insertion
        const [result] = await db.promise().execute(
          'INSERT INTO users (userNickname, password, userEmail, userImage, passwordUpdatedAt) VALUES (?, ?, ?, ?, ?)',
          [username, hashedPassword, mail, profileImagePath, currentDateTime]
        );
  
        // Retourner l'ID de l'utilisateur créé
        return { success: true, userId: result.insertId, currentDateTime: currentDateTime };
      } catch (error) {
        logger.error('Erreur lors de la création de l\'utilisateur:\n' + error.stack);
        return { success: false, message: 'Erreur lors de la création de l\'utilisateur.' };
      }
    },

    checkPassword: async (existingUser, password) => {
        if (existingUser.length === 0) {
            return { success: false, message: 'Nom d\'utilisateur ou mot de passe incorrect.' };
        }
        logger.info("checkPassword "+ existingUser[0]);
        const isPasswordCorrect = await bcrypt.compare(password, existingUser[0].password);
        if (!isPasswordCorrect) {
            return { success: false, message: 'Nom d\'utilisateur ou mot de passe incorrect.' };
        }
        return {success:true};
    },

    addUserAttempt: async (ip) =>{
      await db.promise().execute('INSERT INTO user_attempts (ip) VALUES (?)', [ip]);
    },

    getUserAttempts: async (ip) =>{
        const [result] = await db.promise().execute('SELECT * FROM user_attempts WHERE ip = ?', [ip]);
        return result;
    },

    deleteUserAttempt: async (ip) =>{
      await db.promise().execute('DELETE FROM user_attempts WHERE ip = ?', [ip]);
    }
};
 