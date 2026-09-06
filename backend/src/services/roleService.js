"use strict";

const { withTransaction, DUPLICATE_ENTRY } = require("../db/pool");
const { BadRequest, Conflict, Forbidden, NotFound } = require("../errors");
const roleRepository = require("../repositories/roleRepository");
const realtime = require("../realtime");
const { effectiveGuildPermissions } = require("./accessService");
const { TEMPLATES, findTemplate, rulesOf } = require("../domain/roleTemplates");

function mapRole(row) {
    return {
        roleId: Number(row.roleId),
        guildId: row.guildId == null ? undefined : Number(row.guildId),
        name: row.name,
        iconEmoji: row.iconEmoji ?? null,
        color: row.color,
        position: Number(row.position),
        isDefault: Boolean(row.isDefault),
        isManaged: Boolean(row.isManaged),
        mentionable: Boolean(row.mentionable),
        memberCount: row.memberCount == null ? undefined : Number(row.memberCount),
    };
}

async function list(guildId) {
    const rows = await roleRepository.listByGuild(guildId);
    const roles = new Map();
    for (const row of rows) {
        if (!roles.has(Number(row.roleId))) roles.set(Number(row.roleId), { ...mapRole(row), permissions: {} });
        if (row.permission) roles.get(Number(row.roleId)).permissions[row.permission] = row.effect;
    }
    return [...roles.values()];
}

async function grantable(guild, actor) {
    if (Number(guild.ownerId) === Number(actor.userId)) return null;
    return new Set(await effectiveGuildPermissions(actor.userId, guild.guildId));
}

async function assertGrantable(guild, actor, permissions) {
    if (!permissions) return;
    const held = await grantable(guild, actor);
    if (held === null) return;

    const refused = Object.entries(permissions)
        .filter(([permission, effect]) => effect === "allow" && !held.has(permission))
        .map(([permission]) => permission);

    if (refused.length > 0) {
        throw new Forbidden(
            "Vous ne pouvez accorder que les permissions que vous détenez vous-même.",
            { details: { permissions: refused } }
        );
    }
}

async function templatesFor(guild, actor) {
    const held = await grantable(guild, actor);
    return TEMPLATES.map((template) => {
        const missing = held === null ? [] : template.permissions.filter((permission) => !held.has(permission));
        return {
            id: template.id,
            name: template.name,
            iconEmoji: template.iconEmoji,
            color: template.color,
            summary: template.summary,
            excludes: template.excludes,
            permissions: template.permissions,
            available: missing.length === 0,
            missing,
        };
    });
}

async function createFromTemplate(guild, actor, templateId, overrides = {}) {
    const template = findTemplate(templateId);
    if (!template) throw new NotFound("Modèle de rôle inconnu.");

    return create(guild, actor, {
        name: overrides.name?.trim() || template.name,
        iconEmoji: template.iconEmoji,
        color: overrides.color || template.color,
        mentionable: false,
        permissions: rulesOf(template),
    });
}

async function create(guild, actor, data) {
    await assertGrantable(guild, actor, data.permissions);
    const position = await allowedPosition(guild, actor, data.position);
    try {
        const roleId = await withTransaction(async (connection) => {
            const id = await roleRepository.create(guild.guildId, { ...data, position }, connection);
            await replacePermissions(id, data.permissions ?? {}, connection);
            return id;
        });
        const role = (await list(guild.guildId)).find((item) => item.roleId === roleId);
        realtime.emitToGuild(guild.guildId, "role:created", role);
        return role;
    } catch (error) {
        if (error.code === DUPLICATE_ENTRY) throw new Conflict("Un rôle porte déjà ce nom.");
        throw error;
    }
}

async function update(guild, actor, roleId, data) {
    const role = await requireManageableRole(guild, actor, roleId);
    const { permissions, ...rawFields } = data;
    await assertGrantable(guild, actor, permissions);
    const fields = rawFields.position == null
        ? rawFields
        : { ...rawFields, position: await allowedPosition(guild, actor, rawFields.position) };
    try {
        await withTransaction(async (connection) => {
            if (Object.keys(fields).length > 0) {
                const changed = await roleRepository.update(guild.guildId, roleId, fields, connection);
                if (!changed && !role.isManaged) throw new NotFound("Rôle introuvable.");
            }
            if (permissions) await replacePermissions(roleId, permissions, connection);
        });
    } catch (error) {
        if (error.code === DUPLICATE_ENTRY) throw new Conflict("Un rôle porte déjà ce nom.");
        throw error;
    }
    const updated = (await list(guild.guildId)).find((item) => item.roleId === roleId);
    realtime.emitToGuild(guild.guildId, "role:updated", updated);
    return updated;
}

async function remove(guild, actor, roleId) {
    await requireManageableRole(guild, actor, roleId);
    if (!(await roleRepository.remove(guild.guildId, roleId))) throw new Forbidden("Ce rôle système ne peut pas être supprimé.");
    realtime.emitToGuild(guild.guildId, "role:deleted", { roleId });
}

async function assign(guild, actor, userId, roleId, enabled) {
    const role = await requireManageableRole(guild, actor, roleId);
    if (role.isDefault) throw new BadRequest("Le rôle par défaut est attribué automatiquement.");
    if (!(await roleRepository.memberExists(guild.guildId, userId))) throw new NotFound("Membre introuvable.");
    if (Number(guild.ownerId) !== Number(actor.userId)) {
        const [actorPosition, targetPosition] = await Promise.all([
            roleRepository.highestPositionForMember(guild.guildId, actor.userId),
            roleRepository.highestPositionForMember(guild.guildId, userId),
        ]);
        if (targetPosition >= actorPosition) throw new Forbidden("Vous ne pouvez pas modifier les rôles de ce membre.");
    }
    if (enabled) await roleRepository.assign(guild.guildId, userId, roleId);
    else await roleRepository.unassign(guild.guildId, userId, roleId);
    const roles = (await roleRepository.listForMember(guild.guildId, userId)).map(mapRole);
    realtime.emitToGuild(guild.guildId, "member:roles", { userId, roles });
    return roles;
}

async function reorder(guild, actor, order) {
    const existing = await list(guild.guildId);
    const movable = new Map(existing.filter((role) => !role.isDefault && !role.isManaged).map((role) => [role.roleId, role]));

    const ids = order.map(Number);
    if (new Set(ids).size !== ids.length) throw new BadRequest("Un rôle apparaît deux fois dans l'ordre demandé.");
    for (const roleId of ids) {
        if (!movable.has(roleId)) throw new BadRequest("Un rôle de cette liste ne peut pas être déplacé.");
    }

    const ceiling = Number(guild.ownerId) === Number(actor.userId)
        ? 999
        : Math.max(0, (await roleRepository.highestPositionForMember(guild.guildId, actor.userId)) - 1);

    await withTransaction(async (connection) => {
        for (const [index, roleId] of ids.entries()) {
            const position = ceiling - index;
            if (position < 1) throw new BadRequest("Trop de rôles pour les placer sous le vôtre.");
            await roleRepository.setPosition(guild.guildId, roleId, position, connection);
        }
    });

    const roles = await list(guild.guildId);
    realtime.emitToGuild(guild.guildId, "role:reordered", { roles });
    return roles;
}

async function requireManageableRole(guild, actor, roleId) {
    const role = await roleRepository.findById(guild.guildId, roleId);
    if (!role) throw new NotFound("Rôle introuvable.");
    if (role.isManaged) throw new Forbidden("Ce rôle système ne peut pas être modifié.");
    if (Number(guild.ownerId) !== Number(actor.userId)) {
        const actorPosition = await roleRepository.highestPositionForMember(guild.guildId, actor.userId);
        if (Number(role.position) >= actorPosition) throw new Forbidden("Vous ne pouvez modifier que les rôles situés sous le vôtre.");
    }
    return role;
}

async function allowedPosition(guild, actor, requested) {
    const max = Number(guild.ownerId) === Number(actor.userId)
        ? 999
        : Math.max(0, (await roleRepository.highestPositionForMember(guild.guildId, actor.userId)) - 1);
    return Math.min(requested ?? max, max);
}

async function replacePermissions(roleId, permissions, connection) {
    await roleRepository.clearPermissions(roleId, connection);
    for (const [permission, effect] of Object.entries(permissions)) {
        if (effect === "inherit") continue;
        await roleRepository.setPermission(roleId, permission, effect, connection);
    }
}

module.exports = {
    templatesFor,
    createFromTemplate,
    reorder, list, create, update, remove, assign, mapRole };
