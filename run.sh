#!/usr/bin/env bash
# Start or stop RStudio with the coach. Each "up" gets a fresh project, run ID and password.
#
#   ./run.sh up [regional-revenue|graphical-tools|statistical-tools]
#   ./run.sh down
set -euo pipefail
cd "$(dirname "$0")"
IMAGE=rstudio-guide-runtime:local

# Docker adds host network interfaces as containers start, and their IPv6 addresses
# appear a moment later, sometimes after RStudio already answers. Chromium aborts
# in-flight requests when host addresses change (net::ERR_NETWORK_CHANGED), which
# once left the sign-in page without its scripts. Wait until addresses stop changing.
wait_for_host_network() {
  local last="" now stable=0
  for _ in $(seq 1 40); do
    now=$(ip -o addr show 2>/dev/null | awk '{print $2, $3, $4}' | md5sum) # interface, family, address (not lifetimes)
    if [ "$now" = "$last" ]; then stable=$((stable + 1)); else stable=0; last=$now; fi
    if [ "$stable" -ge 8 ]; then return 0; fi # unchanged for 2 s
    sleep 0.25
  done
  echo "Host network addresses were still changing after 10 s; the first page load may fail." >&2
}

require() {
  local missing=()
  for cmd in docker python3 curl; do command -v "$cmd" >/dev/null || missing+=("$cmd"); done
  if [ ${#missing[@]} -gt 0 ]; then echo "Missing: ${missing[*]}" >&2; exit 1; fi
  docker compose version >/dev/null 2>&1 || { echo "Docker Compose v2 is required (docker compose ...)" >&2; exit 1; }
  docker info >/dev/null 2>&1 || { echo "Cannot reach the Docker daemon. Is it running, and can this user use it?" >&2; exit 1; }
}

stop_run() {
  if [ -f run/.env ]; then docker compose --env-file run/.env down --remove-orphans >/dev/null; fi
  rm -rf run
}

case "${1:-up}" in
  up)
    scenario="${2:-regional-revenue}"
    if [ ! -f "scenarios/$scenario/scenario.json" ]; then
      echo "Unknown scenario '$scenario'. Choose one of: $(ls scenarios | tr '\n' ' ')" >&2
      exit 2
    fi
    require
    # Site defaults (a playground's FRAME_ORIGIN, for example) can live in lab.env so that
    # every later "./run.sh up <scenario>" keeps them. Values set in the environment win.
    if [ -f lab.env ]; then
      while IFS='=' read -r key value; do
        case "$key" in
          FRAME_ORIGIN|SAME_SITE|GATEWAY_BIND|LAB_PREBUILT) if [ -z "${!key:-}" ]; then export "$key=$value"; fi ;;
        esac
      done < lab.env
    fi
    stop_run
    mkdir -p run
    password=$(head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 20)
    # HOST_UID/GID: RStudio's user must own the bind-mounted project to save into it.
    # GATEWAY_BIND: loopback by default; a remote VM behind its own proxy may need 0.0.0.0.
    # FRAME_ORIGIN / SAME_SITE: let a platform (e.g. https://labs.iximiuz.com) frame RStudio.
    (umask 077; printf 'RSTUDIO_PASSWORD=%s\nLAB_SCENARIO=%s\nHOST_UID=%s\nHOST_GID=%s\nGATEWAY_BIND=%s\nFRAME_ORIGIN=%s\nSAME_SITE=%s\n' \
      "$password" "$scenario" "$(id -u)" "$(id -g)" "${GATEWAY_BIND:-127.0.0.1}" "${FRAME_ORIGIN:-}" "${SAME_SITE:-}" > run/.env)
    # A rootfs with the runtime image preloaded sets LAB_PREBUILT=1, so nothing is rebuilt or pulled.
    if [ "${LAB_PREBUILT:-0}" != 1 ] || ! docker image inspect rstudio-guide-runtime:local >/dev/null 2>&1; then
      docker compose --env-file run/.env build --quiet rstudio
    fi
    python3 -I tools/provision.py "$PWD" "$scenario" "$IMAGE"
    docker compose --env-file run/.env up -d --quiet-pull
    for _ in $(seq 1 60); do
      if curl -fsS -o /dev/null http://127.0.0.1:8788/auth-sign-in 2>/dev/null; then
        wait_for_host_network
        touch run/ready # for launchers and the playground's terminal banner
        if [ "${GATEWAY_BIND:-127.0.0.1}" = 127.0.0.1 ]; then where="at http://127.0.0.1:8788/"; else where="(open the RStudio tab)"; fi
        echo "Ready: $scenario $where  user: rstudio  password: $password"
        exit 0
      fi
      sleep 1
    done
    echo "RStudio did not answer through the gateway within 60 s" >&2
    docker compose --env-file run/.env logs --tail 50 >&2
    exit 1
    ;;
  down)
    stop_run
    ;;
  *)
    echo "usage: $0 up [scenario] | down" >&2
    exit 2
    ;;
esac
