"use strict";

const modeRepository = require("../repositories/channelModeRepository");
const channelModes = require("../domain/channelModes");
const { BadRequest, Conflict, NotFound } = require("../errors");

const MAX_PER_GUILD = 20;

const toMode = (row) => ({
    modeId: Number(row.modeId),
    name: row.name,
    baseType: row.baseType,
    icon: row.icon,
    acceptsMessages: row.acceptsMessages === null ? null : Boolean(row.acceptsMessages),
    requiresThread: row.requiresThread === null ? null : Boolean(row.requiresThread),
    requiresPoll: row.requiresPoll === null ? null : Boolean(row.requiresPoll),
    requiresAttachment: row.requiresAttachment === null ? null : Boolean(row.requiresAttachment),
    pinnedFirst: row.pinnedFirst === null ? null : Boolean(row.pinnedFirst),
    refusal: row.refusal,
    createdAt: row.createdAt,
    resolved: channelModes.resolveMode(row.baseType, row),
});

const list = async (guildId) => (await modeRepository.listForGuild(guildId)).map(toMode);

function clean(input) {
    const name = String(input.name ?? "").trim();
    if (name.length < 2) throw new BadRequest("Donnez un nom à ce mode.");

    if (!channelModes.MODES[input.baseType]) {
        throw new BadRequest(`« ${input.baseType} » n'est pas un mode de départ connu.`);
    }

    const levers = {};
    for (const key of channelModes.OVERRIDABLE) {
        levers[key] = input[key] === null || input[key] === undefined ? null : Boolean(input[key]);
    }

    return {
        name: name.slice(0, 40),
        baseType: input.baseType,
        icon: String(input.icon ?? "hash").slice(0, 24),
        refusal: input.refusal ? String(input.refusal).slice(0, 200) : null,
        ...levers,
    };
}

async function create(guild, user, input) {
    const existing = await modeRepository.listForGuild(guild.guildId);
    if (existing.length >= MAX_PER_GUILD) throw new Conflict("Cette communauté a atteint son nombre de modes.");

    const data = clean(input);
    if (existing.some((row) => row.name.toLowerCase() === data.name.toLowerCase())) {
        throw new Conflict("Un mode porte déjà ce nom.");
    }

    const modeId = await modeRepository.create({ ...data, guildId: guild.guildId, createdBy: user.userId });
    return { mode: toMode(await modeRepository.findById(modeId)) };
}

async function update(guild, modeId, input) {
    const row = await modeRepository.findById(modeId);
    if (!row || Number(row.guildId) !== Number(guild.guildId)) throw new NotFound("Mode introuvable.");

    await modeRepository.update(modeId, guild.guildId, clean({ ...toMode(row), ...input }));
    return { mode: toMode(await modeRepository.findById(modeId)) };
}

async function remove(guild, modeId) {
    const { affectedRows } = await modeRepository.remove(modeId, guild.guildId);
    if (!affectedRows) throw new NotFound("Mode introuvable.");
    return { modeId: Number(modeId), removed: true };
}

module.exports = { list, create, update, remove, clean, MAX_PER_GUILD };
