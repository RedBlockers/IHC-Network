const express = require('express');
const mysql = require('mysql2');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const bcrypt = require('bcrypt'); // Assurez-vous d'importer bcrypt pour le hachage des mots de passe
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv').config()
const fs = require('fs')
const crypto = require('crypto');
const { use } = require('bcrypt/promises');

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
app.use(express.static(path.join(__dirname, 'public/js')));
app.use(express.json({ limit: '10mb' }));  // Augmente la limite à 10MB pour les requêtes JSON
app.use(express.urlencoded({ limit: '10mb', extended: true }));  // Pour les formulaires encodés URL
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Route pour obtenir les messages de la base de données
app.get('/messages', (req, res) => {
  const sql = 'SELECT * FROM messages ORDER BY dateEnvoi ASC';
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
        const isMatch = ConnectUser(username,password,res)
        if (!isMatch) {
            return res.json({ success: false, message: 'Nom d\'utilisateur ou mot de passe incorrect.' });
        }
        res.json({ success: true}); // Renvoie le token au client
    } catch (error) {
        console.error('Erreur lors de la connexion :', error);
        res.json({ success: false, message: 'Erreur lors de la connexion.' });
    }
});

// Route pour l'inscription
app.post('/register', async (req, res) => {
  const { username, password, profileImage } = req.body;
  console.log(req.body);
  try {
    // Vérifier si l'utilisateur existe déjà
    const [rows] = await db.promise().execute('SELECT * FROM users WHERE userPseudo = ?', [username]);
    if (rows.length > 0) {
      return res.json({ success: false, message: 'Cet utilisateur existe déjà.' });
    }

    // Hachage du mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);
    const currentDateTime = new Date();

    const [result] = await db.promise().execute(
      'INSERT INTO users (userPseudo, userMdp, passwordUpdatedAt) VALUES (?, ?, ?)', 
      [username, hashedPassword, currentDateTime]
    );

    // Récupérer l'ID de la dernière insertion
    const lastInsertId = result.insertId;

    // Écriture de la photo de profil
    const base64Data = profileImage.replace(/^data:image\/png;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFile(`./public/images/profiles/${lastInsertId}.png`, buffer, (err) => {
      if (err) {
        console.error('Erreur lors de l\'écriture de l\'image:', err);
        return res.json({ success: false, message: 'Erreur lors de l\'écriture de l\'image.' });
      }

      ConnectUser(username, password, res);

      const token = jwt.sign(
        { username: username, passwordUpdatedAt: currentDateTime }, // Inclure passwordUpdatedAt dans le token
        crypto.randomBytes(64).toString('hex'));

      res.json({ success: true, token: token });
    });
  } catch (error) {
    console.error('Erreur lors de l\'inscription:', error);
    res.json({ success: false, message: 'Erreur lors de l\'inscription.' });
  }
});


// WebSockets : gérer la connexion et synchronisation des messages
io.on('connection', async (socket) => {
  console.log(`Un utilisateur est connecté : ${socket.handshake.address}`);
  await db.promise().execute('INSERT INTO logs (type, ip, commentaire) VALUES (?, ?, ?)', ["connexion", socket.handshake.address,"Connexion a la page web"]);
  socket.on('disconnect', async () => {
    await db.promise().execute('INSERT INTO logs (type, ip, commentaire) VALUES (?, ?, ?)', ["déconnexion", socket.handshake.address,"déconnexion a la page web"]);
    console.log('Un utilisateur est déconnecté');
  });
});

function GenerateConnectionToken(username){
  return jtw.sign(username,crypto.randomBytes(255).toString('hex'),)
}

async function ConnectUser(username, password,res){
  // Vérifier si l'utilisateur existe
  const [rows] = await db.promise().execute('SELECT * FROM users WHERE userPseudo = ?', [username]);

  if (rows.length === 0) {
      return res.json({ success: false, message: 'Nom d\'utilisateur ou mot de passe incorrect.' });
  }

  const user = rows[0];

  // Comparer le mot de passe avec le mot de passe haché dans la base de données
  return await bcrypt.compare(password, user.userMdp);
}


// Démarrer le serveur
const PORT = process.env.PORT;
server.listen(PORT, () => {
  console.log(`Serveur démarré sur ${process.env.HOSTNAME}:${PORT}`);
});
