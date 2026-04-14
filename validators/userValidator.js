const { z } = require("zod");

const registerSchema = z.object({
    handle: z
        .string()
        .min(3, "Le pseudo doit comporter au moins 3 caractères")
        .max(20, "Le pseudo doit comporter au maximum 20 caractères"),
    email: z.email("L'email doit être valide"),
    password: z
        .string()
        .min(2, "Le mot de passe doit comporter au moins 2 caractères"),
    profilePicture: z.string().optional(),
});

const loginSchema = z.object({
    handle: z
        .string()
        .min(3, "Le pseudo doit comporter au moins 3 caractères")
        .max(20, "Le pseudo doit comporter au maximum 20 caractères"),
    password: z
        .string()
        .min(2, "Le mot de passe doit comporter au moins 2 caractères"),
});

const addFriendRequestSchema = z.object({
    friendHandle: z
        .string()
        .min(3, "Le pseudo doit comporter au moins 3 caractères")
        .max(20, "Le pseudo doit comporter au maximum 20 caractères"),
});

const friendRequestSchema = z.object({
    friendId: z.number().int("L'ID de l'ami doit être un entier"),
});

module.exports = {
    registerSchema,
    loginSchema,
    addFriendRequestSchema,
    friendRequestSchema,
};
