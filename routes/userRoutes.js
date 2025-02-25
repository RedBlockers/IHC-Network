const express = require("express");
const userController = require("../controllers/userController");

const router = express.Router();

// Route pour l'inscription
router.post("/register", userController.register);

// Route pour la connexion
router.post("/login", userController.connect);

// Route pour vérifier un token
router.post("/authenticateToken", userController.authenticateToken);

// Route pour récupérer les amis
router.post("/getFriends", userController.getFriends);

// Route pour ajouter un ami
router.post("/addFriend", userController.RequestFriend);

// Route pour accepter une demande d'ami
router.post("/acceptFriend", userController.acceptFriend);

// Route pour refuser une demande d'ami
router.delete("/refuseFriend", userController.refuseFriend);

// Route pour annuler une demande d'ami
router.delete("/cancelFriendRequest", userController.cancelFriendRequest);

router.delete("/removeFriend", userController.removeFriend);

// Autres routes possibles : mise à jour du profil, suppression de compte, etc.
// router.put('/update', userController.updateUser);
// router.delete('/delete', userController.deleteUser);

module.exports = router;
