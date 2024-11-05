const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const bcrypt = require('bcrypt'); // Assurez-vous d'importer bcrypt pour le hachage des mots de passe
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv').config()
const fs = require('fs')
const crypto = require('crypto');
const { use } = require('bcrypt/promises');
const userRoutes = require('./routes/userRoutes');
const messageRoutes = require('./routes/messagesRoutes');
const messageController = require('./controllers/messageController');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

messageController.setIo(io);

// Servir les fichiers statiques (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public/js')));
app.use(express.json({ limit: '10mb' }));  // Augmente la limite à 10MB pour les requêtes JSON
app.use(express.urlencoded({ limit: '10mb', extended: true }));  // Pour les formulaires encodés URL
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/users', userRoutes);
app.use('/messages', messageRoutes);

// Démarrer le serveur
const PORT = process.env.PORT;
server.listen(PORT, () => {
  console.log(`Serveur démarré sur ${process.env.HOSTNAME}:${PORT}`);
});
