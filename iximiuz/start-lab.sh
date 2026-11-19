#!/usr/bin/env bash
# Playground init task: load the images preloaded in the rootfs (first start only),
# then start a scenario. The terminal banner prints the password once run.sh is ready.
#
#   iximiuz/start-lab.sh [scenario]   (default: graphical-tools)
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

archive=/opt/rstudio-guide/images.tar
if ! docker image inspect rstudio-guide-runtime:local >/dev/null 2>&1; then
  echo "Loading the preloaded RStudio and gateway images..."
  started=$SECONDS
  docker load -i "${archive}"
  echo "Loaded in $((SECONDS - started)) s."
fi
./run.sh up "${1:-graphical-tools}"
