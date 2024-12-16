const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');

router.get('/messages/:channelId', messageController.getMessages);
router.post('/messages', messageController.postMessage);

module.exports = router;
