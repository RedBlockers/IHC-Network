const db = require('./connDB');
const bcrypt = require('bcrypt');

module.exports = {
  getUserByUsername: async (username) => {
    const [rows] = await db.promise().execute('SELECT * FROM users WHERE userPseudo = ?', [username]);
    return rows;
  },

  getUserByMail: async (mail) => {
    const [rows] = await db.promise().execute('SELECT * FROM users WHERE userEmail = ?', [mail]);
    return rows;
  },

  createUser: async (username, password, mail, profileImagePath) => {
    try {
        // Hachage du mot de passe
        const hashedPassword = await bcrypt.hash(password, 10);
        const currentDateTime = new Date();

        // Exécution de la requête d'insertion
        const [result] = await db.promise().execute(
          'INSERT INTO users (userPseudo, userMdp, userEmail, userImage, passwordUpdatedAt) VALUES (?, ?, ?, ?, ?)',
          [username, hashedPassword, mail, profileImagePath, currentDateTime]
        );
  
        // Retourner l'ID de l'utilisateur créé
        return { success: true, userId: result.insertId, currentDateTime: currentDateTime };
      } catch (error) {
        console.error('Erreur lors de la création de l\'utilisateur:', error);
        return { success: false, message: 'Erreur lors de la création de l\'utilisateur.' };
      }
    },
    checkPassword: async (existingUser, password) => {
        if (existingUser.length === 0) {
            return { success: false, message: 'Nom d\'utilisateur ou mot de passe incorrect.' };
        }
        const isPasswordCorrect = await bcrypt.compare(password, existingUser[0].userMdp);
        if (!isPasswordCorrect) {
            return { success: false, message: 'Nom d\'utilisateur ou mot de passe incorrect.' };
        }
        return {success:true};
    }
};
 