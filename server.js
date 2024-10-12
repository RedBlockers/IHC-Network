const express = require('express');
const mysql = require('mysql2');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const bcrypt = require('bcrypt'); // Assurez-vous d'importer bcrypt pour le hachage des mots de passe
const jtw = require('jsonwebtoken');
const dotenv = require('dotenv').config()

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configuration de la base de données MySQL
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER, // Changez cela en fonction de votre configuration
  password: process.env.DB_PASSWORD, // Ajoutez le mot de passe si nécessaire
  database: process.env.DB_DATABASE // Nom de votre base de données
});

// Connexion à la base de données
db.connect((err) => {
  if (err) throw err;
  console.log('Connecté à la base de données MySQL');
});

// Servir les fichiers statiques (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Route pour obtenir les messages de la base de données
app.get('/messages', (req, res) => {
  const sql = 'SELECT * FROM messages ORDER BY created_at ASC';
  db.query(sql, (err, results) => {
    if (err) throw err;
    res.json(results);
  });
});

// Route pour poster un nouveau message
app.post('/messages', (req, res) => {
  const messageContent = req.body.content;
  const sql = 'INSERT INTO messages (content) VALUES (?)';
  db.query(sql, [messageContent], (err, result) => {
    if (err) throw err;
    const newMessage = { id: result.insertId, content: messageContent, created_at: new Date() };
    io.emit('newMessage', newMessage);  // Diffuser le message en temps réel
    res.sendStatus(200);
  });
});


// Route pour le login
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Vérifier si l'utilisateur existe
        const [rows] = await db.promise().execute('SELECT * FROM users WHERE username = ?', [username]);

        if (rows.length === 0) {
            return res.json({ success: false, message: 'Nom d\'utilisateur ou mot de passe incorrect.' });
        }

        const user = rows[0];

        // Comparer le mot de passe avec le mot de passe haché dans la base de données
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.json({ success: false, message: 'Nom d\'utilisateur ou mot de passe incorrect.' });
        }

        // Authentification réussie
        // Créer un token JWT
        const token = jwt.sign({ id: user.id, username: user.username }, 'votre_secret_key', { expiresIn: '1h' }); // Utilisez une clé secrète forte ici

        res.json({ success: true, token }); // Renvoie le token au client
    } catch (error) {
        console.error('Erreur lors de la connexion :', error);
        res.json({ success: false, message: 'Erreur lors de la connexion.' });
    }
});

// Route pour l'inscription
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Vérifier si l'utilisateur existe déjà
    const [rows] = await db.promise().execute('SELECT * FROM users WHERE username = ?', [username]); // Utilisation de db.promise()
    if (rows.length > 0) {
      return res.json({ success: false, message: 'Cet utilisateur existe déjà.' });
    }

    // Hachage du mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insertion dans la base de données
    await db.promise().execute('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, hashedPassword]); // Utilisation de db.promise()
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur lors de l\'inscription:', error);
    res.json({ success: false, message: 'Erreur lors de l\'inscription.' });
  }
});

// WebSockets : gérer la connexion et synchronisation des messages
io.on('connection', (socket) => {
  console.log(`Un utilisateur est connecté : ${socket.handshake.address}`);

  socket.on('disconnect', () => {
    console.log('Un utilisateur est déconnecté');
  });
});

// Démarrer le serveur
const PORT = process.env.PORT;
server.listen(PORT, () => {
  console.log(`Serveur démarré sur ${process.env.HOSTNAME}:${PORT}`);
});
