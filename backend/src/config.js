"use strict";

const { z } = require("zod");

require("dotenv").config();

const csv = z
    .string()
    .transform((value) =>
        value
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean)
    )
    .pipe(z.array(z.string().url()).min(1));

const flag = (fallback) =>
    z
        .enum(["true", "false"])
        .default(fallback)
        .transform((value) => value === "true");

const schema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    INSTANCE_NAME: z.string().trim().min(1).max(80).default("Qweillo"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
    CORS_ORIGIN: csv.default("http://localhost:5173"),

    JWT_SECRET: z.string().min(32, "JWT_SECRET doit faire au moins 32 caractères"),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(300).max(1800).default(900),
    SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    ARGON2_MEMORY_KIB: z.coerce.number().int().min(19_456).max(262_144).default(65_536),
    ARGON2_TIME_COST: z.coerce.number().int().min(2).max(10).default(3),
    ARGON2_PARALLELISM: z.coerce.number().int().min(1).max(4).default(1),

    DB_HOST: z.string().min(1),
    DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
    DB_USER: z.string().min(1),
    DB_PASSWORD: z.string(),
    DB_DATABASE: z.string().min(1),
    DB_CONNECTION_LIMIT: z.coerce.number().int().min(1).max(100).default(10),

    S3_ENDPOINT: z.string().url().or(z.literal("")).default(""),
    S3_REGION: z.string().default("us-east-1"),
    S3_BUCKET: z.string().default(""),
    S3_ACCESS_KEY_ID: z.string().default(""),
    S3_SECRET_ACCESS_KEY: z.string().default(""),
    S3_FORCE_PATH_STYLE: flag("true"),
    S3_PUBLIC_URL: z.string().url().or(z.literal("")).default(""),
    LOCAL_STORAGE_DIR: z.string().default(""),
    STORAGE_PUBLIC_URL: z.string().default("/media"),

    MAX_ATTACHMENT_BYTES: z.coerce
        .number()
        .int()
        .min(1024)
        .default(2 * 1024 * 1024 * 1024),
    UPLOAD_TMP_DIR: z.string().default("/tmp/qweillo-uploads"),

    MAINTENANCE_FILE: z.string().default("/data/maintenance"),

    SMTP_HOST: z.string().default(""),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).or(z.literal("")).default(""),
    SMTP_USER: z.string().default(""),
    SMTP_PASSWORD: z.string().default(""),
    MAIL_FROM: z.string().default(""),
    PUBLIC_URL: z.string().url().or(z.literal("")).default(""),

    VAPID_PUBLIC_KEY: z.string().default(""),
    VAPID_PRIVATE_KEY: z.string().default(""),
    VAPID_SUBJECT: z.string().default(""),

    LIVEKIT_URL: z.string().url().or(z.literal("")).default(""),
    LIVEKIT_INTERNAL_URL: z.string().url().or(z.literal("")).default(""),
    LIVEKIT_API_KEY: z.string().default(""),
    LIVEKIT_API_SECRET: z.string().default(""),
    LIVEKIT_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(300).default(300),
    LIVEKIT_TURN_HOST: z.string().default(""),
    LIVEKIT_TURN_PORT: z.coerce.number().int().min(1).max(65535).default(3478),

    LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
    LOG_FORMAT: z.enum(["json", "pretty"]).default("json"),
    SLOW_QUERY_MS: z.coerce.number().int().min(1).default(200),

    REDIS_URL: z.string().url().or(z.literal("")).default(""),

    NODE_ID: z.coerce.number().int().min(0).max(1023).default(0),

    PRESENCE_TTL_SECONDS: z.coerce.number().int().min(15).max(300).default(60),
    METRICS_ENABLED: flag("true"),
    SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60_000).default(15_000),
});

function load(env) {
    const parsed = schema.safeParse(env);

    if (!parsed.success) {
        const details = parsed.error.issues
            .map((issue) => `  · ${issue.path.join(".") || "(racine)"} — ${issue.message}`)
            .join("\n");
        throw new Error(`Configuration invalide :\n${details}`);
    }

    const config = parsed.data;

    const s3Keys = ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_PUBLIC_URL"];
    const s3Enabled = config.S3_ENDPOINT !== "";
    if (s3Enabled) {
        const missing = s3Keys.filter((key) => config[key] === "");
        if (missing.length > 0) {
            throw new Error(
                `Configuration invalide : S3_ENDPOINT est défini mais ${missing.join(", ")} manque(nt). ` +
                    "Laisser S3_ENDPOINT vide pour désactiver complètement l'upload d'images."
            );
        }
    }

    const localStorageEnabled = config.LOCAL_STORAGE_DIR !== "";
    if (localStorageEnabled && !/^(https?:\/\/|\/)/.test(config.STORAGE_PUBLIC_URL)) {
        throw new Error("Configuration invalide : STORAGE_PUBLIC_URL doit être une URL HTTP(S) ou un chemin absolu.");
    }

    const mediaKeys = ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"];
    const mediaValues = mediaKeys.map((key) => config[key]);
    const mediaEnabled = mediaValues.every(Boolean);
    if (mediaValues.some(Boolean) && !mediaEnabled) {
        const missing = mediaKeys.filter((key) => config[key] === "");
        throw new Error(`Configuration invalide : configuration LiveKit incomplète (${missing.join(", ")}).`);
    }

    const isProduction = config.NODE_ENV === "production";

    if (isProduction && config.REDIS_URL === "") {
        throw new Error(
            "Configuration invalide : REDIS_URL est requis en production (coordination multi-nœuds). " +
                "Le mode mémoire mono-nœud n'est destiné qu'au développement."
        );
    }

    if (isProduction && !mediaEnabled) {
        throw new Error(
            "Configuration invalide : LIVEKIT_URL, LIVEKIT_API_KEY et LIVEKIT_API_SECRET sont requis en production."
        );
    }

    const publicOrigin = config.PUBLIC_URL || config.CORS_ORIGIN[0] || "";

    return Object.freeze({
        ...config,
        isProduction,
        secureCookies: /^https:\/\//i.test(publicOrigin),
        isTest: config.NODE_ENV === "test",
        storageEnabled: s3Enabled || localStorageEnabled,
        s3Enabled,
        localStorageEnabled,
        mediaEnabled,
        redisEnabled: config.REDIS_URL !== "",
    });
}

module.exports = load(process.env);
