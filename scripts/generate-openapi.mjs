import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROUTES_DIR = "backend/src/routes";

const index = readFileSync(join(ROUTES_DIR, "index.js"), "utf8");
const mounts = Object.fromEntries(
    [...index.matchAll(/router\.use\("([^"]+)",\s*require\("\.\/(\w+)"\)\)/g)].map((m) => [m[2], m[1]])
);

const TAGS = {
    authRoutes: "Authentification",
    userRoutes: "Comptes",
    guildRoutes: "Communautés",
    channelRoutes: "Salons",
    messageRoutes: "Messages",
    notificationRoutes: "Notifications",
    organisationRoutes: "Organisation personnelle",
    statusRoutes: "État du service",
    webhookRoutes: "Webhooks",
};

const paths = {};

for (const file of readdirSync(ROUTES_DIR)) {
    if (!file.endsWith(".js") || file === "index.js") continue;

    const module = file.replace(/\.js$/, "");
    const prefix = mounts[module] ?? "";
    const source = readFileSync(join(ROUTES_DIR, file), "utf8");

    const guardsAll = /router\.use\(authenticate\)/.test(source);

    const declarations = [...source.matchAll(/router\.(get|post|put|patch|delete)\(\s*"([^"]*)"/g)];

    for (const [position, match] of declarations.entries()) {
        const method = match[1].toLowerCase();
        const route = match[2];
        const body = source.slice(match.index, declarations[position + 1]?.index ?? source.length);

        const path = (prefix + route).replace(/\/$/, "") || "/";
        const openapiPath = `/api/v1${path.replace(/:(\w+)/g, "{$1}")}`;

        const parameters = [...path.matchAll(/:(\w+)/g)].map((param) => ({
            name: param[1],
            in: "path",
            required: true,
            schema: { type: "string" },
        }));

        const authenticated = guardsAll || /authenticate/.test(body);

        paths[openapiPath] ??= {};
        paths[openapiPath][method] = {
            tags: [TAGS[module] ?? module],
            summary: `${method.toUpperCase()} ${path}`,
            ...(parameters.length > 0 ? { parameters } : {}),
            ...(authenticated ? { security: [{ bearerAuth: [] }] } : { security: [] }),
            responses: {
                200: { description: "Succès" },
                400: { description: "Requête invalide" },
                ...(authenticated ? { 401: { description: "Authentification requise" } } : {}),
                429: { description: "Cadence excessive" },
            },
        };
    }
}

const document = {
    openapi: "3.1.0",
    info: {
        title: "API qweillo",
        version: "1",
        description:
            "Description générée à partir des routes du serveur : chemins, méthodes et exigences " +
            "d'authentification. Les schémas de réponse ne sont pas décrits.",
    },
    servers: [{ url: "/", description: "Instance courante" }],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT",
                description:
                    "Jeton de session obtenu par POST /api/v1/auth/login (courte durée, rafraîchi via " +
                    "un cookie httpOnly) ou jeton d'accès personnel (préfixe qwp_) créé dans les réglages du compte.",
            },
        },
    },
    paths,
};

console.log(JSON.stringify(document, null, 2));
