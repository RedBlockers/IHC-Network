"use strict";

const { query } = require("../db/pool");
const { BadRequest, NotFound } = require("../errors");
const channelRepository = require("../repositories/channelRepository");

const toRule = (row) => ({
    automationId: Number(row.automationId),
    name: row.name,
    event: row.event,
    action: row.action,
    channelId: Number(row.channelId),
    template: row.template,
    enabled: Boolean(row.enabled),
    createdAt: row.createdAt,
});

async function list(guildId) {
    const rows = await query(
        "automations.list",
        `SELECT automationId, guildId, name, event, action, channelId, template, enabled, createdAt
           FROM guild_automations WHERE guildId = ? ORDER BY automationId DESC`,
        [guildId]
    );
    return rows.map(toRule);
}

async function create(guild, user, input) {
    const name = (input.name ?? "").trim();
    if (!name) throw new BadRequest("Une automatisation a besoin d'un nom.");
    const target = await channelRepository.findById(input.channelId);
    if (!target || Number(target.guildId) !== Number(guild.guildId)) {
        throw new BadRequest("Le salon cible n'appartient pas à cette communauté.");
    }
    const result = await query(
        "automations.create",
        `INSERT INTO guild_automations (guildId, name, event, action, channelId, template, createdBy)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            guild.guildId,
            name.slice(0, 80),
            input.event,
            input.action,
            input.channelId,
            (input.template ?? "").slice(0, 500),
            user.userId,
        ]
    );
    return { automationId: result.insertId, name: name.slice(0, 80), event: input.event, action: input.action };
}

async function remove(guildId, automationId) {
    const result = await query(
        "automations.remove",
        "DELETE FROM guild_automations WHERE automationId = ? AND guildId = ?",
        [automationId, guildId]
    );
    if (!result.affectedRows) throw new NotFound("Automatisation introuvable.");
    return { automationId: Number(automationId) };
}

async function setEnabled(guildId, automationId, enabled) {
    const result = await query(
        "automations.setEnabled",
        "UPDATE guild_automations SET enabled = ? WHERE automationId = ? AND guildId = ?",
        [enabled ? 1 : 0, automationId, guildId]
    );
    if (!result.affectedRows) throw new NotFound("Automatisation introuvable.");
    return { automationId: Number(automationId), enabled: Boolean(enabled) };
}

function renderTemplate(template, { event, author, channelName }) {
    return String(template || "Événement : {event}")
        .replaceAll("{event}", event)
        .replaceAll("{handle}", author.handle ?? "")
        .replaceAll("{channel}", channelName ?? "")
        .slice(0, 4000);
}

async function runRules(rows, author, event, sourceChannel) {
    if (rows.length === 0) return;
    const messageService = require("./messageService");
    const taskService = require("./taskService");
    for (const row of rows) {
        if (
            sourceChannel &&
            Number(row.channelId) === Number(sourceChannel.channelId) &&
            row.action === "post_message"
        ) {
            continue;
        }
        const target = await channelRepository.findById(row.channelId);
        if (!target || (target.expiresAt && new Date(target.expiresAt).getTime() <= Date.now())) continue;
        const text = renderTemplate(row.template, {
            event,
            author,
            channelName: sourceChannel?.name ?? target.name ?? "",
        });
        if (row.action === "post_message") {
            await messageService.postMessage(target, author, { content: text }, { skipAutomations: true });
        } else if (row.action === "create_task") {
            await taskService.create(target, author, { title: text.slice(0, 160) });
        }
    }
}

async function dispatch(channel, author, event, _message) {
    if (!channel.guildId) return;
    const rows = await query(
        "automations.active",
        `SELECT automationId, action, channelId, template
           FROM guild_automations
          WHERE guildId = ? AND event = ? AND enabled = 1`,
        [channel.guildId, event]
    );
    await runRules(rows, author, event, channel);
}

async function dispatchGuild(guildId, author, event) {
    if (!guildId) return;
    const rows = await query(
        "automations.active",
        `SELECT automationId, action, channelId, template
           FROM guild_automations
          WHERE guildId = ? AND event = ? AND enabled = 1`,
        [guildId, event]
    );
    await runRules(rows, author, event, null);
}

module.exports = { list, create, remove, setEnabled, dispatch, dispatchGuild };
