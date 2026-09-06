#!/bin/sh
set -eu
umask 077
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$project_dir"
mode=$(cat .runtime/start-mode)
action=$(cat .runtime/action)
set -- -f docker-compose.yml
if [ "$mode" = "production" ]; then
    set -- "$@" -f docker-compose.production.yml
    if [ "$(cat .runtime/start-proxy)" = "external" ]; then set -- "$@" -f docker-compose.external-proxy.yml; fi
fi
case "$action" in
    exit) exit 0 ;;
    status)
        docker compose "$@" ps
        printf '\nAdresse de l’instance : %s\n' "$(cat .runtime/start-url)"
        exit 0
        ;;
    backup)
        exec ./scripts/backup.sh
        ;;
    stop)
        docker compose "$@" stop
        printf '\nInstance arrêtée. Vos données sont conservées.\nRelancez ./qweillo pour la démarrer.\n'
        exit 0
        ;;
    start) ;;
    *) echo 'Action de gestion inconnue. Relancez ./qweillo.' >&2; exit 1 ;;
esac
if [ "$mode" = "production" ]; then ./scripts/render-livekit-config.sh; fi
printf '\nPréparation du serveur, des données et de la voix…\nLa première installation peut prendre quelques minutes.\n'
if ! docker compose "$@" up -d --build --wait --wait-timeout 180 > .runtime/install.log 2>&1; then
    printf '\nLe démarrage n’a pas abouti. Détails : %s/.runtime/install.log\n\n' "$project_dir" >&2
    tail -n 25 .runtime/install.log >&2
    exit 1
fi
printf '\nQweillo est prêt : %s\n\n' "$(cat .runtime/start-url)"
printf '  Site et API       disponibles\n  Voix et vidéo     démarrées\n  Données et clés   conservées sur cette machine\n\n'
printf 'Ouvrez cette adresse et créez votre compte.\nLe menu Instances permet de partager l’adresse et le code QR.\nRelancez ./qweillo pour gérer cette installation.\n'
