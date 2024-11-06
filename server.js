const express = require('express');
const http = require('http');
const https = require('https');
const socketIo = require('socket.io');
const path = require('path');
const bcrypt = require('bcrypt'); // Assurez-vous d'importer bcrypt pour le hachage des mots de passe
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv').config()
const fs = require('fs')
const crypto = require('crypto');
const userRoutes = require('./routes/userRoutes');
const messageRoutes = require('./routes/messagesRoutes');
const messageController = require('./controllers/messageController');

const app = express();
let server;

if (process.env.USE_SSL === 'true'){

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
  const PORT = process.env.HTTPS_PORT; // Port 443 par défaut pour HTTPS
  server.listen(PORT, () => {
    console.log(`Serveur HTTPS démarré sur ${process.env.HOSTNAME}:${PORT}`);
  });


  // Créer un serveur HTTP pour rediriger le trafic vers HTTPS
  http.createServer((req, res) => {
    res.writeHead(301, { Location: `https://${req.headers.host}${req.url}` });
    res.end();
  }).listen(process.env.HTTP_PORT, () => {
    console.log('Redirection HTTP vers HTTPS sur le port ' + process.env.HTTP_PORT);
  });
}else{
  server = http.createServer(app)
  const PORT = process.env.HTTP_PORT; // Port 80 par défaut pour HTTP
  server.listen(PORT, () => {
    console.log(`Serveur HTTP démarré sur ${process.env.HOSTNAME}:${PORT}`);
  });
}

// Créer un serveur HTTPS

// Configurer Socket.IO avec le serveur HTTPS
const io = socketIo(server);
messageController.setIo(io);

// Servir les fichiers statiques (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public/js')));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Routes
app.use('/users', userRoutes);
app.use('/messages', messageRoutes);


