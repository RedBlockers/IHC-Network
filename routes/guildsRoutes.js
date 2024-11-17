const express = require('express');
const guildController = require('../controllers/guildController');

const router = express.Router();

//route pour la récupèration des serveurs
router.post("/getGuilds", guildController.getGuilds);

module.exports = router;
