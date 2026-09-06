"use strict";

const crypto = require("node:crypto");

const jwt = require("jsonwebtoken");

const config = require("../config");
const { query } = require("../db/pool");
const channelRepository = require("../repositories/channelRepository");
const { BadRequest, NotFound, Unauthorized } = require("../errors");

const toActivity = (row) => ({
    activityId: Number(row.activityId),
    name: row.name,
    origin: row.origin,
    createdAt: row.createdAt,
});

async function list(guildId) {
    const rows = await query(
        "activities.list",
        "SELECT activityId, guildId, name, origin, createdAt FROM guild_activities WHERE guildId = ? ORDER BY name ASC",
        [guildId]
    );
    return rows.map(toActivity);
}

async function create(guild, user, input) {
    const name = (input.name ?? "").trim();
    const origin = (input.origin ?? "").trim();
    if (!name || !origin) throw new BadRequest("Une activité a besoin d'un nom et d'une origine.");
    let parsed;
    try {
        parsed = new URL(origin);
    } catch {
        throw new BadRequest("L'origine de l'activité n'est pas une URL.");
    }
    if (parsed.protocol !== "https:") throw new BadRequest("Une activité ne s'ouvre qu'en HTTPS.");
    const result = await query(
        "activities.create",
        "INSERT INTO guild_activities (guildId, name, origin, createdBy) VALUES (?, ?, ?, ?)",
        [guild.guildId, name.slice(0, 80), origin.slice(0, 300), user.userId]
    );
    return { activityId: result.insertId, name: name.slice(0, 80), origin };
}

async function remove(guildId, activityId) {
    const result = await query(
        "activities.remove",
        "DELETE FROM guild_activities WHERE activityId = ? AND guildId = ?",
        [activityId, guildId]
    );
    if (!result.affectedRows) throw new NotFound("Activité introuvable.");
    return { activityId: Number(activityId) };
}

async function launch(guild, user, activityId, channelId) {
    const rows = await query(
        "activities.find",
        "SELECT activityId, name, origin FROM guild_activities WHERE activityId = ? AND guildId = ?",
        [activityId, guild.guildId]
    );
    const row = rows[0];
    if (!row) throw new NotFound("Activité introuvable.");

    const channel = await channelRepository.findById(channelId);
    if (!channel || Number(channel.guildId) !== Number(guild.guildId)) {
        throw new BadRequest("Le salon n'appartient pas à cette communauté.");
    }

    const nonce = crypto.randomBytes(16).toString("hex");
    const token = jwt.sign(
        {
            typ: "activity",
            sub: String(user.userId),
            handle: user.handle,
            guildId: Number(guild.guildId),
            activityId: Number(activityId),
            channelId: Number(channelId),
            nonce,
        },
        config.JWT_SECRET,
        { algorithm: "HS256", expiresIn: "10m", issuer: "qweillo", audience: "qweillo-activity" }
    );
    return {
        origin: row.origin,
        token,
        name: row.name,
        channelId: Number(channelId),
        expiresIn: 600,
    };
}

function verify(token) {
    let payload;
    try {
        payload = jwt.verify(String(token ?? ""), config.JWT_SECRET, {
            algorithms: ["HS256"],
            issuer: "qweillo",
            audience: "qweillo-activity",
        });
    } catch {
        throw new Unauthorized("Jeton d'activité invalide ou expiré.");
    }
    if (payload.typ !== "activity" || !payload.sub || !payload.activityId) {
        throw new Unauthorized("Jeton d'activité invalide ou expiré.");
    }
    return {
        userId: Number(payload.sub),
        handle: payload.handle ?? null,
        guildId: payload.guildId == null ? null : Number(payload.guildId),
        activityId: Number(payload.activityId),
        channelId: Number(payload.channelId),
    };
}

module.exports = { list, create, remove, launch, verify };
