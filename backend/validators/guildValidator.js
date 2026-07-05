const { z } = require("zod");

const createGuildSchema = z.object({
    guildName: z
        .string()
        .min(3, "Le nom de la guilde doit comporter au moins 3 caractères")
        .max(50, "Le nom de la guilde doit comporter au maximum 50 caractères"),
    guildDescription: z
        .string()
        .max(200, "La description de la guilde doit comporter au maximum 200 caractères")
        .optional()
        .default("Aucune description"),
});

module.exports = {
    createGuildSchema,
};
