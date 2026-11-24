# Startup image experiments (24 November 2026)

These Dockerfiles measure a smaller runtime. They are experiments, not the image used by the public playground.

`Dockerfile.lean-base` starts from pinned `rocker/rstudio:4.6.2` and installs the packages explicitly needed by the lessons from the same 19 November Posit Package Manager snapshot as the main runtime. `Dockerfile.lean-full` adds the coach hooks, Air, and Larkhaven Bikes world from `runtime/Dockerfile`. Its `zip` install is needed by world generation. The package lock check is skipped during the experiment because the candidate has a different package inventory; it still writes its actual inventory to `/opt/lab/packages.lock`.

```bash
rtk docker build -f spikes/startup/Dockerfile.lean-base -t rstudio-guide-runtime:lean spikes/startup
rtk docker build -f spikes/startup/Dockerfile.lean-full --build-arg PACKAGES_LOCK=skip -t rstudio-guide-runtime:lean-full .
```

| Image | Unpacked Docker size | `docker save | gzip -1` |
| --- | ---: | ---: |
| Current runtime (`rocker/tidyverse` base) | 3,228,901,953 bytes | 1,252,014,174 bytes |
| Lean base with lesson packages | 3,035,303,362 bytes | 1,152,699,484 bytes |
| Full lean runtime | 3,080,315,566 bytes | 1,176,884,703 bytes |

The full lean runtime saves 149 MB unpacked and 75 MB compressed against the current runtime. Its package inventory has 160 packages, versus 207 in the current lock. All 17 explicitly loaded lesson packages are present; `quarto --version` and `pandoc --version` worked; the world passed all 56 data checks. All 29 lesson bakes passed in a temporary copy of the repository with the candidate's generated lock and Dockerfile. The baked results differed in three lessons: a Help example fingerprint, the intentionally variable `today()` result, and database row order/fingerprints. The candidate has not run the coach/IDE browser audits.

On the remote VM, the current runtime's `docker export | gzip -1` was 1,236,891,136 bytes, versus 1,251,955,873 bytes for its saved Docker image: squashing saved only 1.2%. A preserved iximiuz VM retained the imported images after stop/restart, and `iximiuz/start-lab.sh` then reached the coach in 6.4 seconds without `docker load`. A new session from a saved template was not measured; its larger filesystem could take longer to fetch.
