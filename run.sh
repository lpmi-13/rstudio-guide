#!/usr/bin/env bash
# Start or stop RStudio with the coach. Each "up" gets a fresh project, run ID and password.
# With no scenario, both lessons share the run, in a project called "lessons". The learner
# chooses a lesson and a mode (Demonstration, Guided or Solo) in the coach, inside RStudio.
#
#   ./run.sh up [scenario...]     (default: graphical-tools statistical-tools)
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
    scenarios=("${@:2}")
    if [ ${#scenarios[@]} -eq 0 ]; then scenarios=(graphical-tools statistical-tools); fi
    for scenario in "${scenarios[@]}"; do
      if [ ! -f "scenarios/$scenario/scenario.json" ]; then
        echo "Unknown scenario '$scenario'. Choose from: $(ls scenarios | tr '\n' ' ')" >&2
        exit 2
      fi
    done
    # The RStudio project (and its folder) is named after a single scenario, or "lessons".
    if [ ${#scenarios[@]} -eq 1 ]; then project=${scenarios[0]}; else project=lessons; fi
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
    mkdir -p run/evidence
    password=$(head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 20)
    # HOST_UID/GID: RStudio's user must own the bind-mounted project to save into it.
    # GATEWAY_BIND: loopback by default. 0.0.0.0 serves plain HTTP on every interface (and Docker
    # bypasses ufw), so only behind a TLS proxy such as iximiuz's tab; otherwise use an SSH tunnel.
    # FRAME_ORIGIN / SAME_SITE: let a platform (e.g. https://labs.iximiuz.com) frame RStudio.
    (umask 077; printf 'RSTUDIO_PASSWORD=%s\nLAB_SCENARIO=%s\nHOST_UID=%s\nHOST_GID=%s\nGATEWAY_BIND=%s\nFRAME_ORIGIN=%s\nSAME_SITE=%s\n' \
      "$password" "$project" "$(id -u)" "$(id -g)" "${GATEWAY_BIND:-127.0.0.1}" "${FRAME_ORIGIN:-}" "${SAME_SITE:-}" > run/.env)
    # A rootfs with the runtime image preloaded sets LAB_PREBUILT=1, so nothing is rebuilt or pulled.
    if [ "${LAB_PREBUILT:-0}" != 1 ] || ! docker image inspect rstudio-guide-runtime:local >/dev/null 2>&1; then
      docker compose --env-file run/.env build --quiet rstudio
    fi
    python3 -I tools/provision.py "$PWD" "$IMAGE" "$project" "${scenarios[@]}"
    docker compose --env-file run/.env up -d --quiet-pull
    for _ in $(seq 1 60); do
      if curl -fsS -o /dev/null http://127.0.0.1:8788/auth-sign-in 2>/dev/null; then
        wait_for_host_network
        touch run/ready # for launchers and the playground's terminal banner
        if [ "${GATEWAY_BIND:-127.0.0.1}" = 127.0.0.1 ]; then where="at http://127.0.0.1:8788/"; else where="(open the RStudio tab)"; fi
        echo "Ready: ${scenarios[*]} $where  user: rstudio  password: $password"
        python3 -I - run/public/session.json <<'PY'
import json, sys
session = json.load(open(sys.argv[1]))
lessons = session.get("lessons", [])
modes = sorted({m for lesson in lessons for m in lesson["modes"]}, key=["demonstration", "guided", "solo"].index)
modes = ", ".join(m.capitalize() for m in modes[:-1]) + " or " + modes[-1].capitalize() if len(modes) > 1 else ""
if len(lessons) > 1:
    print(f"After signing in, choose a lesson and a mode ({modes}) in the Coach pane on the right.")
elif modes:
    print(f"After signing in, choose {modes} in the Coach pane on the right.")
PY
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
    echo "usage: $0 up [scenario...] | down" >&2
    exit 2
    ;;
esac
