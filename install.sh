#!/usr/bin/env bash
# Installation express de TR4K UI (Docker requis) :
#
#   curl -fsSL https://raw.githubusercontent.com/Opmovies/tr4k-ui/main/install.sh | bash
#
# Variables optionnelles (à placer devant la commande) :
#   DIR=~/tr4k-ui   dossier d'installation (défaut : ~/tr4k-ui)
#   PORT=3010       port exposé sur l'hôte (défaut : 3010)
set -euo pipefail

# tout le script est enveloppé dans main() : bash le parse en entier avant de
# l'exécuter — indispensable en `curl | bash` (sinon docker & co consomment le flux)
main() {

  REPO_RAW="https://raw.githubusercontent.com/Opmovies/tr4k-ui/main"
  DIR="${DIR:-$HOME/tr4k-ui}"
  PORT="${PORT:-3010}"

  say() { printf '\033[1;32m▸\033[0m %s\n' "$*"; }
  die() { printf '\033[1;31m✖\033[0m %s\n' "$*" >&2; exit 1; }

  command -v docker >/dev/null 2>&1 || die "Docker est requis : https://docs.docker.com/get-docker/"
  docker compose version >/dev/null 2>&1 || die "Docker Compose v2 est requis (commande « docker compose »)"
  docker info >/dev/null 2>&1 || die "Le démon Docker ne répond pas (service démarré ? droits suffisants ?)"

  mkdir -p "$DIR" && cd "$DIR"
  say "Installation dans $DIR"

  # une autre instance (hors de ce dossier) occupe déjà le nom de conteneur « tr4k-ui »
  if [ ! -f docker-compose.yml ] && docker inspect tr4k-ui >/dev/null 2>&1; then
    die "Un conteneur « tr4k-ui » existe déjà sur cette machine (autre installation). Mettez-le à jour depuis son dossier d'origine, ou supprimez-le avant de réinstaller."
  fi

  curl -fsSL "$REPO_RAW/docker-compose.yml" -o docker-compose.yml

  if [ -f .env ]; then
    say "Fichier .env existant conservé"
  else
    if command -v openssl >/dev/null 2>&1; then
      SECRET=$(openssl rand -hex 32)
      WT_TOKEN=$(openssl rand -hex 16)
    else
      SECRET=$(od -vN32 -An -tx1 /dev/urandom | tr -d ' \n')
      WT_TOKEN=$(od -vN16 -An -tx1 /dev/urandom | tr -d ' \n')
    fi
    {
      echo "PORT=$PORT"
      echo "NUXT_SESSION_SECRET=$SECRET"
      # exigé par compose même si le profil autoupdate est inactif ; sert de jeton
      # prêt à l'emploi si vous activez :  docker compose --profile autoupdate up -d
      echo "WATCHTOWER_TOKEN=$WT_TOKEN"
    } > .env
    say "Fichier .env créé (clé de session générée — ne la régénérez pas, cela invaliderait les sessions)"
  fi

  say "Téléchargement de l'image et démarrage…"
  docker compose pull -q tr4k-ui
  docker compose up -d tr4k-ui

  PORT_FINAL=$(grep '^PORT=' .env | cut -d= -f2)
  say "TR4K UI est lancé : http://localhost:${PORT_FINAL:-3010}"
  say "Mise à jour :  cd $DIR && docker compose pull && docker compose up -d"
  say "Arrêt :        cd $DIR && docker compose down   (le volume tr4k-data est conservé)"

}

main "$@"
