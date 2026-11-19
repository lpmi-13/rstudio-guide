#!/usr/bin/env bash
# Modelled on argo-remotelab's scripts/publish-rootfs-image.sh.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "${repo_root}/iximiuz/versions.sh"

usage() {
  cat <<'EOF'
Usage: bash iximiuz/publish-rootfs-image.sh [new-image-tag]
       bash iximiuz/publish-rootfs-image.sh --sync-remote

Builds and pushes the iximiuz rootfs image, then updates the checked-in image
references (iximiuz/versions.sh and iximiuz/manifest.yaml) and the remote
iximiuz playground after a successful push. Without a tag, it publishes the next
version after the current one in iximiuz/versions.sh (v1 becomes v2).
--sync-remote retries only the playground update.
EOF
}

next_image_tag() {
  local current="$1"

  if [[ ! "${current}" =~ ^v([0-9]+)$ ]]; then
    echo "error: cannot increment image tag '${current}'; pass a new tag explicitly." >&2
    return 1
  fi
  printf 'v%d\n' "$((10#${BASH_REMATCH[1]} + 1))"
}

playground_manifest="${repo_root}/iximiuz/manifest.yaml"
playground_name="$(awk '/^name:[[:space:]]*/ { print $2; exit }' "${playground_manifest}")"
if [[ -z "${playground_name}" ]]; then
  echo "error: could not read the playground name from ${playground_manifest}." >&2
  exit 1
fi

ensure_labctl_authenticated() {
  if ! command -v labctl >/dev/null 2>&1; then
    echo "error: labctl is required to update the iximiuz playground." >&2
    exit 1
  fi

  if ! labctl auth whoami >/dev/null 2>&1; then
    echo "labctl is not authenticated; starting labctl auth login..."
    labctl auth login
    if ! labctl auth whoami >/dev/null 2>&1; then
      echo "error: labctl authentication could not be verified." >&2
      exit 1
    fi
  fi
}

# Unlike argo-remotelab, the custom playground may not exist yet. Publishing still
# succeeds; the message says how to create it once.
sync_remote_playground() {
  if ! labctl playground manifest "${playground_name}" >/dev/null 2>&1; then
    echo "No custom iximiuz playground named ${playground_name} yet, so there is nothing to update."
    echo "Create it once with:  labctl playground create --base docker -f iximiuz/manifest.yaml ${playground_name}"
    echo "then set 'name:' in iximiuz/manifest.yaml to the name it prints, so later publishes update it."
    echo "Or try the new image in a throwaway session:  labctl playground start docker -f iximiuz/manifest.yaml"
    return 0
  fi
  echo "Updating iximiuz playground ${playground_name} from ${playground_manifest}..."
  if ! labctl playground update "${playground_name}" --file "${playground_manifest}"; then
    echo "error: remote playground update failed; retry with: bash iximiuz/publish-rootfs-image.sh --sync-remote" >&2
    return 1
  fi
}

# Rewrites the checked-in references, only after the rootfs push succeeded.
update_version_refs() {
  local tag="$1"
  local image="${ROOTFS_IMAGE_REPO}:${tag}"

  sed -i \
    -e "s#^readonly ROOTFS_IMAGE_TAG=\"[^\"]*\"#readonly ROOTFS_IMAGE_TAG=\"${tag}\"#" \
    -e "s#^readonly ROOTFS_IMAGE=\"[^\"]*\"#readonly ROOTFS_IMAGE=\"${image}\"#" \
    "${repo_root}/iximiuz/versions.sh"
  sed -i -E "s#(source: oci://)${ROOTFS_IMAGE_REPO//./\\.}:[A-Za-z0-9_.-]+#\\1${image}#" "${playground_manifest}"

  grep -q "^readonly ROOTFS_IMAGE_TAG=\"${tag}\"" "${repo_root}/iximiuz/versions.sh" &&
    grep -q "source: oci://${image}$" "${playground_manifest}" || {
      echo "error: could not update the image references to ${image}." >&2
      return 1
    }
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

if [[ "${1:-}" == "--sync-remote" && $# -eq 1 ]]; then
  ensure_labctl_authenticated
  sync_remote_playground
  exit 0
fi

if [[ $# -gt 1 || "${1:-}" == -* ]]; then
  usage >&2
  exit 1
fi

if [[ $# -eq 1 ]]; then
  image_tag="$1"
else
  image_tag="$(next_image_tag "${ROOTFS_IMAGE_TAG}")"
fi
if [[ ! "${image_tag}" =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$ ]]; then
  echo "error: invalid image tag '${image_tag}'." >&2
  exit 1
fi

rootfs_image="${ROOTFS_IMAGE_REPO}:${image_tag}"
if [[ "${image_tag}" == "${ROOTFS_IMAGE_TAG}" || "${rootfs_image}" == "${ROOTFS_IMAGE}" ]]; then
  echo "error: ${image_tag} is already referenced by this checkout; choose a new image tag." >&2
  exit 1
fi

ensure_labctl_authenticated

echo "Publishing ${image_tag} (replacing ${ROOTFS_IMAGE_TAG})..."
IMAGE_TAG="${image_tag}" \
PUSH_ROOTFS_IMAGE=1 \
  bash "${repo_root}/iximiuz/build-rootfs-image.sh"

echo "Updating checked-in version references to ${rootfs_image}..."
update_version_refs "${image_tag}"

sync_remote_playground
