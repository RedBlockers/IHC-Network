const mysql = require('mysql2');
const logger = require('../utils/logger')

// Configuration de la base de données MySQL
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
});
  
// Connexion à la base de données
db.connect((err) => {
  if (err) {
    logger.error(err);
    throw err;
  }
  logger.info('Connecté à la base de données MySQL');
});

module.exports = db;
