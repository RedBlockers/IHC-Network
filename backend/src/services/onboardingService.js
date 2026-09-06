"use strict";

const onboardingRepository = require("../repositories/onboardingRepository");
const roleRepository = require("../repositories/roleRepository");
const realtime = require("../realtime");
const { withTransaction } = require("../db/pool");
const { BadRequest, Forbidden } = require("../errors");

const MAX_QUESTIONS = 10;
const MAX_OPTIONS = 12;

const EMPTY = { enabled: false, rules: "", quarantineMinutes: 0, questions: [] };

function groupQuestions(rows) {
    const questions = new Map();
    for (const row of rows) {
        if (!questions.has(Number(row.questionId))) {
            questions.set(Number(row.questionId), {
                questionId: Number(row.questionId),
                prompt: row.prompt,
                position: Number(row.position),
                options: [],
            });
        }
        if (row.optionId != null) {
            questions.get(Number(row.questionId)).options.push({
                optionId: Number(row.optionId),
                label: row.label,
                roleId: row.roleId == null ? null : Number(row.roleId),
            });
        }
    }
    return [...questions.values()];
}

async function describe(guildId) {
    const [config, rows] = await Promise.all([
        onboardingRepository.findConfig(guildId),
        onboardingRepository.listQuestions(guildId),
    ]);
    if (!config) return { ...EMPTY };
    return {
        enabled: Boolean(config.enabled),
        rules: config.rules,
        quarantineMinutes: Number(config.quarantineMinutes),
        questions: groupQuestions(rows),
    };
}

async function configure(guildId, { enabled, rules, quarantineMinutes, questions }) {
    const text = (rules ?? "").trim();
    if (enabled && text.length === 0) {
        throw new BadRequest("Un onboarding actif a besoin d'un règlement à lire.");
    }
    if (questions.length > MAX_QUESTIONS) throw new BadRequest(`Dix questions au maximum (${questions.length} fournies).`);
    for (const question of questions) {
        if (question.options.length === 0) throw new BadRequest("Chaque question a besoin d'au moins une réponse.");
        if (question.options.length > MAX_OPTIONS) throw new BadRequest("Douze réponses au maximum par question.");
    }

    await withTransaction(async (connection) => {
        await onboardingRepository.upsertConfig(
            guildId,
            { enabled, rules: text, quarantineMinutes: Math.max(0, Math.min(quarantineMinutes ?? 0, 60 * 24 * 7)) },
            connection
        );
        await onboardingRepository.deleteQuestions(guildId, connection);
        for (const [index, question] of questions.entries()) {
            const questionId = await onboardingRepository.createQuestion(guildId, question.prompt.trim(), index, connection);
            for (const [optionIndex, option] of question.options.entries()) {
                await onboardingRepository.createOption(questionId, option, optionIndex, connection);
            }
        }
    });

    realtime.emitToGuild(Number(guildId), "onboarding:updated", { guildId: Number(guildId) });
    return describe(guildId);
}

async function statusFor(guildId, userId) {
    const config = await onboardingRepository.findConfig(guildId);
    if (!config || !config.enabled) return { required: false, completed: true, quarantineUntil: null };

    const [completion, membership] = await Promise.all([
        onboardingRepository.findCompletion(guildId, userId),
        onboardingRepository.joinedAt(guildId, userId),
    ]);

    const quarantineMinutes = Number(config.quarantineMinutes);
    const joinedAt = membership?.joinedAt ? new Date(membership.joinedAt) : null;
    const quarantineUntil =
        quarantineMinutes > 0 && joinedAt ? new Date(joinedAt.getTime() + quarantineMinutes * 60_000) : null;

    return {
        required: true,
        completed: Boolean(completion),
        acceptedAt: completion?.acceptedAt ?? null,
        quarantineUntil,
    };
}

async function assertMaySpeak(guildId, userId) {
    const status = await statusFor(guildId, userId);
    if (!status.required) return;

    if (!status.completed) {
        throw new Forbidden("Terminez l'accueil de la communauté avant d'écrire.", {
            details: { onboarding: "pending" },
        });
    }
    if (status.quarantineUntil && status.quarantineUntil.getTime() > Date.now()) {
        throw new Forbidden("Votre arrivée est encore en période d'observation.", {
            details: { onboarding: "quarantine", until: status.quarantineUntil },
        });
    }
}

async function complete(guild, user, { accepted, optionIds = [] }) {
    if (!accepted) throw new BadRequest("Le règlement doit être accepté pour rejoindre la conversation.");

    const config = await onboardingRepository.findConfig(guild.guildId);
    if (!config || !config.enabled) return statusFor(guild.guildId, user.userId);

    let roleIds = [];
    if (optionIds.length > 0) {
        const options = await onboardingRepository.findOptionsForGuild(guild.guildId, optionIds);
        if (options.length !== optionIds.length) throw new BadRequest("Réponse inconnue pour cette communauté.");
        roleIds = [...new Set(options.map((option) => option.roleId).filter(Boolean).map(Number))];
    }

    await withTransaction(async (connection) => {
        await onboardingRepository.complete(guild.guildId, user.userId, connection);
        for (const roleId of roleIds) {
            await roleRepository.assign(guild.guildId, user.userId, roleId, connection);
        }
    });

    if (roleIds.length > 0) {
        const roles = await roleRepository.listForMember(guild.guildId, user.userId);
        realtime.emitToGuild(Number(guild.guildId), "member:roles", { userId: Number(user.userId), roles });
    }

    return statusFor(guild.guildId, user.userId);
}

module.exports = { describe, configure, statusFor, assertMaySpeak, complete, MAX_QUESTIONS, MAX_OPTIONS };
