"use strict";

const { query, queryOne } = require("../db/pool");

const onboardingRepository = {
    findConfig: (guildId, connection) =>
        queryOne(
            "onboarding.findConfig",
            "SELECT guildId, enabled, rules, quarantineMinutes FROM guild_onboarding WHERE guildId = ?",
            [guildId],
            connection
        ),

    upsertConfig: (guildId, { enabled, rules, quarantineMinutes }, connection) =>
        query(
            "onboarding.upsertConfig",
            `INSERT INTO guild_onboarding (guildId, enabled, rules, quarantineMinutes) VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), rules = VALUES(rules), quarantineMinutes = VALUES(quarantineMinutes)`,
            [guildId, enabled ? 1 : 0, rules, quarantineMinutes],
            connection
        ),

    listQuestions: (guildId, connection) =>
        query(
            "onboarding.listQuestions",
            `SELECT q.questionId, q.prompt, q.position,
                    o.optionId, o.label, o.roleId, o.position AS optionPosition
               FROM guild_onboarding_questions q
               LEFT JOIN guild_onboarding_options o ON o.questionId = q.questionId
              WHERE q.guildId = ?
              ORDER BY q.position ASC, q.questionId ASC, o.position ASC, o.optionId ASC`,
            [guildId],
            connection
        ),

    deleteQuestions: (guildId, connection) =>
        query("onboarding.deleteQuestions", "DELETE FROM guild_onboarding_questions WHERE guildId = ?", [guildId], connection),

    createQuestion: async (guildId, prompt, position, connection) => {
        const result = await query(
            "onboarding.createQuestion",
            "INSERT INTO guild_onboarding_questions (guildId, prompt, position) VALUES (?, ?, ?)",
            [guildId, prompt, position],
            connection
        );
        return result.insertId;
    },

    createOption: (questionId, option, position, connection) =>
        query(
            "onboarding.createOption",
            "INSERT INTO guild_onboarding_options (questionId, label, roleId, position) VALUES (?, ?, ?, ?)",
            [questionId, option.label, option.roleId ?? null, position],
            connection
        ),

    findOptionsForGuild: (guildId, optionIds, connection) =>
        query(
            "onboarding.findOptionsForGuild",
            `SELECT o.optionId, o.roleId
               FROM guild_onboarding_options o
               JOIN guild_onboarding_questions q ON q.questionId = o.questionId
              WHERE q.guildId = ? AND o.optionId IN (${optionIds.map(() => "?").join(", ")})`,
            [guildId, ...optionIds],
            connection
        ),

    findCompletion: (guildId, userId, connection) =>
        queryOne(
            "onboarding.findCompletion",
            "SELECT acceptedAt FROM guild_onboarding_completions WHERE guildId = ? AND userId = ?",
            [guildId, userId],
            connection
        ),

    complete: (guildId, userId, connection) =>
        query(
            "onboarding.complete",
            `INSERT INTO guild_onboarding_completions (guildId, userId) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE acceptedAt = acceptedAt`,
            [guildId, userId],
            connection
        ),

    joinedAt: (guildId, userId, connection) =>
        queryOne(
            "onboarding.joinedAt",
            "SELECT joinedAt FROM guild_members WHERE guildId = ? AND userId = ?",
            [guildId, userId],
            connection
        ),
};

module.exports = onboardingRepository;
