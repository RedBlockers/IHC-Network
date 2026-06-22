const mysql = require("mysql2");
const logger = require("../utils/logger");

// Configuration de la base de données MySQL
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

// Connexion à la base de données
pool.getConnection((err, connection) => {
    if (err) {
        logger.error("Erreur de connexion à la base de données MySQL :", err);
        // Ne pas throw l'erreur pour éviter de casser le code derrière
        return;
    }
    if (connection) {
        connection.release();
        logger.info("Connecté à la base de données MySQL");
    }
});

module.exports = pool;
