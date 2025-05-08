const express = require("express");
const channelsController = require("../controllers/channelsController");

const router = express.Router();

router.post("/addChannel", channelsController.createChannel);
router.get("/getChannelsByGuildId", channelsController.getChannelsByGuildId);
router.get(
    "/getPrivateChannelsByUserId",
    channelsController.getPrivateChannelsByUserId
);

module.exports = router;
