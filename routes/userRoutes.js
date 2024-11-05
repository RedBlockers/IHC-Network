const express = require('express');
const userController = require('../controllers/userController');

const router = express.Router();

// Route pour l'inscription
router.post('/register', userController.register);

// Route pour la connexion
router.post('/login', userController.connect);

// Route pour vérifier un token
router.post('/authenticateToken', userController.authenticateToken);

// Autres routes possibles : mise à jour du profil, suppression de compte, etc.
// router.put('/update', userController.updateUser);
// router.delete('/delete', userController.deleteUser);

module.exports = router;
