const express = require("express");
const userController = require("../controllers/userController");

const router = express.Router();

// Route pour l'inscription
router.post("/register", userController.register);

// Route pour la connexion
router.post("/login", userController.connect);

// Route pour vérifier un token
router.get("/authenticateToken", userController.authenticateToken);

// Route pour récupérer les amis
router.get("/friends", userController.getFriends);

// Route pour ajouter un ami
router.post("/friends", userController.RequestFriend);

// Route pour accepter une demande d'ami
router.put("/acceptFriend", userController.acceptFriend);

// Route pour refuser/annuler/supprimer une demande d'ami
router.delete("/removeFriend", userController.removeFriend);

// Route pour récupérer les informations d'un utilisateur
router.get("/getUser", userController.getUserInfo);

// Autres routes possibles : mise à jour du profil, suppression de compte, etc.
// router.put('/update', userController.updateUser);
// router.delete('/delete', userController.deleteUser);

module.exports = router;
