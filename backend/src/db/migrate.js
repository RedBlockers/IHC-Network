"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

const mysql = require("mysql2/promise");

const config = require("../config");
const { logger } = require("../logger");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

async function connect() {
    return mysql.createConnection({
        host: config.DB_HOST,
        port: config.DB_PORT,
        user: config.DB_USER,
        password: config.DB_PASSWORD,
        database: config.DB_DATABASE,
        multipleStatements: true,
        timezone: "Z",
    });
}

async function ensureRegistry(connection) {
    await connection.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            name      VARCHAR(255) NOT NULL,
            appliedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
}

async function listFiles() {
    const entries = await fs.readdir(MIGRATIONS_DIR);
    return entries.filter((name) => name.endsWith(".sql")).sort();
}

async function appliedSet(connection) {
    const [rows] = await connection.query("SELECT name FROM schema_migrations");
    return new Set(rows.map((row) => row.name));
}

async function up() {
    const connection = await connect();
    try {
        await ensureRegistry(connection);
        const applied = await appliedSet(connection);
        const files = await listFiles();
        const pending = files.filter((name) => !applied.has(name));

        if (pending.length === 0) {
            logger.info("migrations à jour", { count: files.length });
            return;
        }

        for (const name of pending) {
            const sql = await fs.readFile(path.join(MIGRATIONS_DIR, name), "utf8");
            await connection.beginTransaction();
            try {
                await connection.query(sql);
                await connection.query("INSERT INTO schema_migrations (name) VALUES (?)", [name]);
                await connection.commit();
                logger.info("migration appliquée", { name });
            } catch (error) {
                await connection.rollback().catch(() => {});
                logger.error("échec de migration", { name, message: error.message });
                throw error;
            }
        }
    } finally {
        await connection.end();
    }
}

async function status() {
    const connection = await connect();
    try {
        await ensureRegistry(connection);
        const applied = await appliedSet(connection);
        const files = await listFiles();
        for (const name of files) {
            process.stdout.write(`${applied.has(name) ? "✓ appliquée" : "· en attente"}  ${name}\n`);
        }
    } finally {
        await connection.end();
    }
}

async function main() {
    const command = process.argv[2] ?? "up";
    if (command === "up") await up();
    else if (command === "status") await status();
    else {
        process.stderr.write(`Commande inconnue : ${command}\nUsage : migrate.js [up|status]\n`);
        process.exitCode = 1;
    }
}

if (require.main === module) {
    main().catch((error) => {
        logger.error("migrateur interrompu", { message: error.message });
        process.exitCode = 1;
    });
}

module.exports = { up, status };
