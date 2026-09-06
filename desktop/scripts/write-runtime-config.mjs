import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { resolveEndpoint } = require("../src/security.cjs");

const publicUrl = process.env.QWEILLO_PUBLIC_URL
    ? resolveEndpoint({
          configuredUrl: process.env.QWEILLO_PUBLIC_URL,
          isPackaged: true,
      })
    : null;

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await writeFile(path.join(desktopRoot, "runtime-config.json"), `${JSON.stringify({ publicUrl }, null, 2)}\n`, {
    mode: 0o600,
});
