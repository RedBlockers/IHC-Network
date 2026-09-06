import mysql from "mysql2/promise";
import argon2 from "argon2";

const args = Object.fromEntries(
    process.argv.slice(2).reduce((pairs, value, index, all) => {
        if (value.startsWith("--")) pairs.push([value.slice(2), all[index + 1] ?? true]);
        return pairs;
    }, [])
);

const PREFIX = "charge";
const COUNT = Number(args.nombre ?? 40);
const CHANNEL = Number(args.salon ?? 6);
const PASSWORD = args.motdepasse ?? "password123";

const db = await mysql.createConnection({
    host: process.env.DB_HOST ?? "mysql",
    user: process.env.DB_USER ?? "qweillo",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE ?? "qweillo",
});

if (args.retirer) {
    const [result] = await db.execute("DELETE FROM users WHERE handle LIKE ?", [`${PREFIX}%`]);
    console.log(`${result.affectedRows} compte(s) de charge retiré(s).`);
    await db.end();
    process.exit(0);
}

const [[channel]] = await db.execute("SELECT channelId, guildId FROM channels WHERE channelId = ?", [CHANNEL]);
if (!channel?.guildId) throw new Error(`le salon ${CHANNEL} n'appartient à aucune communauté`);

const hash = await argon2.hash(PASSWORD, { type: argon2.argon2id });

let created = 0;
for (let index = 0; index < COUNT; index += 1) {
    const handle = `${PREFIX}${String(index).padStart(3, "0")}`;
    const [result] = await db.execute(
        `INSERT IGNORE INTO users (handle, displayName, email, password, isEmailVerified)
         VALUES (?, ?, ?, ?, 1)`,
        [handle, `Charge ${index}`, `${handle}@charge.local`, hash]
    );
    const userId =
        result.insertId ||
        (await db.execute("SELECT userId FROM users WHERE handle = ?", [handle]))[0][0].userId;

    await db.execute("INSERT IGNORE INTO guild_members (guildId, userId, role) VALUES (?, ?, 'member')", [
        channel.guildId,
        userId,
    ]);
    created += 1;
}

console.log(`${created} compte(s) prêts, membres de la communauté ${channel.guildId}.`);
console.log(`Comptes : ${PREFIX}000 … ${PREFIX}${String(COUNT - 1).padStart(3, "0")}`);
await db.end();
