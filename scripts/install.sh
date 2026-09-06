#!/bin/sh
set -eu
umask 077

destination=${QWEILLO_INSTALL_DIR:-"$HOME/qweillo"}
if [ -e "$destination" ]; then
    if [ -f "$destination/qweillo" ]; then
        cd "$destination"
        if [ -t 1 ] && [ -r /dev/tty ]; then exec ./qweillo "$@" </dev/tty; fi
        exec ./qweillo --yes "$@"
    fi
    echo "$destination existe déjà. Choisissez un autre dossier avec QWEILLO_INSTALL_DIR." >&2
    exit 1
fi
command -v docker >/dev/null 2>&1 || { echo "Installez Docker, puis relancez cette commande." >&2; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "curl est requis pour télécharger Qweillo." >&2; exit 1; }
temporary=$(mktemp -d)
trap 'rm -rf "$temporary"' EXIT HUP INT TERM
curl --proto '=https' --tlsv1.2 -fsSL --retry 2 https://github.com/RedBlockers/qweillo/archive/refs/heads/dev-leka.tar.gz -o "$temporary/qweillo.tar.gz"
mkdir "$temporary/source"
tar -xzf "$temporary/qweillo.tar.gz" --strip-components=1 -C "$temporary/source"
if [ ! -f "$temporary/source/qweillo" ] || [ ! -f "$temporary/source/scripts/setup.mjs" ]; then
    echo "Le téléchargement est incomplet. Relancez la commande d’installation." >&2
    exit 1
fi
mkdir -p "$(dirname -- "$destination")"
mv "$temporary/source" "$destination"
cd "$destination"
chmod +x qweillo scripts/setup.sh scripts/render-livekit-config.sh scripts/run-stack.sh scripts/backup.sh
if [ -t 1 ] && [ -r /dev/tty ]; then
    ./qweillo "$@" </dev/tty
else
    ./qweillo --yes "$@"
fi
