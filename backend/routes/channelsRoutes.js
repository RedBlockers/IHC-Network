const express = require("express");
const channelsController = require("../controllers/channelController");

const router = express.Router();

router.post("/", channelsController.createChannel);

module.exports = router;
