"use strict";

const categoryRepository = require("../repositories/categoryRepository");
const realtime = require("../realtime");
const { BadRequest, NotFound } = require("../errors");
const { withTransaction } = require("../db/pool");
const channelRepository = require("../repositories/channelRepository");
const { toCategory } = require("../domain/mappers");

const CATEGORY_MISSING = "Catégorie introuvable dans cette communauté.";

async function requireOwned(guildId, categoryId, connection) {
    const row = await categoryRepository.findById(categoryId, connection);
    if (!row || Number(row.guildId) !== Number(guildId)) throw new NotFound(CATEGORY_MISSING);
    return row;
}

async function list(guildId) {
    const rows = await categoryRepository.listByGuild(guildId);
    return rows.map(toCategory);
}

async function create(guildId, { name }) {
    const { position } = await categoryRepository.nextPosition(guildId);
    const label = name.trim().toUpperCase();
    const categoryId = await categoryRepository.create({ guildId, name: label, position });
    const category = { categoryId: Number(categoryId), guildId: Number(guildId), name: label, position: Number(position) };
    realtime.emitToGuild(Number(guildId), "category:created", category);
    return category;
}

async function update(guildId, categoryId, patch) {
    const existing = await requireOwned(guildId, categoryId);
    const name = patch.name === undefined ? existing.name : patch.name.trim().toUpperCase();
    const position = patch.position === undefined ? Number(existing.position) : patch.position;

    const changed = await categoryRepository.update(categoryId, guildId, { name, position });
    if (!changed) throw new NotFound(CATEGORY_MISSING);

    const category = { categoryId: Number(categoryId), guildId: Number(guildId), name, position: Number(position) };
    realtime.emitToGuild(Number(guildId), "category:updated", category);
    return category;
}

async function remove(guildId, categoryId) {
    await requireOwned(guildId, categoryId);
    const deleted = await categoryRepository.delete(categoryId, guildId);
    if (!deleted) throw new NotFound(CATEGORY_MISSING);
    realtime.emitToGuild(Number(guildId), "category:deleted", { categoryId: Number(categoryId) });
}

async function reorder(guildId, order) {
    const rows = await categoryRepository.listByGuild(guildId);
    const known = new Set(rows.map((row) => Number(row.categoryId)));
    const wanted = order.map(Number);

    if (wanted.length !== known.size || new Set(wanted).size !== wanted.length) {
        throw new BadRequest("L'ordre doit citer chaque catégorie une fois exactement.");
    }
    for (const categoryId of wanted) {
        if (!known.has(categoryId)) throw new NotFound(CATEGORY_MISSING);
    }

    await withTransaction(async (connection) => {
        for (const [index, categoryId] of wanted.entries()) {
            await categoryRepository.setPosition(categoryId, guildId, index, connection);
        }
    });

    const categories = await list(guildId);
    realtime.emitToGuild(Number(guildId), "category:reordered", { categories });
    return categories;
}

async function reorderChannels(guildId, categoryId, order) {
    if (categoryId != null) await requireOwned(guildId, categoryId);

    const rows = await channelRepository.listByGuild(guildId);
    const known = new Map(rows.map((row) => [Number(row.channelId), row]));
    const wanted = order.map(Number);

    if (new Set(wanted).size !== wanted.length) {
        throw new BadRequest("Un salon ne peut pas figurer deux fois dans l'ordre.");
    }
    for (const channelId of wanted) {
        if (!known.has(channelId)) throw new NotFound("Salon introuvable dans cette communauté.");
    }

    await withTransaction(async (connection) => {
        for (const [index, channelId] of wanted.entries()) {
            await channelRepository.setPlacement(channelId, guildId, { categoryId, position: index }, connection);
        }
    });

    realtime.emitToGuild(Number(guildId), "channel:reordered", {
        categoryId: categoryId == null ? null : Number(categoryId),
        order: wanted,
    });
    return { categoryId: categoryId == null ? null : Number(categoryId), order: wanted };
}

module.exports = { list, create, update, remove, reorder, reorderChannels, requireOwned, CATEGORY_MISSING };
