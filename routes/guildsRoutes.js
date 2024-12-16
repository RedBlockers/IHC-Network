const express = require('express');
const guildController = require('../controllers/guildController');

const router = express.Router();

router.post("/getGuildsByUser",guildController.getGuildsByUser);
router.post("/createGuild", guildController.createGuild);

module.exports = router;
