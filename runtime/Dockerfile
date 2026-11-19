# Pinned by digest: rocker/rstudio:4.6.2 as published 2026-11-16.
FROM rocker/rstudio:4.6.2@sha256:ab667f419a10edc60f95da38149644d6f9eea266216b51dcce1d4df9e36dfcd6

# Keep each R session clean, switch off Posit Assistant (the coach takes its
# sidebar slot), and show that sidebar on the right.
COPY --chown=rstudio:rstudio runtime/rstudio-prefs.json /home/rstudio/.config/rstudio/rstudio-prefs.json
RUN install -d -o rstudio -g rstudio \
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

# Point RStudio at the run's project (LAB_PROJECT) at container start.
COPY runtime/03_lab_project /etc/cont-init.d/03_lab_project

# Optionally allow a platform such as iximiuz Labs to frame RStudio (FRAME_ORIGIN).
COPY runtime/04_lab_frame_origin /etc/cont-init.d/04_lab_frame_origin
