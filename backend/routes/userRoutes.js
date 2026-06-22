const express = require("express");
const userController = require("../controllers/userController");
const guildController = require("../controllers/guildController");
const validate = require("../middlewares/validate");
const { registerSchema, loginSchema } = require("../validators/userValidator");
const auth = require("../middlewares/authMiddleware");
const multer = require("multer");

const upload = multer({
    storage: multer.memoryStorage(),
});

const router = express.Router();

router.post(
    "/register",
    //validate(registerSchema),
    upload.single("avatar"),
    userController.register
);

router.get("/auth/check", userController.checkFieldAvailability);

router.post("/login", validate(loginSchema), userController.login);

//OLD router.get("/authenticateToken", userController.authenticateToken);
router.get("/me", auth, userController.getMe);

router.get("/me/friends", auth, userController.getFriends);

router.post("/me/friends/:friendHandle", auth, userController.addFriendRequest);

router.patch("/me/friends/:friendId", auth, userController.acceptFriendRequest);

router.delete("/me/friends/:friendId", auth, userController.removeFriend);

router.get("/:userId", auth, userController.getUser);

router.get("/me/channels/private", auth, userController.getPrivateChannels);

router.get("/me/guilds", auth, guildController.getGuildsByUser);

module.exports = router;
