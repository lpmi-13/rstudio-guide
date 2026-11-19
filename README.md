# RStudio guide: a coach inside the RStudio tab

RStudio Server with an in-IDE coach, two demonstrations, and an iximiuz Labs playground. It began as the feasibility spike for `plan-docs/R_STUDIO_WRAPPED.md` §6 (probes "Proxy and coach" and "Demonstration control"). This README is also the spike's decision record, dated 19 November 2026.

| Question | Answer |
| --- | --- |
| Can the coach run inside the RStudio IDE tab without breaking RStudio? | **Yes.** It needs a capture-phase keyboard shield that loads before RStudio's own code. |
| Can it dock into RStudio's layout instead of floating over it? | **Yes.** It docks into RStudio's own sidebar column, and RStudio resizes the other panes around it. If the learner hides the sidebar, it falls back to a floating card. |
| Can it drive a visible, automatic demonstration in the real IDE? | **Yes, for two article-based scenarios.** It selects each line in the Source pane, presses RStudio's Run button, and waits for the Console or Plots pane to show the reference result. Only then does it explain, quoting values that are on screen. |

Final runs: the guided audit passed 21/21, including the AI-assistant lockout, and the demonstration audit passed 12/12 on four consecutive runs (8 fresh provisions). There were no warnings, page errors, console errors, HTTP errors or failed requests through the gateway.

One intermittent failure appeared earlier, before the fix in finding 7: Chromium dropped the sign-in page's scripts while Docker was still changing the host network. It has not recurred in those 8 provisions, but that is evidence, not proof. The audits still check for it and report it as a warning if it happens.

## Run it

```bash
./run.sh up graphical-tools      # or statistical-tools, or regional-revenue (Guided, the default)
./run.sh down                    # stop and delete the run directory

# Audits (need @playwright/test installed globally). Each provisions its own runs.
./run.sh up regional-revenue && NODE_PATH=$(npm root -g) node tests/coach_in_ide.cjs results
NODE_PATH=$(npm root -g) node tests/demo_mode.cjs results
```

- Gateway with the coach: <http://127.0.0.1:8788/>. The user is `rstudio`; `./run.sh up` prints the password, which is also in `run/.env`.
- Direct RStudio without the coach, for comparison: <http://127.0.0.1:18787/>.
- Both ports listen on loopback only. `GATEWAY_BIND=0.0.0.0 ./run.sh up …` changes the gateway's address for a remote VM.

### Requirements

- Docker Engine with Compose v2, Python 3, curl and bash. `run.sh up` checks for these.
- About 3 GB of disk for the RStudio image (amd64 or arm64), and about 200 MB of RAM per run at idle.
- Free ports 8788 and 18787.
- Audits only: Node with `@playwright/test` and its Chromium installed globally.
- `run.sh` passes your UID/GID to the container, so RStudio can save into the bind-mounted project. UID 1000 is tested here. On iximiuz, `laborant` is UID 1001, and sign-in and both demos worked through rocker's re-created user. Saving a file under a non-1000 UID has not been tested.

## What is built

| Piece | File | Notes |
| --- | --- | --- |
| Scenarios | `scenarios/<id>/scenario.json`, `scenarios/<id>/project/` | `regional-revenue` (Guided), `graphical-tools` and `statistical-tools` (Demonstration). A demo's steps, code, evidence type, captured values and narration all live in one file. |
| Provisioning | `tools/provision.py`, `runtime/reference.R` | Copies the project and generates the demo script from `scenario.json`. It then runs every line in a throwaway container from the same image (`--network none`, 512 MB, 1 CPU, 60 s) to record what R prints and whether it draws. The run is not reported ready if any line errors, its plot/no-plot behaviour is wrong, or a capture pattern doesn't match. It writes `run/public/session.json` and `demo.json` for the coach. `run.sh` reports Ready only after the gateway answers and the host network has settled (finding 7). |
| Runtime | `runtime/Dockerfile`, `runtime/rstudio-prefs.json`, `runtime/03_lab_project` | `rocker/rstudio:4.6.2@sha256:ab667f41…` (RStudio Server 2026.11.0+203, R 4.6.2). The preferences show the sidebar on the right and hide Posit Assistant. Admin settings in `/etc/rstudio/rsession.conf` lock out Posit Assistant and Copilot, so a learner can't turn them back on: `posit-assistant-enabled`, `posit-assistant-installation-enabled`, `copilot-enabled` and the two `allow-*` options, all `0`. A container-init hook opens the run's project on first sign-in. |
| Gateway | `gateway/nginx.conf` | `nginx:1.27.3-alpine`. Proxies everything, including WebSockets and long-polls. Only the IDE host page (`location = /`) is rewritten, with the coach script tag placed right after `<head>`. `/coach/api/session` and `/coach/api/demo` serve the run's public files. `/coach/api/check` is a stub. |
| Coach | `coach/coach.js` | Vanilla JS in a Shadow DOM, about 600 lines. Contains the keyboard shield, docking and floating placement, a highlight overlay, the Guided view, and the Demonstration engine. |
| Audits | `tests/coach_in_ide.cjs`, `tests/demo_mode.cjs` | Playwright on headless Chromium. They drive the real IDE through the gateway, using only the coach's visible buttons; they never call coach internals to complete a step. They write `results/*.json` and screenshots. |

## Docking into the sidebar

RStudio 2026.11 has a full-height **Sidebar** pane. It is configured through `panes.sidebar_visible`, `sidebar_location` and `sidebar` in the user preferences, and by default holds Posit Assistant's Chat tab. The runtime turns the sidebar on (right-hand side) and Posit Assistant off. The coach mounts inside `#rstudio_Sidebar_pane` and covers its contents. A lab coach should not sit next to an AI assistant that could do the exercise anyway.

- RStudio lays out the other panes around the sidebar, so the coach covers none of them. That holds at 1366×768 (a 362 px column), 1440×900 (382 px) and 1920×1080 (511 px). Before docking, the floating card covered 37% of the Files/Plots pane at 1366×768.
- If the learner hides the sidebar (toolbar button), the coach floats, with collapse and drag. When the sidebar is shown again, it re-docks.
- **Hiding the sidebar deletes that pane's DOM, coach included.** The first version mounted a new coach, losing typed text and orphaning a running demo. The coach now keeps its element and re-attaches that same element. The audits check this mid-demo: the step still finishes, the coach is mounted exactly once, and the floating drag position is cleared on re-dock.

## Demonstration mode

The two scenarios follow the [article](https://dev.to/up_min_sparcs/statistical-analysis-using-rstudio-3h7c). Its code exists only as screenshots, so it was transcribed verbatim, including the inline comments.

| Scenario | Step | Code run (in order) | Evidence the coach waits for |
| --- | --- | --- | --- |
| `graphical-tools` | 1 Plots | `plot(5, 5)` | New chart loaded in Plots |
| | 2 Lines | `plot(1:10, type="l")` | New chart |
| | 3 Pie chart | `slices <- c(50, 20, 30)`, `pie(slices)` | Empty Console output, then a new chart |
| | 4 Bar graph | `frequencies <- c(3, 6, 9)`, `label <- c("X", "Y", "Z")`, `barplot(frequencies, names.arg = label)` | Empty output twice, then a new chart |
| `statistical-tools` | 1 Min and max | `sample_data <- airquality`, `max(sample_data$Temp)`, `min(sample_data$Temp)` | `[1] 97`, `[1] 56` |
| | 2 Mean | `mean(sample_data$Temp)` | `[1] 77.88235` |
| | 3 Median | `median(sample_data$Temp)` | `[1] 79` |
| | 4 Percentiles | `quantile(sample_data$Temp)`, `quantile(sample_data$Temp, c(0.45))` | `56 72 79 85 97`, `45% 78` |
| | 5 Summary | `summary(sample_data$Temp)` | `56.00 72.00 79.00 77.88 85.00 97.00` |

The reference run reproduces every value shown in the article's screenshots.

### How a step runs

1. If the script isn't already the active Source tab, the coach opens it from the Files pane, highlighting the file first.
2. For each line, the coach:
   - selects that line in the Source editor (Ace API);
   - highlights **Run**;
   - presses it with a synthetic mouse-down/up/click sequence (GWT ignores a bare `.click()`).
3. The coach waits until the Console echoes the line. The output after the echo must have the same tokens as the reference output, and a plotting line must show a new, fully loaded `/graphics/<id>.png` in the Plots pane. All of that must stay true for 300 ms. Token comparison tolerates RStudio wrapping output to fit a narrow Console.
4. Only then does it read each captured value from the Console text and compare it with the reference. It then highlights the evidence pane (Plots, Console or Environment).
5. After the last line, it shows the explanation, filled with the captured values. Each step waits for **Next**.

**Failures stop visibly.** The step turns red, the card says why, and **Try this step again** and **Start over** appear. Tested cases:

- The script was changed, so a line is missing. Message: `graphical-tools.R no longer contains the line plot(5, 5)…`. The coach does not run the edited line.
- R raised an error. Message: `R reported: Error: object 'sample_data' not found`, shown immediately. RStudio prints errors after its inline "Show Traceback / Rerun with Debug" links, so the check looks for them there too.
- No echo, no chart, or different output within 20 s. The message names which of these happened.

Progress is kept per run in `sessionStorage`, so a reload resumes at the next step. **Stop** ends the demo, and no further RStudio actions happen after it. The coach looks up RStudio elements again after every pause, because RStudio re-renders the Files list and toolbar when files change. The first version clicked a stale Files link and the open silently failed.

### Audit results (`tests/demo_mode.cjs`)

| Probe | Result |
| --- | --- |
| Coach docks in the sidebar and covers no other pane (1440×900 and 1366×768) | Pass |
| A changed demo script stops step 1 with a clear message | Pass |
| After restoring the script and closing its tab, **Try this step again** reopens it from Files and passes | Pass |
| Graphical steps 2–4: each explanation appears only after a new chart is on screen | Pass. 2.8 s, 5.2 s and 7.9 s per step. |
| Hiding and re-showing the sidebar during step 4 | Pass. Same coach, step completes, re-docked geometry. |
| Reload keeps progress; **Stop** during a step halts RStudio actions | Pass |
| Statistical steps 1–2 at 1366×768, quoting values the Console printed | Pass (`max=97`, `min=56`, `mean=77.88235`) |
| Reload resumes at step 3 | Pass |
| The learner runs `rm(sample_data)`, so step 3 stops with R's error | Pass |
| **Start over** recreates the data and finishes all 5 steps | Pass. All 8 summary and percentile values match. |
| The demonstration never leaves unsaved changes in the script | Pass |

At every explanation, the audit takes its own snapshot of the Console and Plots pane. It checks the reference output and every quoted value against that snapshot, independently of the coach's checks.

## Guided mode audit (`tests/coach_in_ide.cjs`, `regional-revenue`)

| Probe | Result |
| --- | --- |
| Sign-in through the gateway; project opens | Pass |
| Coach mounts once, top window only; docks in the sidebar, filling it | Pass |
| Console, Environment, Source edit and save to disk | Pass |
| Unsaved edit stays off disk; RStudio shows its unsaved marker | Pass. The tab shows `analysis.R` when clean and `analysis.R*` when unsaved. |
| RStudio shortcuts pressed in the coach textarea (with shield) | Pass. Ctrl+Enter, Ctrl+1, Ctrl+2, Ctrl+L, Ctrl+., Ctrl+Shift+N, Alt+Shift+K, F1 and Esc all had no effect. |
| Typing isolation; focus kept while R prints | Pass. Docked inside a GWT pane, too. |
| Check work stub, Console highlight (0 px error, clicks pass through) | Pass |
| Sidebar hidden: floats, collapses, drags; shown again: re-docks without re-mounting | Pass |
| Help iframe without the coach; Terminal over WebSocket; reload keeps the R session | Pass |
| A/B without the shield (informational) | Ctrl+Enter ran code, Ctrl+L cleared the Console, and four chords stole focus or opened popups. |
| 1366×768 and 1920×1080: docked coach covers no other pane | Pass |
| No AI assistant after the learner re-enables Posit Assistant and Copilot in their preferences | Pass. No toolbar button, no sidebar tab, no assistant text in any frame, and the coach still docks. |
| Baseline: direct RStudio | Pass. 0 errors either way. |

## Findings

1. **Injection works; framing does not.** RStudio sends no CSP but does send `X-Frame-Options: DENY`. A same-origin script works; an iframe around RStudio can't.
2. **RStudio's shortcuts run in the capture phase.** The coach must register `window` capture listeners before GWT loads, so the gateway injects it right after `<head>`. This depends on script order, so the A/B probe stays in the audit.
3. **The sidebar is the right home for the coach.** It is a real RStudio pane, so no other pane is covered, and RStudio handles resizing and left/right placement. The cost: the coach covers whatever tab is in the sidebar (Chat, now switched off). The coach must also survive RStudio deleting the pane's DOM when the sidebar is hidden.
4. **Driving the real IDE from the page works, but it is coupled to this RStudio build.** The coach depends on:
   - the Run button's title text;
   - the Ace editor's `env.editor`;
   - the plot image inside the Plots iframe;
   - an unlabelled tab-close icon (tests only).

   Pin the image digest and rerun `demo_mode.cjs` before any upgrade.
5. **Correction to the first pass.** The first pass claimed RStudio "marks the tab `analysis.R*`". That probe read `textContent`, and RStudio keeps a hidden `*` in every tab's DOM. Only the rendered text (`innerText`) shows the marker, and only when there are unsaved changes. The probes now check both the clean and the unsaved state. A save probe with the same flaw had been silently timing out; it now asserts that the marker clears.
6. **RStudio only reloads a file changed on disk when the editor gets focus**, and not reliably in headless Chromium. The demo's advice after a changed script is to start a new run. Closing the tab, which the coach then reopens from Files, also works.
7. **A new run can break a page that is loading in an already-open browser.** In two of about eight audit runs, the sign-in page loaded without its scripts. The Sign in button then did nothing, and every later probe failed.
   - Diagnostics showed Chromium aborting `signin.css`, `encrypt.min.js` and `signin.js` with `net::ERR_NETWORK_CHANGED`.
   - `ip monitor` showed why: Docker adds the run's interfaces, and their IPv6 link-local addresses appear up to **0.6 s after** RStudio first answers. Chromium aborts in-flight requests when host addresses change.
   - The server was never at fault: 60 fetches of the sign-in page from the first second after startup were all complete.
   - It only hit a browser left open across a re-provision. That is exactly the situation of a learner's tab during reset or replay in a local lab.

   **Fixes:**
   - `run.sh` now reports Ready only after the host's interface addresses (ignoring lifetimes) have been unchanged for 2 s.
   - Both audits check that the sign-in page's scripts loaded. If not, they record a warning with the failed requests, reload once, and continue, so a recurrence is reported rather than cascading.
   - For the real launcher, the preparation and handoff page should apply the same settle rule. It should also check that the IDE page is functional, not just that it returned HTTP 200.

8. **User preferences alone did not keep AI assistants out.** A learner who turned Posit Assistant back on in Global Options got its toolbar button back and an **Install Posit Assistant** offer.
   - `allow-posit-assistant=0` and `allow-copilot=0` alone changed nothing visible.
   - The integration switches did: `posit-assistant-enabled=0`, `copilot-enabled=0` and `posit-assistant-installation-enabled=0`. With them, nothing assistant-related appears, even after the learner re-enables it.
   - None of these options is listed in `rsession --help` in this build. The guided audit now re-enables assistants as a learner would and fails if any trace appears. The sidebar becomes an empty pane that the coach covers.

## Remote playground (iximiuz Labs)

The playground runs from a published **rootfs image**, `ghcr.io/lpmi-13/rstudio-guide-rootfs`. It is built on iximiuz's Docker base (`ubuntu-docker-c36cb070`) and carries this repository, the terminal banner, and the RStudio runtime and gateway images, preloaded so no Docker Hub pull is needed. Publishing works like argo-remotelab's `scripts/publish-rootfs-image.sh`.

### Publish a new rootfs version

After signing in to GHCR with Docker (`docker login ghcr.io`), run one command:

```bash
bash iximiuz/publish-rootfs-image.sh
```

- **Tag:** the command picks the next version after `ROOTFS_IMAGE_TAG` in `iximiuz/versions.sh`, so `v1` becomes `v2`. To choose the tag yourself, pass it as the only argument. A tag the checkout already references is refused.
- **Build and push:** it rebuilds the runtime image, saves it and the gateway image into the rootfs, then builds the rootfs and pushes it to GHCR. Each push gets three attempts; GHCR sometimes rejects a manifest right after a large upload.
- **References:** only after the push succeeds does it update `iximiuz/versions.sh` and the `source: oci://…` line in `iximiuz/manifest.yaml`. A failed push leaves both untouched.
- **Remote playground:** it then runs `labctl playground update` for the custom playground named in `iximiuz/manifest.yaml`. If that playground doesn't exist yet, it prints the one-time `labctl playground create` command instead. If the update fails, retry it without rebuilding using `bash iximiuz/publish-rootfs-image.sh --sync-remote`.
- **Visibility:** a new GHCR package is private. Make `rstudio-guide-rootfs` public in GitHub's package settings once, or iximiuz can't pull it.
- **Tests:** `python3 tests/test_publish_rootfs_image.py -v` covers the tag logic, the publish order and the failure paths, using stub `docker` and `labctl`.

Use a fresh tag for each release, so new playground sessions pull the new image.

### Start a playground

```bash
labctl playground start docker -f iximiuz/manifest.yaml                        # throwaway session
labctl playground create --base docker -f iximiuz/manifest.yaml rstudio-guide  # custom playground, once
```

**What a learner sees:** the playground opens on **Terminal**, which prints the RStudio username and this run's password. If RStudio is still starting, the terminal waits and then prints them. A second tab, **RStudio**, shows the IDE inside the playground page with the coach docked. That makes one click plus sign-in. To switch scenario, run `./run.sh up statistical-tools`; a new terminal then shows the new password.

### How it works

- **Init:** the manifest's single init task runs `iximiuz/start-lab.sh`. On first start it does `docker load` on `/opt/rstudio-guide/images.tar`, then runs `./run.sh up graphical-tools`.
- **`lab.env`** is baked into the rootfs with `FRAME_ORIGIN=https://labs.iximiuz.com`, `GATEWAY_BIND=0.0.0.0` and `LAB_PREBUILT=1`. Every later `./run.sh up` keeps these, so switching scenario keeps the RStudio tab working and never rebuilds or pulls. Values set in the environment still win.
- **The RStudio tab** is an `http-port` tab on 8788 with private (owner-only) access. RStudio allows `labs.iximiuz.com` to frame it via `www-frame-origin`, set at container start by `runtime/04_lab_frame_origin`. The coach skips only frames nested *inside* RStudio, so it runs when RStudio itself is framed.
- **Earlier approach:** the first tests below packed the repository into the manifest as a startup file, because iximiuz allows at most 20 startup files. The rootfs image replaced that.

### Results: rootfs image

Tested on 19 November 2026 with throwaway sessions from `iximiuz/manifest.yaml`. Each check below was driven through an SSH tunnel (`labctl port-forward`) with the Playwright CLI.

| Check | v1 | v2 (current) |
| --- | --- | --- |
| Init task | **Failed, retrying every second.** `docker save` writes its archive as `0600`, so `laborant` couldn't read `/opt/rstudio-guide/images.tar`. With the file made readable by hand, everything below passed. | Passes unaided |
| Start command to RStudio ready | n/a | **149 s and 144 s.** About 2 min of that passes before the VM boots, while iximiuz fetches the 1.66 GB rootfs; a second start was no faster. Boot to ready is 34 s (`docker load`, provisioning, RStudio start). |
| Rebuilds or pulls in the VM | none | none (`LAB_PREBUILT=1`; build cache empty) |
| Scenario switch as a learner (`./run.sh up statistical-tools`) | 19 s | 18 s; the message says to open the RStudio tab |
| Terminal banner, gateway reached by machine name, AI lockout | Pass | Pass |
| Graphical demo, all 4 steps (each explained only after a new chart loaded) | Pass | Pass |
| Statistics demo, all 5 steps (values match the Console and the article) | Pass | Pass |
| Layout in the VM | `~/rstudio-guide/spike/coach-in-ide` | `~/rstudio-guide`, the same as this repository |

**The v2 fix:** the build script makes the archive `0644`, and the rootfs build now fails if `laborant` can't read the archive, run `start-lab.sh` or write the repository. That check caught a second bug before anything was pushed. `COPY --chmod=0644` also gives the directory it creates mode `0644`, which `laborant` can't enter, so the Dockerfile doesn't use it.

**Start-up trade-off:** the earlier manifest-embedding version reached ready in 86–107 s. It booted iximiuz's cached Docker base and pulled 2.6 GB from Docker Hub during init. The rootfs version is about 45 s slower, because iximiuz downloads the custom rootfs before boot, but it no longer depends on Docker Hub or its rate limits. Faster alternatives to try if start-up matters: a smaller runtime image (rocker's image is most of the 1.66 GB), or pushing only the runtime image to GHCR and pulling it during init on the cached base.

### Results: earlier manifest-embedding version

From the version that packed the code into the manifest, on the official `docker` base (Ubuntu 24.04, 2 CPU, 4 GiB, 20 GiB disk).

| Check | Result |
| --- | --- |
| Init time, start to RStudio ready (includes the 2.6 GB image pull) | 86 s and 107 s on two playgrounds. No Docker Hub rate limit was hit. |
| Memory, idle after sign-in | RStudio container about 14 MiB, gateway about 2 MiB; 3.4 of 3.9 GiB free |
| Headers RStudio sends on the VM | `Content-Security-Policy: frame-ancestors https://labs.iximiuz.com`; redirects follow `X-Forwarded-Proto: https` |
| Where iximiuz's proxy connects | The machine by name (`docker-01:8788`). With the gateway on loopback that was **refused**; with `GATEWAY_BIND=0.0.0.0` it answers. RStudio's direct port 18787 stays loopback-only, so the proxy can't bypass the coach. |
| Cookies inside the tab | Exposed ports live on `*.node-eu-<id>.iximiuz.com`, the same site as `labs.iximiuz.com`, so RStudio's default (Lax) cookies are sent in the frame. No `SAME_SITE` change was needed. |
| Private access | Anonymous requests to the exposed URL get a 302 to iximiuz sign-in. iximiuz adds its own `frame-ancestors 'self' https://*.iximiuz.com`. |
| The RStudio tab inside the iximiuz page, signed in | **Confirmed working by hand.** Headless testing can't reach it, because it needs an iximiuz login. |

### Not done yet

- A saved custom playground (`labctl playground create --base docker -f iximiuz/manifest.yaml rstudio-guide`). Once it exists, `publish-rootfs-image.sh` also updates it.
- The RStudio tab on v2, signed in by hand. The same mechanism was confirmed on the earlier version.

## Plan deviations and open points

- **Demonstration control uses RStudio's own UI, not `rstudioapi`.** The plan proposed an addin calling `rstudioapi::sendToConsole()`. That needs an R-side trigger and a package the image doesn't have. Pressing the real Run button on a visible selection works without either, and shows the learner the exact workflow they will use.
  - Trade-off: it depends on DOM details (finding 4).
  - Rejected alternatives: RStudio's internal `/rpc/console_input` and the undocumented `window.dispatchRStudioCommandExternal`.
- **The demo data are fixed.** Both scenarios use the article's literal values and R's built-in `airquality` data. The plan's per-run variation by scenario key does not apply to them yet.
- **The article's "Lines" text and code disagree.** The text describes `lines()`, which adds to an existing plot, but the code is `plot(1:10, type="l")`, which draws a new one. The demo runs the article's code and the narration explains both.
- **Expected values reach the browser in Demonstration mode.** That is acceptable for an unscored demo. Challenge mode must not do this (plan §4).
- **Not covered yet:** saved-code grading, clean replay by key, launch handoff, headed Chrome and Firefox, and a security review. Same-origin coach code can call RStudio's RPC endpoints.
