const express = require('express');
const channelsController = require('../controllers/channelsController');

const router = express.Router();

router.post('/addChannel', channelsController.createChannel)
router.post('/getChannelsByGuildId', channelsController.getChannelsByGuildId)

module.exports = router;