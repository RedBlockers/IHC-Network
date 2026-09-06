import { readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
try {
    const env = { ...parseEnv(await readFile(process.argv[2] || path.join(project, ".env"), "utf8")), ...process.env };
    const key = env.LIVEKIT_API_KEY;
    if (!key || !/^[A-Za-z0-9_-]+$/.test(key))
        throw new Error(
            "LIVEKIT_API_KEY est requis et doit contenir seulement lettres, chiffres, tirets ou soulignés."
        );
    const port = (name, fallback) => {
        const value = Number(env[name] || fallback);
        if (!Number.isInteger(value) || value < 1 || value > 65535)
            throw new Error(`${name} doit être un port valide.`);
        return String(value);
    };
    const values = {
        LIVEKIT_API_KEY: key,
        WEB_PORT: port("WEB_PORT", 8080),
        REDIS_HOST_PORT: port("REDIS_HOST_PORT", 6379),
    };
    const template = await readFile(path.join(project, "infra/livekit/livekit.production.yaml.template"), "utf8");
    const content = template.replace(/\$\{([A-Z_]+)\}/g, (_, name) => {
        if (!(name in values)) throw new Error(`Variable non prise en charge : ${name}`);
        return values[name];
    });
    await mkdir(path.join(project, "runtime"), { recursive: true, mode: 0o700 });
    await writeFile(path.join(project, "runtime/livekit.yaml"), content, { mode: 0o644 });
    await chmod(path.join(project, "runtime/livekit.yaml"), 0o644);
    process.stdout.write("Configuration LiveKit générée dans runtime/livekit.yaml.\n");
} catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
}
