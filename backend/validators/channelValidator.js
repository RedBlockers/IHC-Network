const { z } = require("zod");

const createChannelSchema = z.object({
    type: z.enum(["text", "voice"]).default("text"),
    name: z
        .string()
        .min(1, "Le nom du salon est requis")
        .max(50, "Le nom du salon est trop long (max 50 caractères)"),
    description: z
        .string()
        .max(200, "La description est trop longue (max 200 caractères)")
        .optional()
        .default(""),
});

module.exports = { createChannelSchema };
