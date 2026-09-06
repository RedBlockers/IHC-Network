#!/bin/sh
set -eu
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
if [ "$(uname -s)" != "Linux" ]; then set -- --local-only "$@"; fi
if command -v node >/dev/null 2>&1 && node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)'; then
    exec node "$project_dir/scripts/setup.mjs" "$@"
fi
if [ -t 0 ]; then
    exec docker run --rm -it --user "$(id -u):$(id -g)" -v "$project_dir:$project_dir" -w "$project_dir" node:22-alpine node scripts/setup.mjs "$@"
fi
exec docker run --rm --user "$(id -u):$(id -g)" -v "$project_dir:$project_dir" -w "$project_dir" node:22-alpine node scripts/setup.mjs "$@"
