#!/usr/bin/env bash
set -euo pipefail

DIR="${1:?Indiquer le répertoire de sauvegarde}"
STACK="${QWEILLO_STACK:-$(cd -- "$(dirname -- "$0")/.." && pwd)}"
SCRATCH_DB="qweillo_restore_$(date +%s)_$$"
COMPOSE=(docker compose --project-directory "$STACK" --env-file "${QWEILLO_ENV_FILE:-$STACK/.env}" -f "$STACK/docker-compose.yml")
if [[ -n "${QWEILLO_PROJECT_NAME:-}" ]]; then COMPOSE+=(-p "$QWEILLO_PROJECT_NAME"); fi
MYSQL_ID="$("${COMPOSE[@]}" ps -q mysql)"
[[ -n "$MYSQL_ID" ]] || { echo "La base doit être démarrée." >&2; exit 1; }

sql() { printf '%s\n' "$1" | docker exec -i "$MYSQL_ID" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot --batch --skip-column-names'; }
cleanup() { sql "DROP DATABASE IF EXISTS \`$SCRATCH_DB\`;"; }

echo "Vérification de l’archive…"
if command -v sha256sum >/dev/null 2>&1; then
    CHECKSUM=(sha256sum)
else
    CHECKSUM=(shasum -a 256)
fi
(cd "$DIR" && "${CHECKSUM[@]}" -c SHA256SUMS)
gzip -t "$DIR/qweillo.sql.gz"
tar -tzf "$DIR/uploads.tar.gz" >/dev/null
tar -tzf "$DIR/control.tar.gz" >/dev/null
if gzip -dc "$DIR/qweillo.sql.gz" | LC_ALL=C awk 'toupper($0) ~ /^[[:space:]]*(USE[[:space:]]|CREATE[[:space:]]+DATABASE)/ { found=1 } END { exit !found }'; then
    echo "Le fichier doit être une sauvegarde sans CREATE DATABASE ni USE. La restauration a été refusée." >&2
    exit 1
fi

sql "CREATE DATABASE \`$SCRATCH_DB\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
trap cleanup EXIT
echo "Restauration dans une base temporaire…"
gzip -dc "$DIR/qweillo.sql.gz" | docker exec -i "$MYSQL_ID" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot "$1"' sh "$SCRATCH_DB"
for table in users guilds channels messages guild_members message_attachments schema_migrations; do
    COUNT="$(sql "SELECT COUNT(*) FROM \`$SCRATCH_DB\`.\`$table\`;")"
    printf '%s : %s enregistrements\n' "$table" "$COUNT"
done
echo "Restauration vérifiée. La base temporaire est supprimée."
