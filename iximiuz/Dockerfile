ARG ROOTFS_RELEASE=c36cb070

FROM ghcr.io/iximiuz/labs/rootfs:ubuntu-docker-${ROOTFS_RELEASE}

USER root
ENV HOME=/root

# This repository, with lab.env already set for iximiuz (frame origin, gateway bind, preloaded images).
COPY --chown=laborant:laborant rstudio-guide /home/laborant/rstudio-guide
# The RStudio runtime and gateway images, loaded on first start so no Docker Hub pull is needed.
# build-rootfs-image.sh makes the archive 0644 (docker save writes 0600) and COPY keeps that mode.
# Don't use COPY --chmod here: BuildKit also applies it to the directory it creates, and a 0644
# /opt/rstudio-guide can't be entered by laborant.
COPY images.tar /opt/rstudio-guide/images.tar

RUN <<'EOS'
set -eu
install -m 0644 /home/laborant/rstudio-guide/iximiuz/rstudio-lab-banner.sh /etc/profile.d/zz-rstudio-lab.sh
# The base's "Welcome to iximiuz Labs' Docker Playground!" text, which ~/.bashrc prints in the
# first terminal after our banner. The banner also removes any copy written at boot.
rm -f /home/laborant/.welcome
for cmd in bash docker python3 curl ip md5sum runuser; do
  command -v "${cmd}" >/dev/null 2>&1 || { echo "missing expected tool: ${cmd}" >&2; exit 1; }
done
docker compose version >/dev/null
id laborant | grep -qw docker || { echo "laborant is not in the docker group" >&2; exit 1; }
# v1 shipped an archive laborant could not read; fail the build instead of the playground.
runuser -u laborant -- test -r /opt/rstudio-guide/images.tar || { echo "laborant cannot read images.tar" >&2; exit 1; }
runuser -u laborant -- test -x /home/laborant/rstudio-guide/iximiuz/start-lab.sh || { echo "laborant cannot run start-lab.sh" >&2; exit 1; }
runuser -u laborant -- test -w /home/laborant/rstudio-guide || { echo "laborant cannot write the repository" >&2; exit 1; }
EOS

USER laborant
ENV HOME=/home/laborant
