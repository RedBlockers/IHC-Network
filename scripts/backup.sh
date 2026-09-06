#!/usr/bin/env bash
set -euo pipefail
umask 077

STACK="${QWEILLO_STACK:-$(cd -- "$(dirname -- "$0")/.." && pwd)}"
DEST="${1:-$STACK/backups}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
DIR="$DEST/$STAMP"
COMPOSE=(docker compose --project-directory "$STACK" --env-file "${QWEILLO_ENV_FILE:-$STACK/.env}" -f "$STACK/docker-compose.yml")
if [[ -n "${QWEILLO_PROJECT_NAME:-}" ]]; then COMPOSE+=(-p "$QWEILLO_PROJECT_NAME"); fi
MYSQL_ID="$("${COMPOSE[@]}" ps -q mysql)"
API_ID="$("${COMPOSE[@]}" ps -q api1)"
[[ -n "$MYSQL_ID" && -n "$API_ID" ]] || { echo "La base et api1 doivent être démarrées." >&2; exit 1; }
mkdir -p "$DEST"
mkdir "$DIR"
cp "${QWEILLO_ENV_FILE:-$STACK/.env}" "$DIR/configuration.env"
chmod 600 "$DIR/configuration.env"

echo "Sauvegarde de la base…"
docker exec "$MYSQL_ID" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --single-transaction --routines --triggers --no-tablespaces qweillo' | gzip > "$DIR/qweillo.sql.gz"
gzip -t "$DIR/qweillo.sql.gz"

echo "Sauvegarde des fichiers et du contrôle de maintenance…"
docker exec "$API_ID" tar -czf - --exclude=uploads/.tmp -C /data uploads > "$DIR/uploads.tar.gz"
docker exec "$API_ID" tar -czf - -C /data control > "$DIR/control.tar.gz"
tar -tzf "$DIR/uploads.tar.gz" >/dev/null
tar -tzf "$DIR/control.tar.gz" >/dev/null
printf 'Qweillo\nDate UTC : %s\nBase : qweillo.sql.gz\nFichiers : uploads.tar.gz\nContrôle : control.tar.gz\nConfiguration et secrets : configuration.env\n' "$STAMP" > "$DIR/INFO.txt"
if command -v sha256sum >/dev/null 2>&1; then
    CHECKSUM=(sha256sum)
else
    CHECKSUM=(shasum -a 256)
fi
(cd "$DIR" && "${CHECKSUM[@]}" qweillo.sql.gz uploads.tar.gz control.tar.gz configuration.env INFO.txt > SHA256SUMS)

METRICS_DIR="${QWEILLO_METRICS_DIR:-$DEST}"
mkdir -p "$METRICS_DIR"
printf 'qweillo_backup_last_success_timestamp_seconds %s\n' "$(date +%s)" > "$METRICS_DIR/.qweillo_backup.prom.tmp"
mv "$METRICS_DIR/.qweillo_backup.prom.tmp" "$METRICS_DIR/qweillo_backup.prom"
echo "Sauvegarde terminée : $DIR"
