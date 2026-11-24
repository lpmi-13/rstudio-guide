#!/usr/bin/env bash
# Playground init task: load the images preloaded in the rootfs (first start only),
# then start the lab. lab.env turns RStudio's sign-in off, so the RStudio tab opens signed in.
#
#   iximiuz/start-lab.sh [scenario...]   (default: every lesson written so far; see run.sh)
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

archive=/opt/rstudio-guide/images.tar
if ! docker image inspect rstudio-guide-runtime:local >/dev/null 2>&1; then
  echo "Loading the preloaded RStudio and gateway images..."
  started=$SECONDS
  docker load -i "${archive}"
  echo "Loaded in $((SECONDS - started)) s."
fi
./run.sh up "$@"
