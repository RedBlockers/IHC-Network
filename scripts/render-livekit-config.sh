#!/bin/sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
if command -v node >/dev/null 2>&1 && node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)'; then
    exec node "$project_dir/scripts/render-livekit-config.mjs" "$@"
fi
exec docker run --rm --user "$(id -u):$(id -g)" -v "$project_dir:/app" -w /app node:22-alpine node scripts/render-livekit-config.mjs "$@"
