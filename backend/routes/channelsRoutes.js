const express = require("express");

const router = express.Router();

// La création de channels est désormais sous /guilds/:guildId/channels
// Ce router reste disponible pour des opérations futures sur un channel spécifique

module.exports = router;
