"use strict";

const taskRepository = require("../repositories/taskRepository");
const accessService = require("./accessService");
const realtime = require("../realtime");
const { BadRequest, Forbidden, NotFound } = require("../errors");

const STATUSES = ["todo", "doing", "done"];

function isOverdue(row, now = Date.now()) {
    if (row.status === "done" || !row.dueAt) return false;
    return new Date(row.dueAt).getTime() < now;
}

const toTask = (row) => ({
    taskId: Number(row.taskId),
    title: row.title,
    details: row.details ?? "",
    status: row.status,
    position: Number(row.position),
    dueAt: row.dueAt ?? null,
    overdue: isOverdue(row),
    createdBy: Number(row.createdBy),
    assigneeId: row.assigneeId == null ? null : Number(row.assigneeId),
    completedAt: row.completedAt ?? null,
    assignee: row.assigneeHandle
        ? {
              userId: Number(row.assigneeId),
              handle: row.assigneeHandle,
              displayName: row.assigneeDisplayName,
              avatar: row.assigneeAvatar,
          }
        : null,
});

function parseDue(value) {
    if (value == null || value === "") return null;
    const due = new Date(value);
    if (Number.isNaN(due.getTime())) throw new BadRequest("Échéance invalide.");
    return due;
}

async function create(channel, user, input) {
    const title = (input.title ?? "").trim();
    if (title.length === 0) throw new BadRequest("Une tâche a besoin d'un intitulé.");
    await validateAssignee(channel, input.assigneeId);

    const { position } = await taskRepository.nextPosition(channel.channelId, "todo");
    const taskId = await taskRepository.create({
        channelId: channel.channelId,
        guildId: channel.guildId,
        title: title.slice(0, 160),
        details: (input.details ?? "").trim().slice(0, 2000),
        assigneeId: input.assigneeId ?? null,
        dueAt: parseDue(input.dueAt),
        position,
        createdBy: user.userId,
    });

    const task = toTask(await taskRepository.findById(taskId));
    realtime.emitToChannel(Number(channel.channelId), "task:created", task);
    return task;
}

async function board(channel) {
    const rows = await taskRepository.listByChannel(channel.channelId);
    const columns = { todo: [], doing: [], done: [] };
    for (const row of rows) columns[row.status]?.push(toTask(row));
    return {
        columns,
        overdue: rows.filter((row) => isOverdue(row)).length,
    };
}

async function update(channel, user, taskId, input) {
    const row = await taskRepository.findById(taskId);
    if (!row || Number(row.channelId) !== Number(channel.channelId)) throw new NotFound("Tâche introuvable.");

    const fields = {};
    if (input.title !== undefined) {
        const title = String(input.title).trim();
        if (title.length === 0) throw new BadRequest("Une tâche a besoin d'un intitulé.");
        fields.title = title.slice(0, 160);
    }
    if (input.details !== undefined) fields.details = String(input.details).trim().slice(0, 2000);
    if (input.assigneeId !== undefined) {
        await validateAssignee(channel, input.assigneeId);
        fields.assigneeId = input.assigneeId ?? null;
    }
    if (input.dueAt !== undefined) fields.dueAt = parseDue(input.dueAt);

    if (input.status !== undefined) {
        if (!STATUSES.includes(input.status)) throw new BadRequest("Colonne inconnue.");
        fields.status = input.status;
        if (input.position === undefined && input.status !== row.status) {
            const { position } = await taskRepository.nextPosition(channel.channelId, input.status);
            fields.position = position;
        }
        if (input.status === "done" && !row.completedAt) fields.completedAt = new Date();
        if (input.status !== "done") fields.completedAt = null;
    }
    if (input.position !== undefined) fields.position = input.position;

    if (Object.keys(fields).length === 0) throw new BadRequest("Aucune modification fournie.");

    await taskRepository.update(taskId, fields);
    const task = toTask(await taskRepository.findById(taskId));
    realtime.emitToChannel(Number(channel.channelId), "task:updated", task);
    return task;
}

async function remove(channel, user, taskId) {
    const row = await taskRepository.findById(taskId);
    if (!row || Number(row.channelId) !== Number(channel.channelId)) throw new NotFound("Tâche introuvable.");
    if (Number(row.createdBy) !== Number(user.userId)) {
        throw new Forbidden("Seule la personne qui a créé cette tâche peut la supprimer.");
    }

    await taskRepository.remove(taskId, channel.channelId);
    realtime.emitToChannel(Number(channel.channelId), "task:removed", { taskId: Number(taskId) });
    return { taskId: Number(taskId) };
}

async function validateAssignee(channel, userId) {
    if (
        userId != null &&
        !(await accessService.hasChannelPermission(userId, channel.channelId, "VIEW_CHANNEL", channel))
    ) {
        throw new BadRequest("Le responsable doit avoir accès à ce salon.");
    }
}

module.exports = { create, board, update, remove, isOverdue, STATUSES };
