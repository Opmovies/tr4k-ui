set -euo pipefail

main() {

  REPO_RAW="https://raw.githubusercontent.com/Opmovies/tr4k-ui/main"
  DIR="${DIR:-$HOME/tr4k-ui}"
  PORT="${PORT:-3010}"
  CONTAINER="${CONTAINER:-tr4k-ui}"     # 2ᵉ instance sur la même machine : CONTAINER=tr4k-ui-2
  MODE="${MODE:-}"                      # login | solo — sinon la question est posée
  TR4KER_API_KEY="${TR4KER_API_KEY:-}"  # requis en MODE=solo non interactif

  say() { printf '\033[1;32m▸\033[0m %s\n' "$*"; }
  die() { printf '\033[1;31m✖\033[0m %s\n' "$*" >&2; exit 1; }

  command -v docker >/dev/null 2>&1 || die "Docker est requis : https://docs.docker.com/get-docker/"
  docker compose version >/dev/null 2>&1 || die "Docker Compose v2 est requis (commande « docker compose »)"
  docker info >/dev/null 2>&1 || die "Le démon Docker ne répond pas (service démarré ? droits suffisants ?)"

  mkdir -p "$DIR" && cd "$DIR"
  say "Installation dans $DIR"

  if [ ! -f docker-compose.yml ] && docker inspect "$CONTAINER" >/dev/null 2>&1; then
    die "Un conteneur « $CONTAINER » existe déjà sur cette machine (autre installation). Mettez-le à jour depuis son dossier d'origine, supprimez-le, ou installez une seconde instance : CONTAINER=tr4k-ui-2 PORT=3011 …"
  fi

  curl -fsSL "$REPO_RAW/docker-compose.yml" -o docker-compose.yml

  if [ -f .env ]; then
    say "Fichier .env existant conservé"
  else
    # ---- choix du mode d'authentification ----
    # stdin est le pipe en `curl | bash` : les questions passent par /dev/tty.
    # Sans terminal (CI, provisioning), repli sur le mode login — ou MODE=… en env.
    if [ -z "$MODE" ]; then
      if [ -e /dev/tty ] && [ -r /dev/tty ] && [ -w /dev/tty ]; then
        {
          printf '\nDeux façons d'\''utiliser TR4K UI :\n'
          printf '  1) Multi-comptes — chacun se connecte avec son identifiant + mot de passe TR4KER (recommandé pour partager)\n'
          printf '  2) Solo — ta clé API TR4KER, aucun écran de connexion\n'
          printf 'Ton choix [1/2, défaut 1] : '
        } >/dev/tty
        IFS= read -r choice </dev/tty || choice=""
        case "$choice" in 2 | solo | SOLO) MODE=solo ;; *) MODE=login ;; esac
      else
        MODE=login
      fi
    fi
    case "$MODE" in login | solo) ;; *) die "MODE invalide : « $MODE » (attendu : login ou solo)" ;; esac

    if [ "$MODE" = solo ] && [ -z "$TR4KER_API_KEY" ]; then
      [ -e /dev/tty ] || die "MODE=solo sans terminal : passez TR4KER_API_KEY=tr4k_… en variable d'environnement"
      printf 'Clé API TR4KER (tr4k_…, saisie masquée) : ' >/dev/tty
      IFS= read -rs TR4KER_API_KEY </dev/tty || TR4KER_API_KEY=""
      printf '\n' >/dev/tty
      [ -n "$TR4KER_API_KEY" ] || die "Clé API vide — elle se trouve sur tr4ker.net (profil → clé API)"
    fi

    if command -v openssl >/dev/null 2>&1; then
      SECRET=$(openssl rand -hex 32)
      WT_TOKEN=$(openssl rand -hex 16)
    else
      SECRET=$(od -vN32 -An -tx1 /dev/urandom | tr -d ' \n')
      WT_TOKEN=$(od -vN16 -An -tx1 /dev/urandom | tr -d ' \n')
    fi
    {
      echo "PORT=$PORT"
      [ "$CONTAINER" = tr4k-ui ] || echo "TR4KUI_CONTAINER=$CONTAINER"
      echo "NUXT_SESSION_SECRET=$SECRET"
      echo "WATCHTOWER_TOKEN=$WT_TOKEN"
      if [ "$MODE" = solo ]; then
        echo "NUXT_ALLOW_CONFIG_KEY=1"
        echo "NUXT_TR4KER_API_KEY=$TR4KER_API_KEY"
      fi
    } > .env
    chmod 600 .env
    if [ "$MODE" = solo ]; then
      say "Fichier .env créé — mode SOLO (clé API, pas d'écran de connexion)"
    else
      say "Fichier .env créé — mode MULTI-COMPTES (connexion par identifiant TR4KER)"
    fi
    say "(clé de session générée — ne la régénérez pas, cela invaliderait les sessions)"
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
