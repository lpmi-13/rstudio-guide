#!/usr/bin/env bash
# Versions for the iximiuz Labs rootfs image. publish-rootfs-image.sh bumps
# ROOTFS_IMAGE_TAG and ROOTFS_IMAGE after a successful push (v1 becomes v2).
# v0 means nothing has been published yet.

readonly ROOTFS_IMAGE_REPO="ghcr.io/lpmi-13/rstudio-guide-rootfs"
readonly ROOTFS_IMAGE_TAG="v3"
readonly ROOTFS_IMAGE="ghcr.io/lpmi-13/rstudio-guide-rootfs:v3"
# The iximiuz Docker playground base. ubuntu-docker pointed at this release on 2026-11-19.
readonly IXIMIUZ_ROOTFS_RELEASE="c36cb070"
