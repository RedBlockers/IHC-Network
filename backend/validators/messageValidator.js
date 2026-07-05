const { z } = require("zod");

const postMessageSchema = z.object({
    messageContent: z
        .string()
        .min(1, "Le message ne peut pas être vide")
        .max(2000, "Le message est trop long (max 2000 caractères)"),
});

module.exports = { postMessageSchema };
