"use strict";

const guildRepository = require("../repositories/guildRepository");
const channelRepository = require("../repositories/channelRepository");
const userRepository = require("../repositories/userRepository");
const roleRepository = require("../repositories/roleRepository");
const { Forbidden } = require("../errors");

const PAGE = 2000;

async function stream(guild, actor, out) {
    if (Number(guild.ownerId) !== Number(actor.userId)) {
        throw new Forbidden("Seul le propriétaire peut exporter la communauté.");
    }

    const [channels, members, roles] = await Promise.all([
        channelRepository.listByGuild(guild.guildId),
        userRepository.listByGuild(guild.guildId),
        roleRepository.listByGuild(guild.guildId),
    ]);

    const encrypted = new Set(channels.filter((row) => row.e2eeEnabled).map((row) => Number(row.channelId)));

    out.write('{\n  "exportedAt": ' + JSON.stringify(new Date().toISOString()) + ",\n");
    out.write('  "guild": ' + JSON.stringify({ guildId: Number(guild.guildId), name: guild.name, description: guild.description }) + ",\n");
    out.write(
        '  "notice": ' +
            JSON.stringify(
                "Les salons chiffrés de bout en bout sont exportés sous forme d'enveloppes : " +
                    "le serveur n'en a jamais eu le texte clair. Seuls les appareils qui détiennent " +
                    "les clés peuvent les lire."
            ) +
            ",\n"
    );

    out.write('  "channels": ' + JSON.stringify(
        channels.map((row) => ({
            channelId: Number(row.channelId),
            name: row.name,
            type: row.type,
            encrypted: Boolean(row.e2eeEnabled),
        }))
    ) + ",\n");

    out.write('  "roles": ' + JSON.stringify(
        roles.map((row) => ({ roleId: Number(row.roleId), name: row.name, position: Number(row.position) }))
    ) + ",\n");

    out.write('  "members": ' + JSON.stringify(
        members.map((row) => ({ handle: row.handle, displayName: row.displayName, role: row.role }))
    ) + ",\n");

    out.write('  "messages": [');

    let after = "0";
    let first = true;
    let total = 0;

    for (;;) {
        const rows = await guildRepository.exportMessages(guild.guildId, after, PAGE);
        if (rows.length === 0) break;

        for (const row of rows) {
            out.write(first ? "\n    " : ",\n    ");
            first = false;
            out.write(
                JSON.stringify({
                    messageId: row.messageId,
                    channel: row.channelName,
                    author: row.webhookName || row.authorHandle,
                    isWebhook: Boolean(row.webhookName),
                    encrypted: encrypted.has(Number(row.channelId)),
                    content: row.content,
                    createdAt: row.createdAt,
                    editedAt: row.editedAt,
                })
            );
        }

        total += rows.length;
        after = rows.at(-1).messageId;
        if (rows.length < PAGE) break;
    }

    out.write('\n  ],\n  "messageCount": ' + total + "\n}\n");
    return total;
}

module.exports = { stream, PAGE };
