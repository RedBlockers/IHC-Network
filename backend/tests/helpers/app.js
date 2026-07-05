const express = require("express");
const userRoutes = require("../../routes/userRoutes");
const guildRoutes = require("../../routes/guildsRoutes");
const messageRoutes = require("../../routes/messagesRoutes");
const channelsRoutes = require("../../routes/channelsRoutes");
const inviteRoutes = require("../../routes/invites");

// App factory pour les tests — sans server.listen ni socket.io
function createApp() {
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use("/api/v1/users", userRoutes);
    app.use("/api/v1/guilds", guildRoutes);
    app.use("/api/v1/messages", messageRoutes);
    app.use("/api/v1/channels", channelsRoutes);
    app.use("/api/v1/invites", inviteRoutes);
    return app;
}

module.exports = createApp;
