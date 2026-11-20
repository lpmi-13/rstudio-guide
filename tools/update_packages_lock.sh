#!/usr/bin/env bash
# Refresh runtime/packages.lock after a deliberate change to the runtime image's R packages: a new
# Posit Package Manager snapshot, base image or package. The image build checks every installed
# package's version against the lock, because the lessons' baked results (tools/bake.py) are only
# valid for those versions; the stamps in content/lessons/baked/ change with the lock, so the next
# ./run.sh up bakes again. Review the diff before committing it.
#
#   tools/update_packages_lock.sh
set -euo pipefail
cd "$(dirname "$0")/.."
touch runtime/packages.lock
image=$(docker build -q -f runtime/Dockerfile --build-arg PACKAGES_LOCK=update .)
docker run --rm --entrypoint cat "$image" /opt/lab/packages.lock > runtime/packages.lock
git --no-pager diff --stat -- runtime/packages.lock || true
echo "Updated runtime/packages.lock ($(wc -l < runtime/packages.lock) lines)."
