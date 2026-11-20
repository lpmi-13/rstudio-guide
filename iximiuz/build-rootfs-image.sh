#!/usr/bin/env bash
# Builds the iximiuz Labs rootfs image: the iximiuz Docker base, plus this repository,
# the terminal banner, and the RStudio runtime and gateway images preloaded, so a
# playground needs no Docker Hub pulls. Pushes it when PUSH_ROOTFS_IMAGE=1.
# publish-rootfs-image.sh is the usual entry point; it picks the next tag.
#
#   IMAGE_TAG=v3 PUSH_ROOTFS_IMAGE=1 bash iximiuz/build-rootfs-image.sh
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${repo_root}"
source "${repo_root}/iximiuz/versions.sh"

image_tag="${IMAGE_TAG:-${ROOTFS_IMAGE_TAG}}"
rootfs_image="${ROOTFS_IMAGE_OVERRIDE:-${ROOTFS_IMAGE_REPO}:${image_tag}}"
rootfs_release="${ROOTFS_RELEASE:-${IXIMIUZ_ROOTFS_RELEASE}}"
push_rootfs_image="${PUSH_ROOTFS_IMAGE:-0}"

runtime_image="rstudio-guide-runtime:local"
gateway_image="$(awk '/^[[:space:]]*image:[[:space:]]*nginx:/ { print $2; exit }' "${repo_root}/compose.yaml")"
[[ -n "${gateway_image}" ]] || { echo "error: could not read the gateway image from compose.yaml." >&2; exit 1; }

# GHCR can reject the manifest with "unknown blob" when it is pushed right after
# a large layer upload that the registry has not finished committing. A retry
# skips layers that already exist, so it only re-sends the manifest.
push_image() {
  local image="$1"
  local max_attempts=3
  local delay="${PUSH_RETRY_DELAY:-15}"
  local attempt

  for ((attempt = 1; attempt <= max_attempts; attempt++)); do
    echo "Pushing ${image} (attempt ${attempt}/${max_attempts})..."
    if docker push "${image}"; then
      return 0
    fi
    if ((attempt < max_attempts)); then
      echo "warning: pushing ${image} failed; retrying in $((attempt * delay))s..." >&2
      sleep "$((attempt * delay))"
    fi
  done

  echo "error: pushing ${image} failed after ${max_attempts} attempts." >&2
  return 1
}

echo "Building ${runtime_image}..."
docker build -f "${repo_root}/runtime/Dockerfile" -t "${runtime_image}" "${repo_root}"

if ! docker image inspect "${gateway_image}" >/dev/null 2>&1; then
  echo "Pulling ${gateway_image}..."
  docker pull "${gateway_image}"
fi

build_context="$(mktemp -d "${TMPDIR:-/tmp}/rstudio-guide-rootfs-build.XXXXXX")"
trap 'rm -rf "${build_context}"' EXIT

# The learner-facing files only: no per-run state, results, local audits or site settings.
# Only files git tracks, as they are in the working tree (uncommitted edits included), so an
# untracked file such as a scratch .env or notes can never reach this public image. `git stash
# create` snapshots tracked changes without touching the working tree, index or stash list.
prefix="$(git rev-parse --show-prefix 2>/dev/null)" && [[ -z "${prefix}" ]] || {
  echo "error: ${repo_root} is not the top of a git checkout; the rootfs is built from tracked files." >&2
  exit 1
}
untracked="$(git ls-files --others --exclude-standard)"
if [[ -n "${untracked}" ]]; then
  echo "warning: these untracked files are not published (git add them if the playground needs them):" >&2
  sed 's/^/  /' <<<"${untracked}" >&2
fi
snapshot="$(git -c user.name=build-rootfs -c user.email=build-rootfs@localhost stash create)"
mkdir -p "${build_context}/rstudio-guide"
git archive --format=tar "${snapshot:-HEAD}" -- . ':(exclude)tests' ':(exclude).claude' \
  | tar -C "${build_context}/rstudio-guide" -xf -
# Settings every ./run.sh up in the playground keeps (see run.sh and the README).
printf '%s\n' \
  'FRAME_ORIGIN=https://labs.iximiuz.com' \
  'GATEWAY_BIND=0.0.0.0' \
  'LAB_PREBUILT=1' \
  > "${build_context}/rstudio-guide/lab.env"
cp "${repo_root}/iximiuz/Dockerfile" "${build_context}/Dockerfile"

echo "Saving ${runtime_image} and ${gateway_image} into the rootfs build context..."
docker save -o "${build_context}/images.tar" "${runtime_image}" "${gateway_image}"
# docker save writes 0600; the playground's init task reads it as laborant (v1 failed on this).
chmod 0644 "${build_context}/images.tar"

echo "Building ${rootfs_image} on ubuntu-docker-${rootfs_release}..."
docker build \
  --build-arg ROOTFS_RELEASE="${rootfs_release}" \
  --label "org.opencontainers.image.description=RStudio Server with an in-IDE coach for iximiuz Labs" \
  -t "${rootfs_image}" \
  "${build_context}"

if [[ "${push_rootfs_image}" != "0" ]]; then
  push_image "${rootfs_image}"
fi

echo
echo "Built rootfs image ${rootfs_image}"
if [[ "${push_rootfs_image}" != "0" ]]; then
  echo "Pushed ${rootfs_image}"
fi
