const db = require("../models/connDB");
const bcrypt = require("bcrypt");

require("dotenv").config();

async function seed(conserveDatabase = false) {
    console.log("🌱 Initialisation de la base de test...");
    const startTime = Date.now();

    try {
        // If we want to conserve the database, skip truncating
        if (!conserveDatabase) {
            // 1. Désactivation temporaire des contraintes pour vider proprement
            await db.promise().execute("SET FOREIGN_KEY_CHECKS = 0");

            const tables = [
                "user_attempts",
                "users_invited",
                "messages",
                "invites",
                "guilds_joined",
                "channels",
                "friends",
                "guilds",
                "roles",
                "users",
            ];

            for (const table of tables) {
                await db.promise().execute(`TRUNCATE TABLE ${table}`);
            }

            await db.promise().execute("SET FOREIGN_KEY_CHECKS = 1");

            // 2. Création des Utilisateurs (Indispensable pour tout le reste)
            const hashedPass = await bcrypt.hash("password123", 10);

            // On crée un Admin (id 1) et un User (id 2)
            await db.promise().execute(
                `
            INSERT INTO users (userId, handle, displayName, email, password, isEmailVerified) 
            VALUES 
            (1, 'admin_test', 'Admin', 'admin@test.com', ?, 1),
            (2, 'user_test', 'UserTest', 'user@test.com', ?, 1)
        `,
                [hashedPass, hashedPass]
            );

            // 3. Création d'une Guilde (Owner: Admin)
            await db.promise().execute(`
            INSERT INTO guilds (guildId, guildName, guildDescription, ownerId) 
            VALUES (1, 'Le Labo de Test', 'Serveur réservé aux tests unitaires', 1)
        `);

            // 4. Création des Salons (1 Texte, 1 Vocal)
            await db.promise().execute(`
            INSERT INTO channels (channelId, type, name, guildId) 
            VALUES 
            (1, 'text', 'général', 1),
            (2, 'voice', 'Vocal Test', 1)
        `);

            // 5. Liaison (UserTest rejoint la guilde de l'Admin)
            await db.promise().execute(`
            INSERT INTO guilds_joined (guildId, userId) VALUES (1, 1), (1, 2)
        `);

            // 6. Un petit message pour la route
            await db.promise().execute(`
            INSERT INTO messages (userId, channelId, content) 
            VALUES (1, 1, 'Bienvenue dans l’environnement de test ! 🚀')
        `);
        }

        const duration = Date.now() - startTime;
        console.log(`✅ Base de test prête en ${duration}ms !`);
        process.exit(0);
    } catch (err) {
        console.error("❌ Échec du seeding :", err);
        process.exit(1);
    }
}

// Parse command line arguments
const args = process.argv.slice(2);
const conserveDatabase = args.includes("--conserve-database");

console.log(args, conserveDatabase);

seed(conserveDatabase);
