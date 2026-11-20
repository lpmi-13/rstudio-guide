# Air 0.13.0, Posit's R formatter, checked against the release's published SHA-256. The lab is
# amd64 only, so an arm64 build fails at the `air --version` check below.
FROM scratch AS air
ADD --checksum=sha256:3909b12870df0b6a44e3f40376cd59aca373791c0abedd02dcbda7b136e4573c \
    https://github.com/posit-dev/air/releases/download/0.13.0/air-x86_64-unknown-linux-gnu.tar.gz /air.tar.gz

# Pinned by digest: rocker/tidyverse:4.6.2 as published 2026-11-16 (RStudio Server 2026.11.0+203,
# R 4.6.2, Ubuntu 26.04). It is rocker/rstudio:4.6.2 plus the tidyverse, DuckDB and dbplyr.
FROM rocker/tidyverse:4.6.2@sha256:9241ac461c924334777dd3fb047c6e5e0fd1435a85acc171f1a32836861d0a69

# The lessons' other packages, from a dated Posit Package Manager snapshot so a rebuild gets the same
# versions. A learner's install.packages() uses the same snapshot.
ARG P3M_SNAPSHOT=https://p3m.dev/cran/__linux__/resolute/2026-11-19
RUN sed -i "s#https://p3m.dev/cran/__linux__/resolute/latest#${P3M_SNAPSHOT}#" /usr/local/lib/R/etc/Rprofile.site \
 && grep -q "${P3M_SNAPSHOT}" /usr/local/lib/R/etc/Rprofile.site \
 && install2.r --error --skipinstalled -n 4 -r "${P3M_SNAPSHOT}" \
      duckplyr patchwork ggrepel janitor writexl gt reactable styler quarto \
 && rm -rf /tmp/downloaded_packages

# Every installed R package and its version, checked against runtime/packages.lock: the lessons'
# baked reference results (tools/bake.py) are only valid for these versions, so a build that would
# change one fails here. After a deliberate upgrade, refresh the lock with tools/update_packages_lock.sh.
ARG PACKAGES_LOCK=check
COPY runtime/packages.lock /tmp/packages.lock
RUN mkdir -p /opt/lab \
 && Rscript -e 'ip <- installed.packages(noCache = TRUE)[, c("Package", "Version")]; ip <- ip[!duplicated(ip[, "Package"]), ]; ip <- ip[order(ip[, "Package"], method = "radix"), ]; writeLines(c(R.version.string, sprintf("%s %s", ip[, "Package"], ip[, "Version"])), "/opt/lab/packages.lock")' \
 && if [ "${PACKAGES_LOCK}" = check ]; then diff /tmp/packages.lock /opt/lab/packages.lock; fi \
 && rm /tmp/packages.lock

# Air, Posit's R formatter (from the air stage at the top). RStudio uses an `air` on the PATH
# when "Use Air" is on, rather than downloading one from GitHub, so formatting works offline.
COPY --from=air /air.tar.gz /tmp/air.tar.gz
RUN tar -xzf /tmp/air.tar.gz -C /tmp \
 && install -m 0755 /tmp/air-*-unknown-linux-gnu/air /usr/local/bin/air \
 && rm -rf /tmp/air.tar.gz /tmp/air-*-unknown-linux-gnu \
 && air --version

# Keep each R session clean, switch off Posit Assistant (the coach takes its
# sidebar slot), and show that sidebar on the right.
COPY --chown=rstudio:rstudio runtime/rstudio-prefs.json /home/rstudio/.config/rstudio/rstudio-prefs.json
# ~/.duckdb exists so that duckdb 2 doesn't stop R at a "duckdb: create ~/.duckdb?" prompt the
# first time a learner uses duckplyr or DuckDB.
RUN install -d -o rstudio -g rstudio \
      /home/rstudio/.duckdb \
      /home/rstudio/.local \
      /home/rstudio/.local/share \
      /home/rstudio/.local/share/rstudio \
      /home/rstudio/.local/share/rstudio/projects_settings \
 && chown -R rstudio:rstudio /home/rstudio/.config

# No AI assistants in the lab. The user preferences above only hide them, and a learner
# could turn them back on in Global Options; these admin settings cannot be undone by
# the learner. (None appears in `rsession --help` in this build; all are in the binary.)
RUN printf '%s\n' \
      'copilot-enabled=0' 'allow-copilot=0' \
      'posit-assistant-enabled=0' 'allow-posit-assistant=0' 'posit-assistant-installation-enabled=0' \
      >> /etc/rstudio/rsession.conf

# Evidence for the coach: each RStudio session records a fingerprint of what every top-level call
# returned, plus a little IDE state, in /home/rstudio/.lab/evidence.json. The bake (tools/bake.py)
# runs each lesson with the same evidence.R, through bake.R, to get the reference fingerprints.
COPY runtime/evidence.R runtime/bake.R /opt/lab/
RUN printf '%s\n' \
      'if (interactive() && nzchar(Sys.getenv("RSTUDIO")) && file.exists("/opt/lab/evidence.R")) local({' \
      '  lab <- new.env()' \
      '  sys.source("/opt/lab/evidence.R", envir = lab)' \
      '  lab$install()' \
      '})' >> /usr/local/lib/R/etc/Rprofile.site

# Point RStudio at the run's project (LAB_PROJECT) at container start.
COPY runtime/03_lab_project /etc/cont-init.d/03_lab_project

# Optionally allow a platform such as iximiuz Labs to frame RStudio (FRAME_ORIGIN).
COPY runtime/04_lab_frame_origin /etc/cont-init.d/04_lab_frame_origin

# Larkhaven Bikes, the city every lesson's data comes from (content/world/generate.R), in
# /opt/lab/world. The big files (trips.csv and the archive) exist only here, and each run's project
# links to them. The small ones are also committed in content/world/data, and each run's project
# gets a copy of those; the build fails if this image would generate different ones.
COPY content/world /tmp/world-src
RUN Rscript /tmp/world-src/generate.R /opt/lab/world \
 && Rscript /tmp/world-src/check.R /opt/lab/world \
 && cd /opt/lab/world \
 && find . -type f ! -path './archive/*' ! -name trips.csv | sort > /tmp/generated \
 && (cd /tmp/world-src/data && find . -type f ! -name README.md | sort) > /tmp/committed \
 && diff /tmp/committed /tmp/generated \
 && while read -r f; do cmp "$f" "/tmp/world-src/data/$f"; done < /tmp/generated \
 && rm -rf /tmp/world-src /tmp/generated /tmp/committed
