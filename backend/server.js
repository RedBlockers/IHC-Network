require("dotenv").config();
const express = require("express");
const http = require("http");
const https = require("https");
const path = require("path");
const fs = require("fs");
const userRoutes = require("./routes/userRoutes");
const messageRoutes = require("./routes/messagesRoutes");
const guildRoutes = require("./routes/guildsRoutes");
const channelsRoutes = require("./routes/channelsRoutes");
const { setIo, connectedUsers } = require("./utils/sharedState");
const cors = require("cors");

const app = express();
let server;

const PORT =
    process.env.USE_SSL === "true"
        ? process.env.HTTPS_PORT
        : process.env.HTTP_PORT;

if (process.env.USE_SSL === "true") {
    // Charger les certificats Let's Encrypt
    const key = fs.readFileSync(process.env.SSL_KEY_PATH);
    const cert = fs.readFileSync(process.env.SSL_CERT_PATH);
    const ca = fs.readFileSync(process.env.SSL_CA_PATH);

    const options = {
        key: key,
        cert: cert,
        ca: ca,
    };
    server = https.createServer(options, app);

    // Démarrer le serveur HTTPS
    server.listen(PORT, () => {
        console.log(
            `Serveur HTTPS démarré sur ${process.env.HOSTNAME}:${PORT}`
        );
    });

    // Créer un serveur HTTP pour rediriger le trafic vers HTTPS
    http.createServer((req, res) => {
        res.writeHead(301, {
            Location: `https://${req.headers.host}${req.url}`,
        });
        res.end();
    }).listen(process.env.HTTP_PORT, () => {
        console.log(
            "Redirection HTTP vers HTTPS sur le port " + process.env.HTTP_PORT
        );
    });
} else {
    server = http.createServer(app);
    server.listen(PORT, () => {
        console.log(`Serveur HTTP démarré sur ${process.env.HOSTNAME}:${PORT}`);
    });
}

// Configurer Socket.IO avec le serveur
const io = require("socket.io")(server);
setIo(io);

// Tu peux manipuler connectedUsers ici

io.on("connection", (socket) => {
    console.log("Nouvelle connexion :", socket.id);

    socket.on("register", (userId) => {
        connectedUsers.set(userId, socket.id);
        socket.join(`user-${userId}`); // Room privée
        console.log(
            `Utilisateur ${userId} enregistré avec socket ${socket.id}`
        );
    });

    socket.on("disconnect", () => {
        for (const [userId, id] of connectedUsers.entries()) {
            if (id === socket.id) {
                connectedUsers.delete(userId);
                console.log(`Utilisateur ${userId} déconnecté`);
                break;
            }
        }
    });
});

// Servir les fichiers statiques (HTML, CSS, JS)
app.use(cors({ origin: "http://localhost:5173" })); // Vite default port
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Routes
app.use("/users", userRoutes);
app.use("/messages", messageRoutes);
app.use("/guilds", guildRoutes);
app.use("/channels", channelsRoutes);

module.exports = {
    io,
    connectedUsers,
};
