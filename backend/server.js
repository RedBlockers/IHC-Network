require("dotenv").config();
const express = require("express");
const http = require("http");
const https = require("https");
const path = require("path");
const fs = require("fs");
const helmet = require("helmet");
const cors = require("cors");
const userRoutes = require("./routes/userRoutes");
const messageRoutes = require("./routes/messagesRoutes");
const guildRoutes = require("./routes/guildsRoutes");
const channelsRoutes = require("./routes/channelsRoutes");
const cropRoutes = require("./routes/cropRoutes");
const inviteRoutes = require("./routes/invites");
const { setIo, connectedUsers } = require("./utils/sharedState");

const app = express();
let server;

const PORT =
    process.env.USE_SSL === "true"
        ? process.env.HTTPS_PORT
        : process.env.HTTP_PORT;

if (process.env.USE_SSL === "true") {
    const key = fs.readFileSync(process.env.SSL_KEY_PATH);
    const cert = fs.readFileSync(process.env.SSL_CERT_PATH);
    const ca = fs.readFileSync(process.env.SSL_CA_PATH);
    server = https.createServer({ key, cert, ca }, app);
    server.listen(PORT, () =>
        console.log(`Serveur HTTPS démarré sur ${process.env.HOSTNAME}:${PORT}`)
    );
    http.createServer((req, res) => {
        res.writeHead(301, { Location: `https://${req.headers.host}${req.url}` });
        res.end();
    }).listen(process.env.HTTP_PORT, () =>
        console.log("Redirection HTTP vers HTTPS sur le port " + process.env.HTTP_PORT)
    );
} else {
    server = http.createServer(app);
    server.listen(PORT, () =>
        console.log(`Serveur HTTP démarré sur ${process.env.HOSTNAME}:${PORT}`)
    );
}

const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",")
    : ["http://localhost:5173"];

const io = require("socket.io")(server, {
    cors: { origin: allowedOrigins, methods: ["GET", "POST"] },
});
setIo(io);

io.on("connection", (socket) => {
    socket.on("register", (userId) => {
        connectedUsers.set(userId, socket.id);
        socket.join(`user-${userId}`);
    });
    socket.on("disconnect", () => {
        for (const [userId, id] of connectedUsers.entries()) {
            if (id === socket.id) {
                connectedUsers.delete(userId);
                break;
            }
        }
    });
});

app.use(helmet());
app.use(cors({ origin: allowedOrigins }));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

app.use("/api/v1/users", userRoutes);
app.use("/api/v1/messages", messageRoutes);
app.use("/api/v1/guilds", guildRoutes);
app.use("/api/v1/channels", channelsRoutes);
app.use("/api/v1/avatar", cropRoutes);
app.use("/api/v1/invites", inviteRoutes);

module.exports = { io, connectedUsers };
