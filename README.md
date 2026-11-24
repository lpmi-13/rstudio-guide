# RStudio guide: a coach inside the RStudio tab

RStudio Server with an in-IDE coach, lessons modelled on R for Data Science that can each be watched (Demonstration), done with help (Guided) or done alone (Solo), and an iximiuz Labs playground. All 29 lessons are written. It began as the feasibility spike for `plan-docs/R_STUDIO_WRAPPED.md` §6 (probes "Proxy and coach" and "Demonstration control"). This README is also the spike's decision record, dated 19 November 2026.

**Inspiration for the lessons.** The next set of lessons follows the chapters of [R for Data Science (2e)](https://r4ds.hadley.nz) by Hadley Wickham, Mine Çetinkaya-Rundel and Garrett Grolemund. There is one lesson for each of its 29 chapters, teaching the same concepts. The book guides what the lab teaches; it isn't a source of material. The lessons use their own code, data and explanations, built on current R packages. On 20 November 2026 the first four replaced the two article-based lessons the spike began with, `graphical-tools` and `statistical-tools`, and the other 25 followed on 21 November. This README keeps those lessons' audit records as history. The plan is `plan-docs/R4DS_CHAPTERS_PLAN.md`. The book is free to read online, and it is the best place to go deeper on any of these topics.

**Try it in your browser:** [RStudio coach on iximiuz Labs](https://labs.iximiuz.com/playgrounds/rstudio-guide-16afe14e). It needs a free iximiuz account. Starting it takes about a minute. Since 22 November 2026 (rootfs v5) it offers all 29 lessons. From rootfs v6 (built, not yet published) it opens on the **RStudio** tab, already signed in, with no Terminal tab and no password; v5 shows the password in a **Terminal** tab, and the **RStudio** tab asks for it.

| Question | Answer |
| --- | --- |
| Can the coach run inside the RStudio IDE tab without breaking RStudio? | **Yes.** It needs a capture-phase keyboard shield that loads before RStudio's own code. |
| Can it dock into RStudio's layout instead of floating over it? | **Yes.** It docks into RStudio's own sidebar column, and RStudio resizes the other panes around it. If the learner hides the sidebar, it falls back to a floating card. |
| Can the learner choose a lesson, and whether to watch, be guided, or work alone? | **Yes.** A new run holds all 29 lessons and opens on a picker in the coach: a lesson, then **Demonstration**, **Guided** or **Solo**, over the same steps, script and reference results. Guided and Solo check the learner's own work against R's record of what ran. |
| Can it drive a visible, automatic demonstration in the real IDE? | **Yes.** It works RStudio the way a learner would: a visible pointer moves to each control it clicks, and it types each statement into the Source pane one key at a time, using Ctrl+Shift+M for the pipe where a lesson teaches it. It then presses RStudio's Run button and waits until R's record matches the reference result, and a chart has loaded where there is one. Only then does it explain, quoting the reference values. |

On the article lessons, 19 to 20 November: the guided audit passed 21/21, including the AI-assistant lockout, and the demonstration audit passed 12/12 on four consecutive runs (8 fresh provisions). There were no warnings, page errors, console errors, HTTP errors or failed requests through the gateway. After the demonstrations were changed to type their code with a visible pointer, the demonstration audit passed 12/12 and the guided audit 21/21, each on one run, again with no warnings or page errors. After the lesson and mode picker, Guided and Solo were added, one run each: picker, Guided and Solo audit 17/17, demonstration 12/12 (now choosing Demonstration on the picker) and the regional-revenue audit 21/21, with no warnings or page errors. After the dimmed spotlight and slower pacing, one run each: the same 17/17, 12/12 and 21/21. After the demonstration panel was changed to show only the current step, narrated by each line's purpose, the demonstration audit passed 12/12 on one run, with no warnings or page errors (the other audits were not rerun). After every line and explanation were given a reading countdown with **Advance**, it passed 12/12 again on one run, with no warnings or page errors, in 9.2 minutes. After every mode choice (and **Start over**) was made to start the lesson afresh, one run each: picker, Guided and Solo audit 19/19, demonstration 12/12 in 9.9 minutes, and the regional-revenue audit 21/21, with no warnings or page errors.

One intermittent failure appeared earlier, before the fix in finding 7: Chromium dropped the sign-in page's scripts while Docker was still changing the host network. It has not recurred in those 8 provisions, but that is evidence, not proof. The audits still check for it and report it as a warning if it happens.

## Work ledger

Where the work stands and what's left, so it can resume from here. Updated 24 November 2026. The plan for the new lessons is `~/projects/plan-docs/R4DS_CHAPTERS_PLAN.md` (its §6 lists the phases). Each finished phase has a decision record in this README, named below.

### Done

| When | Work | Record |
| --- | --- | --- |
| 19 Nov 2026 | The coach spike: docking in the sidebar, the lesson and mode picker, Demonstration, Guided and Solo on the two article lessons, the `regional-revenue` Guided stub, and the iximiuz playground (rootfs v4, `698a722`). | The sections from "Docking into the sidebar" to "Findings", and "Remote playground" |
| 20 Nov 2026 | A plan for 29 lessons modelled on R for Data Science, with all-original material; decisions settled (plan §9). | The plan |
| 20 Nov 2026 | Phase 0: seven spikes, and the runtime moved to `rocker/tidyverse:4.6.2` with Air and R's evidence channel. | "Phase 0 spikes for the new lessons" |
| 20 Nov 2026 | arm64 dropped: the lab is built and tested for amd64 only. | Requirements |
| 20 Nov 2026 | Phase 1: the Larkhaven Bikes data, the version 2 lesson format and its validator, the bake, the coach changes, two audit fixtures and two new audits. Committed as `072e01c` on `main`. | "Phase 1: engine and world" |
| 20 Nov 2026 | Phase 2 pilots: lessons 1 Data visualization, 3 Data transformation, 7 Data import and 28 Quarto. Committed as `2cee0e5` (not pushed). | "Phase 2: the four pilot lessons" |
| 20 Nov 2026 | The pilots' review: every claim checked against the data, four changes, and `check.R` asserting the facts they rely on. Committed as `0a42c38`. | "Changes after the review", under Phase 2 |
| 20 Nov 2026 | Phase 2, the swap: the pilots replace the article lessons, and `demo_mode.cjs` and `practice_modes.cjs` are ported to them. Committed as `0a42c38`. | "Choosing a lesson and a mode" and "Demonstration mode" |
| 21 Nov 2026 | Phase 3: the other 25 lessons, with what they needed (Alt+-, `source` and `new-project` actions, a fresh start that returns to the lessons' project and resets Help, the Viewer and `View()` tabs, fingerprints for databases, duckplyr, rvest and patchwork, a DuckDB file in the world, and new world checks), the default run of every lesson, `tools/format_lesson.py`, and parallel lesson audits. Committed as `0a42c38`. | "Phase 3: the other 25 lessons" |
| 21–22 Nov 2026 | Phase 4, release, all automated (no manual review at this stage, the user's call): a security review of `/coach/api/evidence` (one fix, two hardenings), an automated learner-read review of the 25 new lessons (11 small text fixes), every Demonstration timed at the coach's own pace (4.9 to 10.6 minutes), every audit run again (all passed), and rootfs v5 published to the public playground (76 to 107 s from start to ready). The review and fixes are in `0a42c38`; the timings, audits and v5 aren't committed yet. | "Phase 4: release" |
| 24 Nov 2026 | The playground opens on RStudio, signed in: `DISABLE_AUTH=true` in its `lab.env`, no Terminal tab or banner, and a starting page in the gateway for the moment before RStudio listens. Tested locally and on a throwaway iximiuz session; v6 not published yet. | "Sign-in off and the starting page", under "Remote playground" |

### Outstanding, in order

1. **Publish rootfs v6**, with RStudio's sign-in off and no Terminal tab: `bash iximiuz/publish-rootfs-image.sh`. It also updates the public playground.
2. **A manual review by the user**, last: the lessons read and the Demonstrations watched as a learner would, and the playground tried by hand (the RStudio tab, which headless tests can't reach inside the iximiuz page).

Also open: lessons 9 and 11's Demonstrations run a little over the plan's 10 minutes (10.3 and 10.6); the spikes in `spikes/phase0/` provision the retired `statistical-tools`; the coach's code for the older lesson format is no longer exercised by any audit; Guided says nothing when a Quarto render fails (the error shows only in RStudio's Background Jobs tab); a learner can pass a style lesson (4) with unstyled code, since checks see results; and the points under "Plan deviations and open points" at the end.

### Picking up again

- **Read first:** the plan's §6, then this README's "Phase 1" to "Phase 4" sections. `scenarios/engine-check/scenario.json` shows each kind of evidence, and `scenarios/engine-actions/scenario.json` each IDE action; lessons 4 and 6 show the newer ones.
- **Checks, in the order they're useful:** `python3 -I tools/check_content.py` (seconds), `python3 -I tools/format_lesson.py rstudio-guide-runtime:local <lesson>` then `python3 -I tools/bake.py rstudio-guide-runtime:local <lesson>` (seconds per lesson), `NODE_PATH=$(npm root -g) node tests/lesson_modes.cjs <lesson> results/<lesson>` (a few minutes), or `tests/run_lesson_audits.py` for many lessons at once. Then the other audits under "Run it".
- **Things that catch people out:**
  - `tests/coach_in_ide.cjs` expects `./run.sh up regional-revenue` first; run against any other run, most of its probes fail.
  - Changing `runtime/` or `content/world/` means `./run.sh up` rebuilds the image, and the lessons re-bake because their stamps change. The bake uses the image's own `bake.R` and `evidence.R`, so a change to either is tested only after a rebuild. After a deliberate package change, run `tools/update_packages_lock.sh` and review the diff, or the image won't build.
  - Audits run one at a time on run.sh's default folder and ports; `run_lesson_audits.py` gives each slot its own (`run-2/`, port 8792, and so on).
  - An explanation's `{name}` is a value; write `{{5}}` for a literal `{5}`.
  - On this machine an RTK hook rewrites `find`, `head`, `diff`, `cat` and `curl` and can corrupt their output; call `/usr/bin/find` and the like, or `rtk proxy`, when the output is evidence.

## Run it

```bash
./run.sh up                      # every lesson in one project, "lessons" (the default)
./run.sh up 03-data-transformation  # one lesson only (any lesson's folder name in scenarios/, or regional-revenue)
./run.sh up engine-check         # an audit fixture for the new lessons' engine (or engine-actions)
./run.sh down                    # stop and delete the run directory

# Checks of the lessons' content, and their reference results (both also run as part of `up`).
python3 -I tools/check_content.py
python3 -I tools/bake.py rstudio-guide-runtime:local engine-check engine-actions 01-data-visualization
python3 -I tools/format_lesson.py rstudio-guide-runtime:local 09-layers   # format a lesson's code as Air does

# Audits (need @playwright/test installed globally). Each provisions its own runs.
./run.sh up regional-revenue && NODE_PATH=$(npm root -g) node tests/coach_in_ide.cjs results
NODE_PATH=$(npm root -g) node tests/demo_mode.cjs results
NODE_PATH=$(npm root -g) node tests/practice_modes.cjs results
NODE_PATH=$(npm root -g) node tests/lesson_modes.cjs engine-check results/engine-check
NODE_PATH=$(npm root -g) node tests/lesson_modes.cjs 01-data-visualization results/lesson-01
NODE_PATH=$(npm root -g) node tests/lesson_switch.cjs results/lesson-switch
NODE_PATH=$(npm root -g) node tests/no_sign_in.cjs results/no-sign-in   # sign-in off, as on iximiuz, and the starting page
NODE_PATH=$(npm root -g) python3 -I tests/run_lesson_audits.py --jobs 3   # every lesson's audit, 3 runs side by side
LAB_PACE=normal NODE_PATH=$(npm root -g) python3 -I tests/run_lesson_audits.py --jobs 4 $(python3 -I tools/collection.py)   # time every Demonstration at the coach's own pace
```

After signing in (straight away with sign-in off), choose a lesson and then **Demonstration**, **Guided** or **Solo** in the Coach pane on the right; `run.sh` prints the same reminder. A one-lesson run shows only that lesson. `regional-revenue` is the original Guided stub (a Check work button, no steps), so it opens straight into it with no picker, and it can't share a run.

- Gateway with the coach: <http://127.0.0.1:8788/>. The user is `rstudio`; `./run.sh up` prints the password, which is also in `run/.env`.
- `DISABLE_AUTH=true ./run.sh up …` skips RStudio's sign-in, as the iximiuz playground does (its `lab.env` sets it). Then anyone who can reach the gateway gets RStudio, and its terminal, as `rstudio`: other users of the machine, and websites you visit, through DNS rebinding. So keep the password on a machine of your own, and use this for audits (any audit that signs in through `tests/lib.cjs` runs this way too). `run.sh` still sets the account's password, so it never keeps Rocker's default one.
- Direct RStudio without the coach, for comparison: <http://127.0.0.1:18787/>.
- Both ports listen on loopback only. On a remote VM, keep that and use an SSH tunnel: `ssh -L 8788:127.0.0.1:8788 <vm>`, then open <http://127.0.0.1:8788/> locally. `GATEWAY_BIND=0.0.0.0 ./run.sh up …` serves RStudio over plain HTTP on every network the VM is on, where anyone who can read the traffic can take over the session, and Docker's published ports bypass host firewalls such as ufw. Use it only behind something that adds TLS and access control, as the iximiuz playground's private RStudio tab does.

### Requirements

- Docker Engine with Compose v2, Python 3, curl and bash. `run.sh up` checks for these.
- An amd64 machine. The lab is built and tested for amd64 only.
- About 3.2 GB of disk for the RStudio image, and about 200 MB of RAM per run at idle.
- Free ports 8788 and 18787.
- Audits only: Node with `@playwright/test` and its Chromium installed globally.
- `run.sh` passes your UID/GID to the container, so RStudio can save into the bind-mounted project. UID 1000 is tested here. On iximiuz, `laborant` is UID 1001, and sign-in and both demos worked through rocker's re-created user. Saving a file under a non-1000 UID has not been tested.

## What is built

| Piece | File | Notes |
| --- | --- | --- |
| Scenarios | `scenarios/<id>/scenario.json`, `scenarios/<id>/project/` | The lessons modelled on R for Data Science use the format with `"version": 2` (see Phase 1): all 29 (see Phases 2 and 3), which offer `"modes": ["demonstration", "guided", "solo"]` and can share a run, and `engine-check` and `engine-actions`, audit fixtures in that format. A lesson's steps, code, evidence type, captured values, narration (each statement's `purpose`) and the task shown to a learner for each statement all live in one file. `regional-revenue` offers only its Guided stub, in the older format, which the retired article lessons also used. A lesson whose script is a Quarto document gives the document's starting text instead of generated headings. |
| Lessons | `content/lessons/collection.json`, `content/lessons/baked/` | The 29 lessons modelled on R for Data Science, in the book's six parts, each with its Go deeper link; a lesson's number is its place in the list. `baked/` holds each lesson's reference results (see Bake). |
| World | `content/world/generate.R`, `check.R`, `data/` | Larkhaven Bikes, the made-up city all the new lessons use, generated from one seed (see Phase 1). The small files are committed; the image generates everything and fails to build if its small files differ. |
| Provisioning | `tools/provision.py` | Copies each lesson's files into one project (named after the lesson, or `lessons` when there are several, with a README listing them; it refuses clashing file names), adds `data/` for lessons that use the world, and generates each lesson's script from `scenario.json`: a header and one `# Step N.` heading per step, with no code yet. The coach or the learner types it, depending on the mode. Every statement needs a `task` when Guided or Solo is offered, and gets generated hints (how it starts, `plot(…)` or `trips |>` then `filter(…)`, and the whole statement without comments); an IDE action gets two (where to look, then exactly what to do). The reference results come from the bake. The run is not reported ready if the bake fails. It writes `run/public/session.json` (the lessons and their modes) and `steps.json` for the coach. `run.sh` reports Ready only after the gateway answers and the host network has settled (finding 7). |
| Bake | `tools/bake.py`, `runtime/bake.R` | Runs each lesson twice, as the Console would, in throwaway containers from the runtime image (`--network none`, read-only, 2 GB, 2 CPUs, 10 minutes) and records each statement's output, fingerprint, assigned name, chart, warnings, messages, files written and quoted values. It fails on anything unexpected (see Phase 1) and when the two runs differ. Results are committed in `content/lessons/baked/` with a stamp of what they depend on, so `up` bakes only after a change. |
| Content checks | `tools/check_content.py`, `tools/format_lesson.py` | The schema, purposes and tasks, step counts and the evidence each statement needs, without running R. `format_lesson.py` formats a lesson's code the way Air does, which the bake requires. `tools/collection.py` lists the lessons written, in order: `run.sh`'s default run. |
| Runtime | `runtime/Dockerfile`, `runtime/rstudio-prefs.json`, `runtime/03_lab_project`, `runtime/evidence.R`, `runtime/packages.lock` | `rocker/tidyverse:4.6.2@sha256:9241ac46…` (RStudio Server 2026.11.0+203, R 4.6.2, Ubuntu 26.04), from 20 November 2026; before that, `rocker/rstudio:4.6.2`. It adds the new lessons' packages from a dated Posit Package Manager snapshot, Air 0.13.0 and `~/.duckdb` (see Phase 0 spikes). The build fails if any installed package's version differs from `runtime/packages.lock` (refresh it with `tools/update_packages_lock.sh` after a deliberate upgrade), and it generates the world into `/opt/lab/world`. Each RStudio session records evidence of the learner's work for the coach (`runtime/evidence.R`, spike S2). The preferences show the sidebar on the right, hide Posit Assistant, use Air, run whole statements with Ctrl+Enter, and show rendered documents in the Viewer. Admin settings in `/etc/rstudio/rsession.conf` lock out Posit Assistant and Copilot, so a learner can't turn them back on: `posit-assistant-enabled`, `posit-assistant-installation-enabled`, `copilot-enabled` and the two `allow-*` options, all `0`. A container-init hook opens the run's project on first sign-in. |
| Gateway | `gateway/nginx.conf`, `gateway/starting.html` | `nginx:1.30.7-alpine` (stable branch). Proxies everything, including WebSockets and long-polls. Only the IDE host page (`location = /`) is rewritten, with the coach script tag placed right after `<head>`. If RStudio isn't answering yet, that page is a short "RStudio is starting" page instead (503, reloads itself every 2 s), not nginx's 502, which would stay until the learner reloaded; every other path still gets the 502. `/coach/api/session` and `/coach/api/steps` serve the run's public files. `/coach/api/evidence` serves R's evidence only to a browser signed in to RStudio (`auth_request`; see Phase 4's security review). The coach's API answers as JSON with `nosniff`, and nginx doesn't give its version. `/coach/api/check` is a stub. |
| Coach | `coach/coach.js` | Vanilla JS in a Shadow DOM, about 2,800 lines. Contains the keyboard shield (which also notices shortcuts such as Alt+-), docking and floating placement, an overlay with the highlight box and the pointer, the lesson and mode picker (and the one-line picker for the new lessons), the fresh start (script reset, Environment, Plots and Console cleared; R restarted between new lessons), the RStudio driver (Demonstration and Show me: multi-line typing and IDE actions), the evidence reader, the Console watcher (Guided and Solo), and the regional-revenue Guided stub. |
| Audits | `tests/coach_in_ide.cjs`, `tests/demo_mode.cjs`, `tests/practice_modes.cjs`, `tests/lesson_modes.cjs`, `tests/lesson_switch.cjs`, `tests/no_sign_in.cjs` (shared helpers in `tests/lib.cjs`), `tests/run_lesson_audits.py` (lesson audits side by side) | Playwright on headless Chromium. With `LAB_PACE=normal`, the lesson audit runs Demonstration alone at the coach's own pace and times each step. They drive the real IDE through the gateway, using only the coach's visible buttons, the keyboard and RStudio's own menus, as a learner would; they never call coach internals to complete a step. They write `results/*.json` and screenshots to a local, git-ignored `results/` folder. |
| Spikes | `spikes/phase0/` | The Phase 0 spikes for the new lessons (see that section). They use the audits' helpers and write to `results/spikes/`. They provision the retired `statistical-tools` lesson, so they need changing before they run again. |

## Docking into the sidebar

RStudio 2026.11 has a full-height **Sidebar** pane. It is configured through `panes.sidebar_visible`, `sidebar_location` and `sidebar` in the user preferences, and by default holds Posit Assistant's Chat tab. The runtime turns the sidebar on (right-hand side) and Posit Assistant off. The coach mounts inside `#rstudio_Sidebar_pane` and covers its contents. A lab coach should not sit next to an AI assistant that could do the exercise anyway.

- RStudio lays out the other panes around the sidebar, so the coach covers none of them. That holds at 1366×768 (a 362 px column), 1440×900 (382 px) and 1920×1080 (511 px). Before docking, the floating card covered 37% of the Files/Plots pane at 1366×768.
- If the learner hides the sidebar (toolbar button), the coach floats, with collapse and drag. When the sidebar is shown again, it re-docks.
- **Hiding the sidebar deletes that pane's DOM, coach included.** The first version mounted a new coach, losing typed text and orphaning a running demo. The coach now keeps its element and re-attaches that same element. The audits check this mid-demo: the step still finishes, the coach is mounted exactly once, and the floating drag position is cleared on re-dock.

## Choosing a lesson and a mode

A new run opens the coach on a picker, and the learner chooses the lesson first. **Choose a lesson** lists the run's lessons by part, each with its number and number of steps, with the finished ones ticked and the part of the first unfinished lesson expanded. No lesson is chosen for the learner, and there are no mode cards until one is. Choosing a lesson closes the list and puts the lesson on one line at the top, with its number and part ("Lesson 1 · Whole game", then "Data visualization"), and **Change**, which opens the list again. Below it, **How do you want to work through it?** offers three mode cards. Everything stays in view without scrolling in the docked coach at 1366×768, the list as well as the mode cards. A one-lesson run (`./run.sh up 03-data-transformation`) shows only that lesson, with the mode cards straight away. Until the learner picks a mode, the coach does nothing in RStudio. The header shows the chosen mode, and **Change lesson or mode** (**Change mode** in a one-lesson run) returns to the picker at any time, with the lesson still chosen. The article lessons had two compact lesson cards instead of the list (also with none chosen at first). Until 24 November 2026 a new tab opened with the first unfinished lesson already chosen and its mode cards showing; the user asked for the learner to choose the lesson as well.

The lessons live in one RStudio project, so their scripts, from `01-data-visualization.R` to `29-quarto-formats.R`, sit side by side in the Files pane, with the lessons' data in `data/`, and switching lesson needs no new run. Starting a different lesson restarts R, so one lesson's packages and objects don't carry into the next.

| Mode | Who works RStudio | When results are shown |
| --- | --- | --- |
| **Demonstration** | The coach, with its pointer and typing (below). | After each step, with an explanation. |
| **Guided** | The learner, one step at a time. **Hint** gives up to three hints per task: where to type it and how to run it (highlighting the Source pane), how it starts (`ggplot(…)`), then the whole statement. **Show me** makes the coach type and run that one statement, exactly as in Demonstration. | Each task is ticked as soon as R's record shows its result; the step's explanation follows. An R error is quoted back, and a statement that runs but gives a different result gets a nudge. A debrief at the end counts steps done without help, hints read and tasks the coach showed. |
| **Solo** | The learner, with the whole task list. One hint per task (how it starts), counted in the results. | Only when the learner presses **Check my work**: each task ticked or not, and hints used. When every task is done, the steps' explanations are offered. |

### Every choice starts afresh

Choosing a mode on the picker starts that lesson from scratch, whatever ran before, in any mode of either lesson. Before the mode opens, the coach puts the lesson's script back to the step headings it was provisioned with (`provision.py` publishes that text in `steps.json` as `starter`). It saves the script and clears its undo history, so Ctrl+Z can't bring the old code back. Then it empties R the way a learner would, with the brooms on the Environment pane (**Clear objects**, hidden objects included) and the Plots pane (**Clear all Plots**). It confirms each in RStudio's own dialog, and uses each only when there is something to clear. Last, it clears the Console. Demonstration's **Start over** does the same, then runs step 1 by itself, so every line is typed again. A reset takes under a second. The panel says what is happening and offers nothing to press until it finishes. If part of it fails (say the learner deleted the script), the mode still opens, with a red note saying what wasn't reset.

The first version kept everything when the mode changed. A learner who watched step 1 of the demonstration and then chose Guided found `plot(5, 5)` already written under step 1's heading, and its chart already in the Plots pane.

The reset first used **Restart R**, which would also unload packages (these lessons load none). In a session's first half-minute, though, RStudio holds a restart back: one asked for 7 s after sign-in took 23.6 s, and one at 5 s took 12.6 s, against 1–2 s once the session was 40 s old. The session was idle meanwhile, with no outbound connections, so the cause is inside RStudio. That window is exactly when a learner picks their first mode, and the first audit run with a restart failed 16 of 19 probes on it. While R restarts, RStudio also drops requests to open or save a file and to clear the Console. With the brooms instead, a reset that cleared objects and a chart took 0.8 s, 15 s into a session.

Two details of RStudio's controls matter here. **Clear all Plots** does nothing unless the Plots tab is showing, so the coach shows it first. The dialogs' Yes buttons have no fixed id (`rstudio_dlg_ok` in one, `rstudio_dlg_yes` in the other), so the coach finds the dialog by its title and the button by its label.

The chosen lesson, its mode and the mode's progress are kept per run in `sessionStorage`, so a reload reopens them where they were, without a reset. Choosing a mode forgets the progress of every other mode and lesson, because it no longer matches the script or R. Pressing **Change lesson or mode** may be a slip, so the picker then offers **Back to Guided** (or whichever mode was open, with the lesson's name when the run has two). This returns to the mode just left, as it was. Back isn't offered after **Stop**.

### How Guided and Solo recognise the learner's work

The coach checks what ran in R, not keystrokes, so the Console and the script (Ctrl+Enter or Run) both work.

- **A task counts when R's record holds its reference result** (see the evidence table under "The lesson format, version 2", in Phase 1). R fingerprints each top-level call's value, and the coach compares that with the bake's fingerprint. So a statement counts however it is written: `week = read_csv('data/trips-week.csv')` counts for `week <- read_csv("data/trips-week.csv")`, and `arrange(trips, desc(duration_min))` for `trips |> arrange(desc(duration_min))`. A chart counts when the plot built has the reference's fingerprint and the Plots pane has a new chart. `library("tidyverse")` counts once the tidyverse is attached, and a file task once the file is written.
- **A statement that teaches Ctrl+Shift+M** also needs the shortcut pressed since the mode began; Guided says so when the result is right without it.
- **Only work done in this mode counts.** The coach marks R's session and its last call when the mode is chosen, and counts only later calls. After a reload, it keeps that mark, so the Console's earlier output doesn't count. Each call counts for one task only, so printing `trips` doesn't also tick the task that read it in.
- The page holds fingerprints, not the answers' values. The article lessons, whose code and output were public, were checked against the Console's text instead.

### Audit results (`tests/practice_modes.cjs`)

The audit works as a learner: it clicks the coach's buttons and types into the Console and Source pane with the keyboard. It reads the coach's state only to know when to look. It runs lesson 1 at 1440×900, lesson 3 at 1366×768, and the default run of all 29 lessons at 1366×768.

| Probe | Result |
| --- | --- |
| A new run opens on Demonstration, Guided and Solo, all in view in the docked coach, and the coach clicks and types nothing until one is chosen (1440×900 and 1366×768) | Pass. Lowest card ends at 554 px in both. |
| Guided: `library(tidyvers)` gets R's error quoted back; `library(janitor)` runs but gets a nudge; neither counts | Pass |
| Guided: `library("tidyverse")`, with quotes, counts once R has the tidyverse attached, then the step's explanation appears | Pass |
| Guided: `week = read_csv('data/trips-week.csv')`, typed below step 2's heading and run with Ctrl+Enter, counts for `week <- read_csv("data/trips-week.csv")` | Pass |
| Guided: three hints arrive one per click; **Show me** types and runs `glimpse(week)` with the pointer and the spotlight, saves it under the step heading, and is recorded as shown; nothing stays dimmed afterwards | Pass. 2 clicks on the pointer and in the spotlight, 13 keystrokes for 13 characters. |
| Guided: a histogram in step 3 gets a nudge and doesn't count; the scatter plot written without argument names counts once its chart has loaded | Pass |
| Guided: reload mid-step (step 5, with its first task done) keeps the mode and progress | Pass |
| Guided: finishing all 9 steps shows the debrief | Pass. 8 of 9 steps without help, 3 hints read, 1 task shown. |
| Solo: **Change mode** returns to the picker, which offers **Back to Guided**. Solo starts afresh: `01-data-visualization.R` holds only its headings (saved, with no undo history), and Guided's objects, charts and Console lines are gone. Solo lists all 14 tasks; a statement that counts is recorded but not shown before **Check my work** | Pass. Reset in 0.54 s. |
| Solo: after a reload, Solo keeps the statement it saw, and nothing run in Guided counts | Pass |
| Solo: the check shows 1 of 14; a hint is counted; after the other 13 statements, the result changes only when the learner checks again, then shows all 14 and the explanations | Pass |
| Solo (lesson 3): `trips = read_csv('data/trips.csv', show_col_types = FALSE)` counts for `<-`, and `arrange(trips, desc(duration_min))` for `trips \|> arrange(desc(duration_min))`; `arrange(trips, duration_min)` gives a different result and doesn't count | Pass. 3 of 14. |
| Guided (lesson 3): starts afresh after Solo (`trips` is gone, the script holds only its headings). After the learner removes `trips`, **Show me** quotes R's error and doesn't count step 4's statement. Once `trips` is read again, **Show me** runs the statement already typed, with no keystrokes | Pass |
| The default run (all 29 lessons, 1366×768): "Lesson 1 · Whole game", "Data visualization" on one line above three mode cards, all in view. **Change** lists the lessons under their six parts, Whole game expanded, each with its number of steps | Pass |
| The default run: Data transformation, then Solo, opens that lesson (14 tasks) and counts `library(tidyverse)` | Pass |
| The default run: **Change lesson or mode** remembers Data transformation; Data visualization in Demonstration opens `01-data-visualization.R` and finishes step 1 with the pointer and typing | Pass. 2 clicks on the pointer, 18 keystrokes. |
| The default run: reload reopens the Demonstration at step 2. **Change lesson or mode** offers **Back to Demonstration: Data visualization**, which returns to step 2 with nothing reset | Pass |
| The default run, the reported case: Demonstration step 1, then Guided. `library(tidyverse)` is gone from the script on screen and on disk, the Console, Environment and Plots are empty, and Guided starts at step 1 with nothing done. The learner's own statement then counts | Pass. Reset in 0.13 s. |
| The default run: Data transformation Solo starts afresh too, and what Solo saw earlier no longer counts | Pass. 0 of 14. |

20/20 passed on 20 November 2026 with the four pilots as the default run, and again on 21 November with all 29 lessons, each time with no warnings or page errors. On the article lessons, the earlier version of this audit passed 19/19; its table is in the README of commit `072e01c`.

## Demonstration mode

What each lesson's steps do is in the table under "Phase 2: the four pilot lessons". The retired article lessons followed a [dev.to article](https://dev.to/up_min_sparcs/statistical-analysis-using-rstudio-3h7c), whose code they transcribed from its screenshots.

### How a step runs

The coach works RStudio the way a learner would, so the learner can watch the whole workflow.

- **The panel.** Before the first step, the coach introduces the lesson and lists its steps. Once the learner presses **Start demonstration** (or **Next**), that overview gives way to the current step alone: its heading, then one "now" line saying what the coach is doing, then, once RStudio shows the result, the step's explanation. Each line of code is narrated by what it is for, from the statement's `purpose` in `scenario.json`: "Writing code to plot each trip's duration against its distance". `provision.py` refuses a Demonstration or Guided lesson with a line that has no `purpose`, because Show me narrates the same way. After a reload, the overview comes back with the steps done so far ticked, until the learner presses **Next**.
- **The pointer.** An amber mouse pointer, labelled as the coach's in the card during the first step, starts at the coach button the learner pressed. It glides along a slight curve, easing in and out, to each thing the coach clicks. Every synthetic click carries the pointer's coordinates, so it lands where the learner sees it. The pointer fades out while the coach types, as most systems hide the mouse during typing, and at the end of each step. With `prefers-reduced-motion`, it jumps instead of gliding.
- **The typing.** Code is typed through Ace's `insert`, one character at a time, at about 70 ms per key (ELK Guide's rate). The gap varies from 0.6× to 1.4×, with a little extra after a space and a short pause before a `#` comment. RStudio's auto-pairing runs as it does for a learner: `(` also inserts `)`, and the `)` typed later steps over it. Every statement of the four lessons comes out exact, multi-line ones included (see "The coach" under Phase 1), and a statement that teaches Ctrl+Shift+M gets each pipe from the shortcut. `localStorage.rsCoachTypeMs` changes the rate.
- **The spotlight.** While the coach works, RStudio is dimmed except for what it acts on, and the coach panel stays bright so its narration can be read. This is ELK Guide's spotlight: an amber ring arrives wide, closes in on its target and pulses once, and each new target replays that entrance. The spotlight follows its target every frame:
  - the file in Files, the **Run** and **Save** buttons;
  - the step's heading plus the line being typed, across the editor;
  - while R runs, the Console or Plots pane, then exactly what R printed (the echoed command and its output), the chart, or, after an assignment, the new variable's row in Environment.

  The dimming is a fixed layer cut by a `clip-path` with two holes, the spotlight and the coach panel, because a single `box-shadow` (ELK's way) would dim the coach too. With `prefers-reduced-motion`, the rings fade in instead.
- **The pace: the learner's turn to read.** The narration is a "now" line in the card, amber-edged and fading in on each change, in plain words (these examples are from the article lessons): "Writing code to find the mean (average) temperature", "Pressing Run to send this line to the Console (Ctrl+Enter does the same)", "R printed `[1] 77.88235` in the Console", "`slices` now appears in the Environment pane (an assignment prints nothing in the Console)". As with ELK Guide's reading beats, each line then waits for the learner. Before a click (opening the script, **Run**, **Save**), the line announces it, and the countdown runs with the spotlight already on the control. After typing or a result, the countdown runs with the code or the result in the spotlight. Each explanation except the last waits the same way, and the next step then starts by itself. The wait is 5 s for up to 60 characters, plus 3 s each time the text doubles in length (`rsCoachReadMinMs`, `rsCoachReadStepMs`): 5 s for "Saving graphical-tools.R", 5.8 s for the Run line, 6.9 s for the longest line, and 10–12.6 s for the explanations. The green button counts the wait down ("Advance · 5s", "Next: step 3 · 12s") while a blue bar fills under the card; while the coach acts, the bar sweeps amber, like ELK's. **Advance** ends the wait on screen at once. Pressed while the coach is still acting, it reads "Advancing when ready…" and ends the next wait as soon as that starts, but never an explanation's. R's own run isn't a turn to read: "Pressing Run…" stays up until R answers, and only a line still running after 1.5 s says so. Show me in Guided keeps its own pace with no countdown: 0.7 s before each click (`rsCoachLeadMs`) and 2.4 s on each result (`rsCoachDwellMs`). All these settings are `localStorage` numbers in milliseconds, like `rsCoachTypeMs`.

1. If the script isn't already the active Source tab, the pointer opens it from the Files pane.
2. For each line, the coach looks below the step's `# Step N.` heading, up to the next heading.
   - If the line isn't there, the pointer clicks at the end of the step's last non-blank line (at first, the heading itself). The coach presses Enter and types the line.
   - If the line is already there (typed in an earlier attempt at the step, or by the learner, which is common for Show me in Guided), the pointer clicks at its start, and the coach runs it as it is, without typing it twice. Clicking at the end of one of the article's long commented lines scrolled the editor sideways and hid the code.
3. The pointer presses **Run** with no selection, which sends the cursor's line, comment included. RStudio treats a comment directly above a statement as part of it, so the first line of each step also echoes its heading in the Console. That is also what a learner would see pressing Ctrl+Enter there. GWT ignores a bare `.click()`, so presses are a synthetic pointer and mouse down/up/click sequence.
4. The coach waits until the Console echoes the statement and R's record holds the reference result: the bake's fingerprint, package or file. A chart must also show a new, fully loaded `/graphics/<id>.png` in the Plots pane. The article lessons compared the Console's output with the reference's, token by token, instead.
5. The spotlight then moves to the result and holds there. The explanation quotes the bake's values; the article lessons read theirs from the Console's text.
6. After the last line, the pointer presses **Save** if the script has unsaved changes, and the coach waits for the tab's unsaved marker to clear. The dimming then lifts, an evidence ring (ELK's, without dimming) stays on what the step printed or drew, and the explanation appears, filled with the captured values. The ring stays until the next step starts: when the learner presses **Next**, or when the explanation's countdown ends.

**Failures stop visibly.** The step turns red, the card says why, and **Try this step again** and **Start over** appear. Tested cases:

- The script lost a step's heading, so the coach can't tell where the code goes. Message: `01-data-visualization.R no longer has the line # Step 1. Setup: library(tidyverse), so the coach can't tell where step 1 goes…`. The coach types and runs nothing.
- R raised an error. Message: `R reported: Error: object 'trips' not found`, shown immediately. RStudio prints errors after its inline "Show Traceback / Rerun with Debug" links, so the check looks for them there too.
- No echo, no chart, or different output within 20 s. The message names which of these happened.

Handled but not audited: if the learner moves the cursor while the coach is typing, the coach puts it back. If the typed line still doesn't match, for example because the learner typed into it, the step stops with `Line 8 of <script> reads … instead of …`.

Progress is kept per run in `sessionStorage`, so a reload resumes at the next step. **Start over** starts afresh (see [Every choice starts afresh](#every-choice-starts-afresh)) and types every line again. **Stop** ends the demo, and no further RStudio actions happen after it, keystrokes included. A line stopped part-way stays as typed, unsaved. The coach looks up RStudio elements again after every pause, because RStudio re-renders the Files list and toolbar when files change. The first version clicked a stale Files link and the open silently failed.

### Audit results (`tests/demo_mode.cjs`)

Each run starts by choosing **Demonstration** on the mode picker; after a reload the coach reopens in it. Everything runs at the coach's normal pace: lesson 1's first four steps at 1440×900, then all of lesson 3 at 1366×768.

| Probe | Result |
| --- | --- |
| Choosing Demonstration starts afresh: the script is open with only its headings, and the Console, Environment and Plots are empty. Coach docks in the sidebar and covers no other pane (1440×900 and 1366×768) | Pass. Reset in 0.16 s. |
| The learner deletes step 1's heading in the editor, so step 1 stops with a clear message before typing or running anything | Pass |
| After the learner undoes the edit, saves and closes the tab, **Try this step again** reopens the script from Files, types `library(tidyverse)` and passes | Pass |
| Lesson 1, steps 2–3: typed, run, and explained only once R's record holds the bake's results, and for step 3 a new chart has loaded. Nothing is pressed after step 2, so its explanation counts down ("Next: step 3 · 14s") and step 3 starts by itself | Pass. Step 3 started 13.4 s after step 2's explanation appeared (reading time 13.3 s). 48.9 s and 50.8 s per step. |
| Hiding and re-showing the sidebar while step 4, a three-line ggplot, is typed and run | Pass. Same coach, 110 keystrokes for 110 characters, step completes, re-docked geometry. |
| Reload keeps progress ("Next: step 5"). **Start over** puts the script back to its headings and clears the objects, charts and Console, then starts typing step 1 by itself. **Stop** after 3 characters halts the typing and RStudio | Pass. Reset in 0.55 s. The line stayed `lib` for 4 s, with no further actions or Console output, and the pointer, dimming and rings gone. |
| Lesson 3, steps 1–2 at 1366×768, explained with the bake's values. **Advance** is pressed on the first countdown | Pass (`n_trips=149,747`). The first countdown started at 5 s, and Advance moved on to "Pressing Run…" 0.06 s later. 22.6 s and 28.9 s. |
| Reload resumes at step 3 | Pass |
| The learner runs `rm(trips)`, so step 3 stops with R's error | Pass |
| **Start over** puts the script back to its headings (step 3's statement is gone), types all 8 steps again, with step 3's pipe typed by Ctrl+Shift+M, and finishes | Pass. Reset in 0.11 s. 735 keystrokes for 735 characters; steps 2–8 took 29 to 91 s. All 16 quoted values match the bake, `real_top_trips=2` among them. |
| The saved script holds all 14 statements once each, under their headings, with nothing unsaved | Pass |

12/12 passed on 20 November 2026, with no warnings or page errors, in 11.6 minutes of probes. On the article lessons, the earlier version of this audit passed 12/12; its table is in the README of commit `072e01c`.

At every explanation, the audit takes its own snapshot of the Console and Plots pane, and reads R's record from `/coach/api/evidence`. Independently of the coach's checks, it requires the Console to have echoed each statement with no error after it, R's record to hold the bake's fingerprint, package or file for each statement, and the explanation to quote the bake's values. Each finished step is also checked for:

- **The pointer:** every click the coach makes (a synthetic mousedown) lands within 2 px of the pointer's tip while the pointer is visible, and the pointer took at least 5 animation frames to get there.
- **The typing:** the edits Ace applied number no more than the characters typed and at least 70% of them, none is more than 2 characters, and the median gap is 35–250 ms. Measured: 62–86 ms, with one insert per character in every step. Spaces aren't counted, because RStudio indents each new line and the coach sets that indentation in one edit. A pipe typed with Ctrl+Shift+M arrives as RStudio's ` |> ` and isn't counted either. A step whose code was already in the script must record no keystrokes.
- **The save:** the script on disk holds the step's statements directly below its heading, in order, each exactly once, and no tab shows an unsaved marker.
- **The panel and the reading time** (steps run by `runSteps`): every line the card narrated, from Start to the explanation, appeared with the lesson overview hidden. For each statement, the card said "Writing code to <purpose>", or "The code to <purpose> is already in the script…" for one run again. Every line stayed up for at least its reading time, worked out independently by the audit (5 s up to 60 characters, plus 3 s per doubling), except a line the audit pressed **Advance** on and R's "still running" note. Before the first Start, and after a reload, the overview is shown instead.
- **The spotlight:** every coach click happened with RStudio dimmed and the click point inside the spotlight ring, and every typed key with the caret's line inside it. Two things aren't checked, because Ace reports each edit before the screen catches up: the caret's x, since Ace scrolls sideways after the edit to follow the caret along a long line (the first version of this check failed on exactly that, at x −86), and indentation, which the coach sets in the same instant as it presses Enter. When the explanation appears, the dimming has lifted and an evidence ring at least 15 px tall sits on the Console (or, for a chart step, the Plots pane). A failed step also leaves nothing dimmed.
- **Found by the port:** a statement's next line could start just below the editor's visible part, and the coach typed its first key there before Ace scrolled to it, so for a moment the learner couldn't see it (the check caught it 3 px below the ring). The coach now scrolls each new line into view before typing on it.

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
   - the Run and Save buttons' title texts (`Run the current line or selection…`, `Save current document…`);
   - the Ace editor's `env.editor`, and its `insert`, `moveCursorTo`, `renderer.textToScreenCoordinates` and `renderer.scrollCursorIntoView`;
   - RStudio's auto-pairing giving exact text when typed through `insert` (checked for all 15 scenario lines);
   - Run with no selection sending the cursor's whole line, including a trailing comment;
   - the plot image inside the Plots iframe;
   - the Console output as plain text nodes in order (the spotlight on what R printed maps character positions to a DOM range), and the Environment pane showing each variable's name in its own cell;
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

## Phase 0 spikes for the new lessons (20 November 2026)

The new lessons follow `plan-docs/R4DS_CHAPTERS_PLAN.md`. Its Phase 0 has seven spikes; this section is their decision record. Each spike is a script in `spikes/phase0/` and writes to `results/spikes/`. They ran against `./run.sh up statistical-tools` on the candidate image below. That lesson was retired on 20 November, so rerunning a spike means pointing its `provision()` call at another lesson, such as `03-data-transformation`; S5 and S7 also look for the project by that name.

| Spike | Result | Decision |
| --- | --- | --- |
| **S1** Multi-line typing (`s1_multiline.cjs`) | Four statements typed one key at a time came out exact, both through Ace's `editor.insert` (RStudio's auto-indent and auto-pairing act) and through `session.insert` (they don't): a `\|>` pipeline, a ggplot `+` chain with arguments across lines, a `tribble` and a function. **Run** on a statement's first line, with no selection, ran the whole statement, and the coach's Console parser read the multi-line echo. | Keep typing through `editor.insert`, so learners see RStudio's auto-pairing. When Enter falls between a pair, RStudio moves the closer down a line; the coach steps past it, as a learner presses ↓, and sets each line's indentation to the reference's. `execution_behavior` is set to `statement` explicitly. |
| **S2** Evidence channel (`s2_evidence.cjs`, `runtime/evidence.R`) | All 17 statements gave the same fingerprint live in RStudio as in a throwaway, network-less `Rscript` (the bake): a `read_csv()` result, grouped tibbles, dates, plots, `lm()`, assignments, 150,000-row tables. Equivalent code matched: a plot with positional arguments and one with named arguments and the colour in the layer; a tibble, a grouped tibble and a `data.frame`. `summarize(.by =)` and `group_by() \|> summarize()` order rows differently, so they match only on the order-free fingerprint. Enter to evidence: 85–390 ms for tables, 0.8–1.7 s for charts (mostly R drawing them). Fingerprinting took 44–48 ms for 150,000 rows and 1.1 s for `flights` (336,776 × 19), after the prompt has returned. An anonymous request got 401. The Console showed nothing extra (the loess message once). | Adopt it. Fingerprints are computed after the prompt returns (`later`), not in the task callback. Phase 1 trims the cost on large tables (an order-free fingerprint only when a step asks for one). |
| **S3** Console width (in `s2_evidence.cjs`) | The docked Console at 1366×768 is 68 characters wide. `flights` printed 7 of its 19 columns there, against all 19 at width 200. | Confirms that comparing printed tokens can't check tibbles. Value fingerprints replace it. |
| **S4** IDE actions (`s4_ide_actions.cjs`) | 13/13 with synthetic events, as the coach acts: Code › Reformat Document with Air (same as `air format`); Ctrl+Shift+M and Alt+- sent as synthetic keys inserted `\|>` and `<-`; a capture listener sees a learner press Alt+-; ticking and unticking **Restore .RData** in Global Options showed in the evidence within 0.3–1.1 s; `View()` opened tabs for a data frame and a list; `?mean` in Help; reprex rendered in the Viewer; File › New File › Quarto Document… created `Untitled1`; **Render** wrote `spike.html` in 7.4 s and the Viewer showed it; Visual and back left the document unchanged; Session › Restart R. | All usable. Details below. |
| **S5** Lesson switch (`s5_s7_session.cjs`) | Restart R asked for 3–4 s after sign-in took 28–29 s; later restarts took 2.0–3.2 s, including one straight after that first one. Straight after a restart, opening a script took 0.5 s, saving it 1.0 s and clearing the Console 1.1 s. Attaching duckplyr prints "Overwriting dplyr methods with duckplyr methods"; Restart R unloads it. | Switching lesson restarts R, then resets the script as today. The hold-back is about the server session's first half-minute, not the R process's age, so only a switch in that window waits. |
| **S6** Image and data (`s6/`) | **Base:** `rocker/tidyverse:4.6.2` plus nine packages from a dated Posit Package Manager snapshot (`resolute/2026-11-19`; the base is Ubuntu 26.04) and Air: 3,200 MB unpacked, 1,236 MB compressed. `rocker/rstudio:4.6.2` with only the lessons' packages is 2,921 MB and 1,117 MB, but it needed two system libraries that `rocker/tidyverse` brings (libuv for `fs`, so `gt` and reprex; libwebpmux for `ragg`), found only by loading every package. **Offline:** all 27 lesson packages load, Shiny included. Quarto 1.10.19 rendered HTML (`gt`, `reactable`, ggplot2) in 8.5 s, Word 2.8 s, PDF through Typst 2.8 s, revealjs 3.0 s, a dashboard 6.5 s, a two-page website 6.1 s and `quarto::quarto_render()` 4.6 s. Word refuses a document with an htmlwidget. **Trip archive** (a rough generator, `s6/archive.R`): 2,000,000 trips over 2021–2025, generated in 8.1 s, written as Parquet partitioned by year and month in 1.9 s (60 files, 36 MB). 2025 as CSV is 400,000 rows and 36.5 MB. A one-year query took 0.08 s. Peak R memory was 1.9 GB, at build time. **The existing audits** on this image: guided 21/21 (AI lockout included), demonstration 12/12 in 9.9 min, practice modes 19/19, with no warnings or page errors. **trivy:** the same 3 critical and 50 high findings as `rocker/rstudio:4.6.2`. All are in `linux-libc-dev` (kernel headers, no fix; a container uses the host's kernel), except Go's `stdlib` in `/usr/bin/pebble` (fixed in 1.27.4 upstream). The tidyverse base adds 52 medium and 6 low. | Keep `rocker/tidyverse`. Its ~120 MB is worth not tracking system libraries ourselves; the `rocker/rstudio` alternative stays the fallback if iximiuz start-up suffers. The archive and one year of CSV add about 72 MB. The lab is amd64 only, like iximiuz Labs, so arm64 isn't built or tested. |
| **S7** Lesson 6's project (`s5_s7_session.cjs`) | File › New Project… › New Directory › New Project, named `practice`, then **Create Project**: RStudio reloaded the page in 2.8–3.2 s into `~/practice`, with the coach mounted once. The project menu (`#rstudio_project_menubutton_toolbar`) took the learner back to the lab's project. | Lesson 6 can do it for real, as its last step. |

### What the spikes changed

- **duckdb 2 stopped R at a question.** The first duckplyr call in RStudio asked `duckdb: create /home/rstudio/.duckdb? (Yes/no/cancel)` in the Console and waited, so R stayed busy and New Project then asked whether to quit a busy session. The image now creates `~/.duckdb`, after which there is no question and no message. The build-time generator must use `duckdb(shared_home = FALSE)`.
- **RStudio has Air built in.** `use_air_formatter` uses an `air` on the `PATH` before downloading one from GitHub, so the image installs Air 0.13.0 (checked against the release's SHA-256) and the preferences turn it on. Lesson 4 uses Code › Reformat Document.
- **The native pipe is already the default** (`insert_native_pipe_operator`), so lesson 3 teaches Ctrl+Shift+M without an options step.
- **Rendered documents open in the Viewer.** RStudio's default (`rmd_viewer_type: window`) opens a new browser window, which iximiuz's frame would block. The preferences set `rmd_viewer_type` and `shiny_viewer_type` to `pane`.
- **RStudio leaves a preference out of `rstudio-prefs.json` while it has its default value**, so the evidence reports each one's effective value from RStudio's preference schema.
- **Submenus open on a lone `click` event.** The coach's full press (mousedown, then click) opens File › New File and closes it again. The main toolbar's New File button takes the full press.
- **The visual editor asks once**, in a "Switch to Visual Mode" dialog, that visual mode "will re-write your markdown source code using Pandoc's default markdown writer". The answer is RStudio user state (`visual_mode_confirmed`), not a preference. Lesson 28 shows the dialog and narrates it.
- **reprex on RStudio Server** renders into the Viewer and opens the Markdown file for copying. It also prints `[WARNING] Deprecated: --highlight-style` from the bundled Pandoc, which lesson 8 should explain or avoid.
- **A learner typing multi-line code** ends up with a doubled closer: RStudio moves the auto-inserted `)` or `}` down when Enter is pressed between a pair, and the learner's own closer adds a second. Guided's hints should say so.

## Phase 1: engine and world (20 November 2026)

Phase 1 of `plan-docs/R4DS_CHAPTERS_PLAN.md` builds everything the 29 new lessons need before any of them is written: their data, their format, the bake that produces their reference results, and the coach changes. Two audit fixtures stand in for the lessons until Phase 2: `engine-check` has one statement of each kind, and `engine-actions` has one of each IDE action. The article lessons still run as before.

### Larkhaven Bikes, the lessons' city

`content/world/generate.R` generates a made-up lakeside city's bike-share scheme from one seed, in 21 seconds during the image build. Two runs write byte-identical files, the archive included. `check.R` then confirms every feature a lesson relies on (56 checks), and the build fails if one is missing.

| File | Rows | Put there for lessons |
| --- | --- | --- |
| `trips.csv` | 149,747 trips in 2025 | Weekday rush hours for members, weekend afternoons for casual riders, a summer peak, rain and cold keeping riders away, faster e-bikes. Zero and negative durations, multi-day trips by lost bikes, missing end stations and distances, two trips across each daylight-saving change, two stations with no trips. |
| `archive/` | 509,910 trips, 2021 to 2025, Parquet by year and month | Its 2025 equals `trips.csv`. |
| `stations.csv` | 81 | One duplicated ID, two renamed stations, names in capitals and lower case, "St." and "St", "&" and "and", a double space, curly and straight apostrophes. |
| `weather.csv` | 8,711 hours | Three sensor gaps, `-99` readings, no 2 am on 9 March and two 1 ams on 2 November. |
| `bikes.csv`, `fares.csv` | 690, 12 | Bike IDs with structure, a dozen in an older format; fare periods, the current one open-ended. |
| `survey.csv` | 1,500 | Satisfaction and agreement scales as text, five multi-select columns, comments with accents, emoji, capitals and promo codes, whose tone follows each rider's satisfaction. |
| `exports/` | 12 monthly files | A title line above the header, column names written for people, `n/a`, `-` and blanks for missing values, units inside numbers (`2.41 km`, `38%`), US dates, one dock-fault count per file that isn't a number, old names before a rename. |
| `station-months.csv`, `station-periods.csv`, `station-riders.csv` | about 80 each | Wide tables for tidying: one column per month; two variables in each column name; a `.value` layout. |
| `maintenance.xlsx` | 4 sheets | A summary whose Depot column is filled in once per block; depot sheets with title rows, dates as Excel serial numbers, notes typed into a number column and a total row. |
| `feed/` | 2 JSON files | GBFS 3.0's shape: names as lists of translations, vehicle counts as lists, fields only some stations have. |
| `site/` | 4 pages | Station cards, some with a note; a fares table; news. |

Changes from the plan, and why:

- **Time zone `America/Toronto`, not `America/Chicago`.** The daylight-saving dates are the same, and a Canadian city fits the data's km, °C and spelling; an American one would use miles and °F.
- **The archive is every trip since the scheme opened, about half a million, not 2 million.** Its 2025 is exactly `trips.csv`, so the two never disagree. It still makes the point: 9 MB of Parquet against 13.6 MB of CSV for one year.
- **The big files live only in the image** (`/opt/lab/world`, 23 MB); each project's `data/` has copies of the small files and links to `trips.csv` and `archive/`. The small files are committed (724 KB) and the build fails if the image would generate different ones.
- **`maintenance.xlsx` is written by hand** as SpreadsheetML: writexl stamps each workbook with the time, so its bytes change every run.
- **No trailing space in a station name.** readr trims it when reading, so no lesson could find it.

### The lesson format, version 2

A lesson with `"version": 2` is checked strictly: it is in the collection, starts with a Setup step of `library()` calls, has 5 to 8 more steps of 1 to 3 statements, and every statement is formatted as Air formats it. A statement's `code` may span lines. `alternatives` are equivalent code the bake proves gives the same value and the audits type. Its `evidence` says how it is checked:

| Evidence | Counts when (Guided and Solo) |
| --- | --- |
| `value` | A call since the mode began returned a value with the reference fingerprint (`"order": "any"`: ignoring row order). |
| `assign` | A call assigned the reference name a value with the reference fingerprint. |
| `ggplot` | A printed ggplot has the reference fingerprint. |
| `attached` | A `library()` call named the package, and it is attached. |
| `file` | The file changed since the mode began. |
| `pattern`, `error` | The Console shows output matching a regular expression (`today()`), or an error matching one (a statement meant to fail). |
| `ide` | RStudio's state holds: a preference, R restarted, a Source tab, the editor's mode or text, a shortcut pressed. |

A call counts for one statement only, so printing `trips` doesn't also tick the step that read it in. IDE state counts only once it has been seen not to hold, so a setting already as the step wants it doesn't tick by itself. `"warning"` declares an expected warning, `"values"` R expressions whose results the explanation quotes, and the actions are `menu`, `option`, `format-document`, `new-file`, `open-file`, `render`, `editor-mode` and `shortcut`. `open-file` wasn't in the plan; the actions need it.

### The bake

`tools/bake.py` runs each lesson twice in throwaway containers and fails on: an error the statement doesn't expect, any warning it doesn't declare (deprecations included), a chart where none is expected or the reverse, missing evidence (an assignment that assigns nothing, a file not written), an alternative with a different value, code Air would format differently, or any difference between the two runs. It records fingerprints with the same `evidence.R` the live session uses. The fixture `engine-check` bakes in 5.5 seconds. Its first bakes caught a long `summarize()` line Air wraps, and a ggplot warning about three lost-bike trips with no distance, which `ggsave()` repeats.

The stamp hashes the lesson, the world, `packages.lock`, `evidence.R`, `bake.R` and the runtime Dockerfile, not the image's digest as the plan had it: rebuilding an image changes its ID even when nothing it computes changes, so iximiuz would bake at every boot. The package lock pins what the digest would have. The article lessons are baked too, so `runtime/reference.R` and provisioning's per-start reference runs are gone; their values are unchanged.

### The coach

- **Multi-line statements.** The coach types each line one key at a time with RStudio's behaviour on, and sets each line's indentation to the reference's. When Enter falls between brackets, RStudio moves the closing one down a line; when the reference's next line starts with it, the coach steps down onto it instead of pressing Enter, and types over closers RStudio added. A 7-line `summarize()` and a 2-line ggplot are typed exactly. It then clicks the statement's first line and presses Run. Hints show the first line and how the second starts, and warn learners that RStudio moves the closer down for them.
- **Checks from R's evidence** in all three modes (table above). Demonstration waits for the reference fingerprint before explaining, and quotes the bake's values.
- **IDE actions,** with the pointer, as S4 proved them. Things found on the way: some option labels end in a colon; a Source tab's unsaved `*` is always in its markup and only hidden by CSS; RStudio's New Quarto Document dialog remembers the visual editor, so the coach unticks it (the Quarto lessons type in the source editor); a submenu opens on a lone click.
- **A fresh start** also restarts R when the lesson changes to or from a new lesson (2.6 seconds in the audit), puts back settings the lesson asks the learner to change, and closes documents the lesson's actions open, discarding their changes.
- **The picker for the new lessons** shows the chosen lesson on one line above the mode cards; Change opens the lessons by part, each with its step count and a tick once any mode is finished. A new tab opens on the first unfinished lesson, and a finished lesson offers "Next: lesson N". Progress is kept per run in localStorage. (From 24 November a new tab opens on the list instead, with no lesson chosen; see "Choosing a lesson and a mode".)
- **Files.** Before clicking a script below the fold of the Files pane, the coach scrolls the list to it.

### Audit results

One run each on the final code, with no warnings or page errors:

| Audit | Result | What it covers |
| --- | --- | --- |
| `lesson_modes.cjs engine-check` | 5/5 | Demonstration (fast pacing) types all 9 statements (17 lines) exactly and explains every step; Guided ticks all 11 tasks from the Console and real menu clicks, with Show me on the 7-line `summarize()`; Solo ticks all 11 using the three alternatives. |
| `lesson_modes.cjs engine-actions` | 5/5 | The same for 9 IDE actions: open file, Reformat Document with Air, Render, Visual and back, New Quarto Document, Ctrl+Shift+M. |
| `lesson_switch.cjs` | 6/6 | The one-line picker at 1366x768, Change by part, Files scrolled to the script, a tick and "Next: lesson 92" after finishing, Restart R on the switch (dplyr gone), reload and Back. |
| `practice_modes.cjs` (article lessons) | 19/19 | Unchanged from before Phase 1. |
| `demo_mode.cjs` (article lessons) | 12/12 | Unchanged. |
| `coach_in_ide.cjs` (`regional-revenue`) | 21/21 | Unchanged, AI-assistant lockout included. |

`tests/test_publish_rootfs_image.py` passes 9/9; it now skips tracked files deleted in the working tree (`runtime/reference.R`).

### Left for later phases

- **Quarto lessons' typing.** Steps that type into a `.qmd` rather than run in the Console are for pilot 28 to design; Render, the visual editor and New Quarto Document already work as actions.
- **State a fresh start doesn't reset yet:** the Help and Viewer panes and `View()` tabs (lessons 8 and 23), and lesson 6's new project.
- **The DuckDB database file for lesson 21** isn't generated yet.
- **Parallel audits** (plan §7) aren't built; the lesson audit runs one lesson at a time.
- **The iximiuz rootfs isn't republished.** It packs the committed tree, and nothing from Phase 1 is committed. (Republished as v5 on 22 November 2026, in Phase 4.)

Phase 2 did the Quarto lessons' typing, and Phase 3 the rest except the rootfs: the fresh start's resets, lesson 6's project, the database and parallel audits.

## Phase 2: the four pilot lessons (20 November 2026)

The first four lessons modelled on R for Data Science, one of each kind the plan names (§6): charts, pipelines, messy files, and a Quarto document. Each one bakes, with both runs identical, and passes `tests/lesson_modes.cjs` in all three modes. They were checked against the data and changed after review (see "Changes after the review"), and they are the template for Phase 3. `./run.sh up` starts all four in one project; `./run.sh up 01-data-visualization` (or `03-data-transformation`, `07-data-import`, `28-quarto`) starts one.

| Lesson | Steps after Setup | Statements | What the learner does |
| --- | --- | --- | --- |
| **1 Data visualization** | 8 | 14 | On one week of trips (4,540, from 2 to 8 June): `glimpse()`; a scatter plot of duration against distance; colour mapped to bike type, points set to `alpha = 0.3` and a straight line per bike type (mapping against setting, and global against layer aesthetics); labels and a viridis palette, then `ggsave()`; bar charts with `count` and `fill`; histograms of duration (`binwidth = 2`) and of start time (one bar per hour, which shows the rush hours and two rainy hours); a boxplot and density curves by member type; `facet_wrap()`. |
| **3 Data transformation** | 7 | 14 | On every 2025 trip (149,747): `filter()` with commas and `\|`, with the pipe typed by Ctrl+Shift+M; `arrange()` and `desc()`, which puts a 9-day lost bike first; `distinct()`; `mutate()` with `.before`; `select()` with `starts_with()`, `rename()`, `relocate()`; `count(sort = TRUE)`; `summarize()` with `.by`. The last step shows small groups misleading: the routes with the longest mean trip are lost bikes, 3 to 17 trips each, and the longest that end at a station have 1 or 2. `slice_max()` among routes with 50 or more gives a believable 26.6 minutes. |
| **7 Data import** | 7 | 16 | On the twelve monthly exports: a plain read that turns the title line into the only column; `skip`; `na` for `n/a`, `-` and blanks; `col_types` and `problems()`, which finds `2 (est.)` in an integer column; `clean_names()` and `parse_number()` on `2.35 km` and `51%`; all twelve files in one `read_csv()` with `id`; `jan` saved with `write_csv()` and read back, which turns its integer `Dock Faults` into a double, then the same with `write_rds()`, which keeps it; `tribble()`. |
| **28 Quarto** | 7 | 15 | A short report on the same week, in `28-quarto.qmd`: `library()` calls in its setup chunk; Render; a heading, a hidden chunk that reads the data and inline code; a chart chunk with `echo` and figure size options; a `gt()` table; author and date in the YAML header, each followed by Render; the visual editor and back; New Quarto Document. |

### What the pilots added

- **A week of complete trips in the world.** `trips-week.csv` holds 2 to 8 June 2025 without the faulty trips (no end dock, or a duration of zero or less), so lesson 1 charts every trip without lost bikes stretching the axes. The generator writes it, and `check.R` checks that it's the week's trips less the faulty ones.
- **The pipe shortcut.** A statement with `"keys": "Ctrl+Shift+M"` has each `|>` typed with the shortcut in Demonstration and Show me. RStudio types ` |> ` with one space each side; the coach trims the trailing space so the script still matches the reference. In Guided and Solo the statement counts once the learner has also pressed the shortcut since the mode began, and Guided says so when the result is right but the shortcut wasn't used. The coach keeps each shortcut's last press, because its 50-entry log could lose it behind many Ctrl+Enters. Every alternative of such a statement must use `|>` too.
- **Quarto lessons.** A lesson whose script is a `.qmd` gives the document's starting text (`"starter"`), and a step with code keeps its heading as an R comment inside a chunk. In a Quarto document the toolbar's Run is a menu, so the coach chooses Run › Run Selected Line(s), and a step's block ends at its chunk's closing fence. A new action, `type`, types text into the document after a line (`after`) or at its end, and `editor_match` evidence checks the document against a regular expression. The bake writes each statement under its heading and each typed text into the document, so its renders see what the coach typed. A spike first typed a heading, chunks, chunk options and inline code one key at a time: the text came out exact except for RStudio's indentation inside chunks, which the coach already corrects line by line.
- **Each version of a file counts once.** Before, once a file had changed, every later task checking it ticked; now each Render task needs its own render.
- **Show me credits only the task it shows.** Lesson 1's first Guided audit failed because the audit moved on and ran the next step's chart while Show me was still saving the script, and that chart was credited to the coach.

### Things found on the way

- **`problems()` prints the file's full path,** which differs between the bake and RStudio, so lesson 7 checks it with `pattern` evidence rather than a fingerprint.
- **Air lines up `tribble()` columns** (`~depot      , ~mechanics ,`), so lesson 7 types the table that way and says why.
- **RStudio renders a Quarto document with `quarto preview`** in a Background Jobs tab, which takes over the Console's place and re-renders whenever the document is saved. A Render task can therefore tick on a save. A failed render shows only in that tab; Guided gives no feedback for it yet.
- **The audit's learner now types a Quarto lesson's code into the document's chunk.** Typed into the Console, it attached the packages, but the report's own render then failed, as it would for a learner who did the same.
- **The runtime image and the build cache were deleted** at 21:00 on 20 November by a `docker image prune` on this machine, which also removed other projects' images. The image was rebuilt from the Dockerfile, and every lesson re-baked with results identical to their committed ones.

### Changes after the review

Every claim in the pilots' explanations was checked against the data, including those with no baked value in them. Most held. The user chose not to review the pilots themselves and asked for the four changes that the check suggested:

- **Lesson 1, step 7 (accuracy).** The explanation said Saturday and Sunday have one peak, in the afternoon. In fact each has a broad hump: every hour from 11:00 to 16:00 has 59 to 74 trips. The hourly chart also has two weekday gaps that the explanation didn't mention: Monday at 17:00 (7 trips, against 51 an hour later) and Thursday at 13:00 (none). `weather.csv` has rain in both hours, 2.9 mm and 4.1 mm. The explanation now says both things.
- **Lesson 1, step 4 (coverage).** "Global vs layer aesthetics" is on the concepts list, but only the global case was explained. One sentence now says what a colour mapped in `geom_point()` alone would do.
- **Lesson 3, step 8 (depth).** Every route at the top of the sorted list ends at `NA`, a lost bike, so a learner could think the fix is to drop the `NA` ends. The explanation now says that wouldn't be enough: among routes that end at a station, the five with the longest mean have at most 2 trips each (a baked value).
- **Lesson 7, the save step (depth).** It told the learner that CSV loses column types without showing it, because none of `activity`'s columns has a type that CSV loses. It now saves `jan`, whose `Dock Faults` the learner made an integer, and reads each file back. The CSV comes back with `Dock Faults` under `dbl`; the RDS keeps `<int>`. A step may have at most three statements (`check_content.py`), so this became two steps, one per format: lesson 7 now has 7 steps after Setup and 16 statements.

`content/world/check.R` now checks the facts these explanations state without a baked value: the two rainy gaps, the weekend hump, and the tiny groups among the longest routes. If a change to the generator loses one of them, the image build fails.

### Audit results

One run each, with no warnings or page errors:

| Audit | Result | Notes |
| --- | --- | --- |
| `lesson_modes.cjs 01-data-visualization` | 5/5 | 14 statements (34 lines) typed; Show me on the first chart; Solo with 12 alternatives. Rerun after the review's changes, with the same result. |
| `lesson_modes.cjs 03-data-transformation` | 5/5 | 14 statements (27 lines); the pipe typed with Ctrl+Shift+M in Demonstration and by the learner; Show me on the `mutate()`; 13 alternatives. Rerun after the review's changes, with the same result. |
| `lesson_modes.cjs 07-data-import` | 5/5 | Rerun after the review's changes: 16 statements (36 lines), two declared warnings; 10 alternatives. |
| `lesson_modes.cjs 28-quarto` | 5/5 | 2 statements and 5 texts typed into the document (36 lines), 5 renders, visual and back, New Quarto Document; Show me on the first text. |
| `lesson_modes.cjs engine-check`, `engine-actions` | 5/5, 5/5 | Rerun after the coach changes. After the review's world checks, `engine-check` re-baked with results identical to its committed ones. |
| `lesson_switch.cjs` | 6/6 | Rerun. |
| `practice_modes.cjs`, `demo_mode.cjs` (article lessons) | 19/19, 12/12 | Rerun. |
| `coach_in_ide.cjs` (`regional-revenue`) | 21/21 | Rerun, AI-assistant lockout included. |

After the swap, and the coach change it brought (a new line is scrolled into view before the coach types on it), every audit was rerun once, in sequence: `demo_mode.cjs` 12/12 and `practice_modes.cjs` 20/20, both now on the pilots; `lesson_modes.cjs` 5/5 for each of the four pilots and both fixtures; `lesson_switch.cjs` 6/6; and `coach_in_ide.cjs` 21/21. There were no warnings or page errors.

At the coach's normal pace, with nobody pressing Advance, the Demonstrations took 9.9 minutes (lesson 1), 8.3 (lesson 3), 8.3 (lesson 7) and 6.7 (lesson 28), within the plan's 5 to 10 minutes. Each ran to its last explanation with no page errors. After the review, lesson 7's new step took its Demonstration to 9.3 minutes, timed the same way. Lessons 1 and 3 each gained a sentence, about a second of reading time, and weren't timed again.

## Phase 3: the other 25 lessons (21 November 2026)

Phase 3 of `plan-docs/R4DS_CHAPTERS_PLAN.md` wrote the remaining 25 lessons, part by part, on the pilots' pattern. All 29 now exist, with 382 statements between them. Every lesson bakes, with both runs identical, and its explanations were checked against the data as they were written: each number they quote is a baked value, and each fact they state without one is asserted by `content/world/check.R`, so a change to the generator that loses it fails the image build. Each lesson was written against its "concepts to grok" (plan §5); where a draft step from the plan didn't suit the data, the concept is taught another way (below).

| Lesson | Steps after Setup | Statements | What the learner does |
| --- | --- | --- | --- |
| **2 Workflow: basics** | 6 | 15 | Fares as sums (precedence, brackets); `<-` typed with Alt+- and the Environment; a vector of trip lengths and recycling; a trailing comment, snake_case, and R's error for `Trip_cost`; `seq()` with named and positional arguments; `round(mean())`; reading readr's error for a mistyped file name, then the fares table. |
| **4 Workflow: code style** | 5 | 10 | The script opens with code written in a hurry (`T<-read_csv(…)`, a one-line pipeline). Code › Reformat Document runs Air over it; the learner rewrites it with names that say what they hold, one pipe step per line and one chart layer per line, then adds three sections (`# … ----`) and learns the outline. |
| **5 Data tidying** | 7 | 15 | `pivot_longer()` on twelve month columns, with `values_drop_na`; a summary and `slice_max(by =)` on the long data; `names_sep` for `weekday_am`; `.value` for `trips_member`/`minutes_casual`; the survey's tick-box columns with `names_prefix`; `pivot_wider()` into a report table. |
| **6 Workflow: scripts and projects** | 5 | 11 | Code written in the script; `getwd()` and relative paths into `outputs/`; a chart saved with `ggsave()`; Session › Restart R, then **Source**, which writes both files again; File › New Project into `practice`. |
| **8 Workflow: getting help** | 7 | 14 | dplyr's error for `filter(start_station = 101)`, read part by part; a mean that comes out `NA`; the same problem in three rows; `reprex()` rendered in the Viewer; `?mean` and `na.rm`; `dput()`; `packageVersion()` and `sessionInfo()`. |
| **9 Layers** | 7 | 15 | A station map with `size` and `colour`, then `coord_quickmap()`; a week's hourly line without and with `group` and `colour`; `facet_grid()`; `after_stat(prop)` with `group = 1`; stacked, filled and dodged bars; seeded jitter. |
| **10 Exploratory data analysis** | 7 | 14 | A histogram whose axis runs to 12,902 minutes; `coord_cartesian()` to see the rare bars; the 135 impossible lengths flagged and set to `NA`; frequency polygons with `after_stat(density)`; a day × hour tile chart; `geom_bin_2d()` on log scales; `lm()` and broom's `augment()`, whose residuals show e-bike trips 26% shorter over the same distance. |
| **11 Communication** | 6 | 17 | One chart of weekday trips by hour, improved in stages kept as `base`, `labelled`, `annotated`, `scaled` and `polished` (so any stage can be rerun): `labs()` with a title that states the finding, `geom_label_repel()` on the peaks, `scales::label_*()`, `theme_minimal()` and the legend, then a bar chart beside it with patchwork. |
| **12 Logical vectors** | 6 | 10 | `%in%` and `==` as new columns; 2.01 km × 1000 is 2009.9999999999998, so `==` finds none of the 271 trips `near()` finds; `NA` in comparisons and `is.na()`; `!(A \| B)`; `sum()`, `mean()` and `any()` of conditions; `case_when()`. |
| **13 Numbers** | 7 | 14 | `parse_number()` and `count()`; 15-minute slots with `%/%` and `%%`; `round()` to even and `cut()`; `cumsum()`; day-to-day change with `lag()`; `min_rank()` within groups; `summary()`, then mean, median, `sd()` and `quantile()` of plausible trips. |
| **14 Strings** | 7 | 15 | Escapes and a raw string, printed and with `writeLines()`; `str_glue()` labels and `str_c()` with `NA`; `str_flatten()` per neighbourhood; bike models split into columns and comments into sentences; `str_length()` and `str_sub()` on two ID formats; `str_to_title()`'s limits and Turkish capitals. |
| **15 Regular expressions** | 6 | 13 | `str_view()`; anchors and `{{n}}`; `separate_wider_regex()` reading both ID formats; a named vector of replacements to tidy station names; `.` against `fixed(".")`; promo codes with a group, then `regex(ignore_case = TRUE)`, which finds six more. |
| **16 Factors** | 6 | 12 | Satisfaction sorted alphabetically, then made a factor with `fct()`; bars in level order and `fct_infreq()`; `fct_reorder()`; `fct_collapse()` and `fct_lump_n()`; an ordered factor compared with `>=`. |
| **17 Dates and times** | 6 | 14 | `ymd_hms(tz =)`, `mdy()`, `read_csv()` with a time zone; `wday()` and `make_date()`; weeks with `floor_date()`; a trip across the spring change, 86.4 minutes by the clock and 26.4 in fact; `ddays(1)` against `days(1)`; `with_tz()` and `force_tz()`; three trips that end "before" they start in November's repeated hour; `today()`. |
| **18 Missing values** | 6 | 15 | `fill()` down the maintenance summary; `-99` with `na_if()`; `coalesce()` for a station's January name; June's hours `complete()`d, exposing the 34-hour sensor gap; `NaN` for 24 June; stations with no trips by `anti_join()` and `.drop = FALSE`. |
| **19 Joins** | 6 | 13 | Station 117 listed twice; a join that adds 2,947 rows with a many-to-many warning; the key fixed and the join asserted with `relationship = "many-to-one"`; `semi_join()`; each trip's hourly weather; each trip's fare with `closest(date >= valid_from)`. |
| **20 Spreadsheets** | 6 | 13 | `excel_sheets()`; `skip = 3` below the titles; `na` and `col_types`, whose warnings name the cells typed as notes; Excel day numbers to dates; all three depots with `map()` and `list_rbind()`; `write_xlsx()`. |
| **21 Databases** | 5 | 12 | `dbConnect(duckdb(), read_only = TRUE)` to a new database file; `dbListTables()`; SQL with `dbGetQuery()`; `tbl()` and a lazy dplyr query; `show_query()`; `collect()`; `dbDisconnect()`. |
| **22 Larger-than-memory data** | 6 | 13 | 13.6 MB of CSV for one year against 9 MB of Parquet for five; the archive's year and month folders; `read_parquet_duckdb()` and `count()` in DuckDB; `explain()` showing 12 of 57 files scanned; `collect()` and a chart; `compute_parquet()` partitioned by year. |
| **23 Hierarchical data** | 6 | 12 | `read_json()` and `str()`; `$`, `[[` and `View()`; a list-column; `unnest_wider()`, `unnest_longer()` and `hoist()` on the GBFS-shaped station feed. |
| **24 Web scraping** | 5 | 11 | `read_html()` on the local site; CSS selectors for the station cards; `html_text2()` and `html_attr()`; `html_elements()` against `html_element()` when only 3 of 80 cards have a note; `html_table()`; when scraping is acceptable. |
| **25 Functions** | 5 | 13 | `km_to_miles()`; `speed_kmh()` in `mutate()`; a summary function; `summarize_trips(df, group)` with `{{ }}`; a histogram function whose title counts its trips. |
| **26 Iteration** | 5 | 10 | `across()` with a function, then with a named list and `.names`; `if_any()`; twelve exports with `map()` and `list_rbind()`; one CSV per neighbourhood with `nest()` and `walk2()`. |
| **27 A field guide to base R** | 5 | 12 | `[` on a vector and on a data frame; `$`, `[[` and a `for` loop; `vapply()`, `split()` and `lapply()`; `hist()`, `plot()` and `barplot()`. |
| **29 Quarto formats** | 5 | 10 | A report whose YAML lists HTML (with `toc` and `code-fold`), Word and Typst PDF: rendered with the Render button, then as Word and PDF with `quarto_render()`; revealjs slides; a dashboard with a `reactable()` table; a two-page website in its own folder. |

### What the lessons needed

- **Alt+- on a statement.** `"keys": "Alt+-"` works like Ctrl+Shift+M: the coach types each `<-` with the shortcut, and Guided and Solo count the statement once the learner has pressed it too (lesson 2). The coach reads Option+- on a Mac as Alt+-.
- **Errors in the tidyverse's style.** rlang prints `Error in \`filter()\`:` and puts the message on the next line, after `! `; the coach now reads both lines, for `error` evidence and Guided's feedback.
- **A lesson's script can start with code** (lesson 4): any script, not only a Quarto document, can have a `"starter"`.
- **`source` and `new-project` actions** (lesson 6). Source runs the saved script; the bake runs every statement so far again, after a Restart R. New Project goes through the wizard and types the name; RStudio then reloads the page into the new project, so the coach records the step first and explains it once the reload is done. RStudio reopens an existing folder of the same name without complaint. The `project` check is now a pattern for the name of R's working directory.
- **A fresh start returns to the lessons' project** when the learner is in another (lesson 6's `practice`). That reloads the page, so the start is recorded first and carried on afterwards. It also puts the Help pane back to its home page, empties the Viewer, and closes reprex's Markdown file and the tabs `View()` opened (lessons 8 and 23), or a page left from before would tick a task by itself.
- **The help page and the Viewer** are spotlit when a step's evidence is about them.
- **Fingerprints for things that point elsewhere.** A DBI connection is fingerprinted by its class, a dbplyr table by its SQL, rvest's documents and node sets by their HTML, and a duckplyr frame by the tibble it collects to, or, when it has more than 100,000 rows, by its columns alone: counting runs in DuckDB, so the learner's session never reads the archive into memory to check a step. `object.size()` is skipped for lazy tables, since it would run their queries.
- **Charts compare without row order** (so `group_by() |> summarize()` and `summarize(.by =)` draw the same chart for the check), and **a patchwork** is all its plots and its layout; before, it was its last plot alone.
- **The bake ignores Quarto's cache** (`.quarto/`), whose file names are random.
- **`{{text}}` in an explanation** shows a literal `{text}`, for regular expressions' `{5}`.
- **A DuckDB database** in the world, `larkhaven.duckdb`, with `trips`, `stations`, `bikes` and `fares` read back from their CSV files. Like `trips.csv`, it exists only in the image and each project links to it. `check.R` checks its tables.
- **New world checks** for facts the explanations state without a baked value: each sharp dip in daily trips is a day of rain or cold (lesson 6), the biggest day-to-day rise follows one (lesson 13), the busiest 15-minute slot starts at 17:00 (lesson 13), each weekday has two peaks (lessons 9 and 10), every trip with no or zero distance has an impossible length (lesson 10), and 24 June has no weather at all (lesson 18).
- **`tools/format_lesson.py`** formats every statement as Air does, from the runtime image, so a lesson is written once and formatted, rather than rewritten after each failed bake.
- **The default run is every lesson written** (`tools/collection.py`), now all 29, and `tests/practice_modes.cjs` takes its expectations from the collection.
- **Parallel audits.** `run.sh` takes its run folder, ports and Compose project from `LAB_RUN_DIR`, `LAB_GATEWAY_PORT`, `LAB_RSTUDIO_PORT` and `LAB_COMPOSE_NAME`, with today's defaults, and `tests/run_lesson_audits.py --jobs N` audits lessons N at a time, each in its own run.

### Where the plan's draft steps changed

- **Lesson 4** rewrites the hurried code in the lesson's own script instead of renaming objects in place: RStudio's Rename in Scope isn't an action the coach has, and the check can only see results, not style.
- **Lesson 6** explains the `.RData` settings rather than changing them: the lab already never saves or restores a workspace, so there is nothing for the learner to switch.
- **Lesson 10** compares member types with frequency polygons rather than reordering weekdays: the median trip length differs by under a minute between days, and reordering is lesson 16's subject.
- **Lesson 13** takes day-to-day change with `lag()` rather than the time between a bike's rides: bike IDs in the generated trips overlap (2,080 rides start before the bike's last one ended), which would teach confusion.
- **Lesson 14** splits the survey's comments into sentences rather than "multi-select answers into rows": the tick-box answers are separate columns, which lesson 5 lengthens.
- **Lesson 20** reads the Date column as numbers and converts it with `as_date(origin = "1899-12-30")`: asking readxl for dates warns once for every row.
- **Lesson 29** renders Word, PDF and the website with `quarto_render()`: the Render button renders only a document's first format.

### Things found on the way

- **Source straight after Restart R can fail to save the script** ("Error Saving File … jsonrpc error 200"), while RStudio is still restarting. The coach, and the audit's learner, dismiss it and press Source again.
- **New Project asks to save unsaved documents first**; the coach saves the lesson's script before it starts.
- **reprex on the server opens its Markdown output in the Source pane**, so saving the lesson's script needed the coach to switch back to its tab first: before, Save saved the reprex's file, and the step failed.
- **Stopping a Demonstration mid-step** made the panel redraw its controls after it was gone (a page error in `demo_mode.cjs`), after this phase's change that split the step's ending into its own function. Fixed.
- **A Show me still working when the learner left Guided** redrew the Guided panel over Solo's; it now leaves the panel alone.
- **`fs::file_size()` on `data/trips.csv` reports the link, 24 bytes**, so lesson 22 uses `file.size()`, which follows it.
- **duckplyr won't quietly materialise a big result**: printing or counting `nrow()` of the archive stops and asks for `collect()`. Lesson 22 makes that its point.
- **A dplyr join warns about many-to-many matches**, but a dbplyr join in a database doesn't, so lesson 19 shows the duplicate in R.
- **An alternative runs before its statement, in the same session**: lesson 21's `DBI::dbDisconnect(con)` alternative closed the connection the statement then closed again. Statements that change state outside R's environment have no alternatives.
- **`%e` in a date format pads single-digit days with a space** (" 9 June"); quoted dates are squished.
- **A database returns groups and tied rows in any order.** Lesson 21's `GROUP BY` and its collected counts came back in a different order in each of the bake's runs, so their statements are compared ignoring row order, and the bake now compares two runs the same way the check does.
- **`str_view()` returns its text with colour codes in RStudio** (and none in the bake's Rscript), so its value can't be fingerprinted; lesson 15 checks what the Console shows instead.
- **A base-graphics check had no reference output.** Lesson 27 is the first new lesson with `plot` evidence, which compares what the Console printed, but provisioning passed the reference output only for `console` evidence. The coach then failed on every check (209 page errors in its first audit); it now gets the output for both.
- **The Render button's Background Jobs tab covers the Console**, and the quarto package renders a whole project as a background job too. Lesson 29 renders its website with `as_job = FALSE`, so it happens in the Console, and the coach (like the audit's learner, and the task's wording) clicks the Console tab back to the front before running a statement.
- **The coach loads before RStudio does.** After the reload back to the lessons' project, the first fresh start ran while RStudio was still loading and couldn't open the script (lesson 6's Solo, once in two runs). It now waits for the IDE and for R's evidence from the reopened project.

### Audit results

Every lesson's audit (`tests/lesson_modes.cjs`) was run after this phase's last engine change, three at a time with `tests/run_lesson_audits.py`: 31 lessons (the 29 and the two fixtures) in 21 minutes, whose audits add up to 60. 27 passed 5/5 at once, with no warnings or page errors. The other four failed for reasons now fixed (under "Things found on the way"), and passed 5/5 on a rerun, with no warnings or page errors: lesson 6 (the fresh start ran before RStudio had reloaded), 15 (`str_view()`), 27 (`plot` evidence) and 29 (the Background Jobs tab, and the website rendered as a job).

| Lesson | Time | Demonstration | Guided | Solo |
| --- | --- | --- | --- | --- |
| 2 Workflow: basics | 96 s | 15 statements typed, 2 arrows with Alt+- | 15 tasks | 15, 5 alternatives |
| 4 Workflow: code style | 79 s | reformat, 9 statements, 3 sections | 10, Show me on a pipeline | 10 |
| 5 Data tidying | 121 s | 15 statements | 15 | 15 |
| 6 Workflow: scripts and projects | 155 s | through the new project's reload | 11, written in the script | 11, back from `practice` first |
| 8 Workflow: getting help | 139 s | 14, reprex in the Viewer | 14 | 14 |
| 9 to 27, 29 | 91 to 177 s each | every step explained | every task ticked, with one Show me where a statement spans several lines | every task seen |

The older audits, after the last change, one run each, with no warnings or page errors: `lesson_switch.cjs` 6/6, `practice_modes.cjs` 20/20 (its default run now all 29 lessons), `demo_mode.cjs` 12/12 (whose page error, from stopping a step, is fixed) and `coach_in_ide.cjs` 21/21, AI-assistant lockout included. `tests/test_publish_rootfs_image.py` passes 9/9.

## Phase 4: release (21–22 November 2026)

Phase 4 of `plan-docs/R4DS_CHAPTERS_PLAN.md` prepares the release, with every check automated: the user chose to leave a manual review to the very end (the ledger's last step). It reviewed the security of the evidence endpoint, reviewed the 25 new lessons as a learner reads them, timed every Demonstration at the coach's own pace, ran every audit again, and republished the playground's rootfs.

### Security review of `/coach/api/evidence`

The endpoint serves `~/.lab/evidence.json`, which R writes in the learner's session (`runtime/evidence.R`): fingerprints, classes and shapes of values, the names assigned, the packages attached, the working directory, six RStudio preferences, and the project's file names with their times and sizes. It holds no data values and none of the learner's code. nginx serves it only after an `auth_request` to RStudio's `/`, which answers 200 when the browser is signed in and 302 otherwise.

What was tried, against a running lab, and what it gave:

| Check | Result |
| --- | --- |
| Not signed in: the endpoint, `/coach//api/evidence`, `/coach/api/./evidence`, `/coach/api/%65vidence`, a query string; every method (GET, POST, PUT, DELETE, HEAD, OPTIONS); browser and non-browser user agents; a forged `user-id` cookie | 401 every time |
| The internal `/coach/__signed_in`; `/coach/api/evidence.json` and `/evidence/`; the evidence folder by its own path, or reached with `..` or `%2e%2e` | 404: nothing is served from outside the exact location |
| Signed in | 200, in 1 to 2 ms with the sign-in check |
| Signed in, with a tampered `user-id` cookie | 401 |
| After Sign out, the old cookies | 401: RStudio revokes them |
| Signed in, from another site's page (`Origin: https://example.com`) | The browser sends RStudio's `Lax` cookies only to the lab's own pages; even so, the answer has no CORS header, so another site's script can't read it |
| RStudio down or still starting | 401: the check fails closed |

**Fixed: R froze after `setwd("/")`.** R lists the working directory's files every second for the evidence, with `list.files(recursive = TRUE)`. From `/usr` that took 1.5 s, so R was busy all the time; from `/` it ran for over four minutes and took 2.4 GB without finishing, with the Console frozen meanwhile, enough to exhaust the playground's 4 GiB VM. A learner exploring `setwd()`, which lesson 6 mentions, could do this. The listing is now a breadth-first walk that stops at 500 files or about 5,000 names looked at: from `/`, `/usr` or `/proc` it takes 12 ms or less, a symlink loop included, and a lesson's project gives the same list as before (the bake's results didn't change). `coach_in_ide.cjs` checks it: after `setwd("/")`, R answers in under 10 s (430 ms measured).

**Hardened:** nginx no longer gives its version (`server_tokens off`), and the coach's API (`session`, `steps`, `evidence` and the 401) answers as `application/json` with `X-Content-Type-Options: nosniff`; `session` and `steps` were `application/octet-stream`.

**Accepted, and why:**

- **The sign-in check relies on RStudio's `/`.** RStudio also sends browsers it doesn't support to `unsupported_browser.htm` (a 302), so a client such as `curl` gets 401 even with valid cookies; RStudio wouldn't load in such a browser anyway. The image is pinned by digest, and `coach_in_ide.cjs` now checks the endpoint's answers, so a change in RStudio's behaviour fails an audit.
- **The learner can write the evidence file**, being the owner of `~/.lab`: they can forge their own progress, or link the file to another file in the gateway container, which holds nothing private (the password is only in the RStudio container and `run/.env`). Nothing is scored; a scored mode must not trust page-side checks (see "What reaches the browser").
- **Same-origin pages can read it**: a document in the Viewer or Help pane is served from the lab's origin, so its scripts could read the evidence, as they could call RStudio's own RPC endpoints, which is far more. The lessons' documents are the lab's own (an existing open point).
- **Each request costs RStudio one `GET /`.** The coach reads the evidence at most about four times a second; each check took 1 to 2 ms.
- **`/coach/api/session` and `/coach/api/steps` are public by design**: lesson content, reference fingerprints and the values explanations quote. They hold no secrets, so a gateway bound to every interface (`GATEWAY_BIND=0.0.0.0`) exposes only what the repository already holds. On iximiuz, the RStudio tab is private to the session's owner.
- **With sign-in off (`DISABLE_AUTH=true`, the playground from rootfs v6), the check keeps out only clients that never opened RStudio.** RStudio signs in any browser that asks, so anyone who reaches the gateway can read the evidence, and can use RStudio itself, which is far more. On iximiuz only the session's owner reaches it (the tab's private access); `./run.sh up` keeps sign-in on unless asked. `tests/no_sign_in.cjs` checks both answers.

### Automated review of the lessons

Every lesson was rendered as a learner sees it, in order: the summary, each step's title, each statement's narration ("Writing code to …") and task, the reference output, and each explanation with its baked values filled in. All 25 new lessons were read through that way, checking clarity, tone, that each task says what Solo needs (the name to assign, the file to write), and that each explanation matches the output beside it. A script also checked the learner-facing text of all 29 for spelling (aspell, British and American), repeated words, double spaces, sentence case and full stops in tasks and narration, numbers quoted without a thousands separator, and empty or missing values; every Go deeper link answered 200.

Eleven changes, in eight lessons, all small; none changes code or results:

- **2:** the error's explanation no longer says the project folder is `lessons`, which is true only of the default run.
- **4:** a comma, in "`%in%`, and after each comma".
- **5:** three numbers gained their thousands separator (1,993, 2,457 and 1,334), as every other quoted count has. The four other unseparated numbers are deliberate: 2009.9999999999998, minute 1020, Excel's day 45659, and lesson 25's chart title.
- **7:** a task read "the files in `data/exports` in `files`"; it now lists the files and stores their paths in `files`.
- **12:** narration about "the ones that can't tell" now counts "the trips whose end isn't known".
- **15:** the explanation said a full stop is escaped as `\\.` and that R's string then makes it `\\.`; the first is now `\.`. It also pointed at the double space in a station's name by quoting the name, whose two spaces HTML shows as one; it now says "the two spaces between Castle and Gate".
- **20:** Excel's day numbers count from 30 December 1899 for dates after February 1900, not "since 1900".
- **27:** "the solo task accepts either" became "this step's check accepts either", as Guided accepts it too.

### Demonstrations at the coach's own pace

Every Demonstration was run from **Start** to its last step at the pace a learner gets (`LAB_PACE=normal` in `tests/lesson_modes.cjs`: typing at 70 ms a key, the pointer's movements and every reading countdown, with **Advance** never pressed), four at a time with `tests/run_lesson_audits.py`. All 29 finished: every step was explained, the script held every statement under its heading, and there were no warnings or page errors. A lesson's time runs from **Start** until the last step is explained, so it leaves out the time spent reading that last explanation. The four runs at once share an 8-core machine, but the coach's timers set the pace, not the machine.

| Lesson | Steps | Demonstration | Longest step |
| --- | --- | --- | --- |
| 1 Data visualization | 9 | 10.0 min | 96 s |
| 2 Workflow: basics | 7 | 7.5 min | 86 s |
| 3 Data transformation | 8 | 8.4 min | 105 s |
| 4 Workflow: code style | 6 | 5.6 min | 82 s |
| 5 Data tidying | 8 | 9.4 min | 103 s |
| 6 Workflow: scripts and projects | 6 | 5.5 min | 84 s |
| 7 Data import | 8 | 9.3 min | 103 s |
| 8 Workflow: getting help | 8 | 7.9 min | 81 s |
| 9 Layers | 8 | 10.3 min | 118 s |
| 10 Exploratory data analysis | 8 | 9.5 min | 104 s |
| 11 Communication | 7 | 10.6 min | 116 s |
| 12 Logical vectors | 7 | 6.8 min | 77 s |
| 13 Numbers | 8 | 8.4 min | 85 s |
| 14 Strings | 8 | 9.0 min | 89 s |
| 15 Regular expressions | 7 | 8.0 min | 116 s |
| 16 Factors | 7 | 8.0 min | 109 s |
| 17 Dates and times | 7 | 7.5 min | 89 s |
| 18 Missing values | 7 | 8.8 min | 105 s |
| 19 Joins | 7 | 7.9 min | 103 s |
| 20 Spreadsheets | 7 | 8.1 min | 108 s |
| 21 Databases | 6 | 6.4 min | 81 s |
| 22 Larger-than-memory data | 7 | 8.0 min | 93 s |
| 23 Hierarchical data | 7 | 6.9 min | 81 s |
| 24 Web scraping | 6 | 6.2 min | 105 s |
| 25 Functions | 6 | 8.0 min | 103 s |
| 26 Iteration | 6 | 6.5 min | 104 s |
| 27 A field guide to base R | 6 | 6.4 min | 82 s |
| 28 Quarto | 8 | 6.8 min | 77 s |
| 29 Quarto formats | 6 | 4.9 min | 81 s |

The median Demonstration takes 8.0 minutes, and all 29 take 3.8 hours between them. Steps take 20 to 118 s, with a median of 64 s. 26 lessons fall within the plan's estimate of 5 to 10 minutes. Lessons 9 (10.3 minutes) and 11 (10.6, with 17 statements, the most of any lesson) run a little over, and lesson 29 (4.9, mostly renders) a little under. The longest steps type three statements of 6 to 13 lines between them, such as lesson 9's stacked, filled and dodged bars, and lesson 11's labelled peaks. Nothing was changed for this: a reload already resumes a Demonstration where it was (plan §8, "Long Demonstrations").

### Every audit again

After this phase's last change (the evidence listing in `runtime/evidence.R`, with the image rebuilt), every audit was run again, one run each, from 21 to 22 November. All passed the first time, with no warnings or page errors:

| Audit | Result | Time |
| --- | --- | --- |
| `tests/lesson_modes.cjs`, every lesson and both fixtures, three at a time with `tests/run_lesson_audits.py` | 31 of 31 lessons 5/5 | 20.5 minutes; 59 minutes of audits between them |
| `tests/lesson_modes.cjs` at normal pace (above) | 29 of 29 lessons 3/3 | 60 minutes, four at a time |
| `tests/demo_mode.cjs` | 12/12 | 12 minutes |
| `tests/lesson_switch.cjs` | 6/6 | 50 s |
| `tests/practice_modes.cjs` (the default run of 29 lessons) | 20/20 | 3 minutes |
| `tests/coach_in_ide.cjs` (on `regional-revenue`), the AI-assistant lockout and the evidence endpoint's answers included | 22/22, with no console errors, HTTP errors or failed requests through the gateway | 48 s |
| `tests/test_publish_rootfs_image.py` | 9/9 | 2 s |
| `tools/check_content.py` | 32 lessons, 0 problems | seconds |

An earlier run of `demo_mode.cjs` on 21 November was cut short when its session ended (Chromium closed during lesson 3's **Start over**); it isn't counted.

### Rootfs v5 on the public playground

Once every audit had passed, `bash iximiuz/publish-rootfs-image.sh` built and pushed `ghcr.io/lpmi-13/rstudio-guide-rootfs:v5` on 22 November 2026, then updated `iximiuz/versions.sh`, `iximiuz/manifest.yaml` and the public playground `rstudio-guide-16afe14e` (whose manifest now names v5). It was built from `0a42c38` plus this README's uncommitted edits, since the script packs the working tree's tracked files. v5 is 1.97 GB compressed (v4 was 1.67 GB). Inside, the image archive is 3.2 GB and the disk 12 of 20 GB used.

Two sessions of the public playground, each started with `labctl playground start rstudio-guide-16afe14e`, the second as a free-tier user (`--as-free-tier-user`):

| | First start of v5 | Second, as a free-tier user, 4 minutes later |
| --- | --- | --- |
| Start command to RStudio ready (the init task done) | **107 s** | **76 s** |
| Before the VM booted (fetching the rootfs) | about 65 s | a few seconds |
| Boot to ready (`docker load` of the archive, then `./run.sh up` of all 29 lessons) | 40 s | 70 s |
| `/coach/api/steps` from the machine by name | 200, 29 lessons | 200, 29 lessons |

Both starts were faster than v2's 144 and 149 s (19 November), despite the larger image, so the fallback the plan held in reserve, pulling the runtime image during init, isn't needed. Why the second start's init took longer wasn't measured.

In the first session, through `labctl port-forward` and Playwright: signing in took 5 s; the picker opened on lesson 1 and the coach's lesson list held all 29; lesson 1's Demonstration (at the audits' fast pace) typed, ran and explained its first two steps with the bake's values (4,540 trips in `week`) in 12 s, with no page errors. The terminal banner gave the username and password and said to choose a lesson and a mode. With the learner signed in and two steps run, RStudio's container used 279 MiB and the VM had 3.3 of 3.9 GiB available. A free-tier session can't be stopped (`labctl` gets a 402), so it was destroyed.

## Remote playground (iximiuz Labs)

The public playground is [`rstudio-guide-16afe14e`](https://labs.iximiuz.com/playgrounds/rstudio-guide-16afe14e). Anyone can list, view and start it (`accessControl: anyone` in `iximiuz/manifest.yaml`); each session runs on the quota of the person who starts it.

It runs from a published **rootfs image**, `ghcr.io/lpmi-13/rstudio-guide-rootfs`. It is built on iximiuz's Docker base (`ubuntu-docker-c36cb070`) and carries this repository and the RStudio runtime and gateway images, preloaded so no Docker Hub pull is needed. Publishing works like argo-remotelab's `scripts/publish-rootfs-image.sh`.

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
labctl playground start rstudio-guide-16afe14e            # the public playground
labctl playground start docker -f iximiuz/manifest.yaml   # throwaway session from the local manifest
```

The public playground was created once with `labctl playground create --base docker -f iximiuz/manifest.yaml rstudio-guide`. iximiuz added the `-16afe14e` suffix, and `name:` in the manifest records it, so later publishes update that playground. Don't run `create` again: it would make a second playground with a new link.

**What a learner sees:** from rootfs v6, iximiuz's loading screen until the init task is done, then the playground's only tab, **RStudio**: the IDE inside the playground page, already signed in, with the coach docked. No clicks and no password. Every lesson in the default run is offered, so the learner picks one in the Coach pane, as the playground's description says. Up to v5 the playground opened on a **Terminal** tab that printed the RStudio username and the run's password, and the learner then signed in on the RStudio tab: one click plus sign-in. Rootfs v5 holds all 29 lessons; v3 and v4 held the two article lessons. With no terminal, the learner can't start a one-lesson run (`./run.sh up <lesson>`) any more; the default run offers every lesson anyway.

### How it works

- **Init:** the manifest's single init task runs `iximiuz/start-lab.sh`. On first start it does `docker load` on `/opt/rstudio-guide/images.tar`, then runs `./run.sh up`, the default run: all 29 lessons from v5, the two article lessons in v3 and v4, and `graphical-tools` alone up to v2.
- **`lab.env`** is baked into the rootfs with `FRAME_ORIGIN=https://labs.iximiuz.com`, `GATEWAY_BIND=0.0.0.0`, `LAB_PREBUILT=1` and, from v6, `DISABLE_AUTH=true`. Every later `./run.sh up` keeps these, so switching scenario keeps the RStudio tab working and never rebuilds or pulls. Values set in the environment still win.
- **The RStudio tab** is an `http-port` tab on 8788 with private access: only the person who started that session can open it, even though anyone can start the playground. From v6 that is the only lock: RStudio's sign-in is off (`DISABLE_AUTH=true`; Rocker then sets `auth-none=1`), so RStudio signs in whoever iximiuz lets through. A learner who exposes port 8788 publicly themselves (`labctl expose port --public`, or the UI) gives anyone with the link their RStudio, and its terminal, until the session ends. RStudio allows `labs.iximiuz.com` to frame it via `www-frame-origin`, set at container start by `runtime/04_lab_frame_origin`. The coach skips only frames nested *inside* RStudio, so it runs when RStudio itself is framed.
- **Earlier approach:** the first tests below packed the repository into the manifest as a startup file, because iximiuz allows at most 20 startup files. The rootfs image replaced that.

### Results: rootfs image

Tested on 19 November 2026 with throwaway sessions from `iximiuz/manifest.yaml`. Each check below was driven through an SSH tunnel (`labctl port-forward`) with the Playwright CLI.

| Check | v1 | v2 |
| --- | --- | --- |
| Init task | **Failed, retrying every second.** `docker save` writes its archive as `0600`, so `laborant` couldn't read `/opt/rstudio-guide/images.tar`. With the file made readable by hand, everything below passed. | Passes unaided |
| Start command to RStudio ready | n/a | **149 s and 144 s.** About 2 min of that passes before the VM boots, while iximiuz fetches the 1.66 GB rootfs; a second start was no faster. Boot to ready is 34 s (`docker load`, provisioning, RStudio start). |
| Rebuilds or pulls in the VM | none | none (`LAB_PREBUILT=1`; build cache empty) |
| Scenario switch as a learner (`./run.sh up statistical-tools`) | 19 s | 18 s; the message says to open the RStudio tab |
| Terminal banner, gateway reached by machine name, AI lockout | Pass | Pass |
| Graphical demo, all 4 steps (each explained only after a new chart loaded) | Pass | Pass |
| Statistics demo, all 5 steps (values match the Console and the article) | Pass | Pass |
| Layout in the VM | `~/rstudio-guide/spike/coach-in-ide` | `~/rstudio-guide`, the same as this repository |

**The public playground** (`rstudio-guide-16afe14e`, v2) was started with `labctl playground start --as-free-tier-user` on 19 November 2026. The init task completed and the command returned in **62 s**. The terminal banner showed the graphical-tools sign-in, and the gateway answered by machine name. The playground page loaded without an iximiuz login.

**The v2 fix:** the build script makes the archive `0644`, and the rootfs build now fails if `laborant` can't read the archive, run `start-lab.sh` or write the repository. That check caught a second bug before anything was pushed. `COPY --chmod=0644` also gives the directory it creates mode `0644`, which `laborant` can't enter, so the Dockerfile doesn't use it.

**Start-up trade-off:** the earlier manifest-embedding version reached ready in 86–107 s. It booted iximiuz's cached Docker base and pulled 2.6 GB from Docker Hub during init. The rootfs version is about 45 s slower, because iximiuz downloads the custom rootfs before boot, but it no longer depends on Docker Hub or its rate limits. Faster alternatives to try if start-up matters: a smaller runtime image (rocker's image is most of the 1.66 GB), or pushing only the runtime image to GHCR and pulling it during init on the cached base. v5 (22 November) reached ready in 107 s and 76 s despite being 1.97 GB, so neither is needed for now (see "Rootfs v5 on the public playground" under Phase 4).

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

### Sign-in off and the starting page (24 November 2026)

Up to v5, a learner read the password in the **Terminal** tab and typed it into the **RStudio** tab. iximiuz already signs the learner in before it shows a tab with private access, so RStudio's sign-in was a second lock, and it was the only reason for the Terminal tab. From v6, `lab.env` sets `DISABLE_AUTH=true`. Rocker then starts RStudio with `auth-none=1`, the manifest has only the RStudio tab, and the terminal banner is gone. Locally, `./run.sh up` keeps the password unless asked (see "Run it").

**Alternatives, and why not:**
- A gateway page that submits the password for the learner protects nothing more than no sign-in does, and adds parts that can break.
- RStudio's proxied sign-in, where the gateway passes the user's name to RStudio, is only in Posit Workbench.
- The gateway could mint RStudio's signed sign-in cookie itself, but that is fragile and gives the same result.

**How sign-in off behaves** (RStudio 2026.11.0+203, checked first on `rocker/rstudio:4.6.2` with `DISABLE_AUTH=true`, then in the lab):
- `/` redirects to `/auth-sign-in`, which signs the browser in as `rstudio` with no form and redirects back to `/`.
- The R session runs as `rstudio`, as UID 1001 too (iximiuz's `laborant`).
- `runtime/04_lab_frame_origin` runs after Rocker swaps in its no-sign-in `rserver.conf`, so `www-frame-origin` survives.
- `run.sh` still passes the run's password. Without it, the account would keep Rocker's default password, `rstudio`.

**Before RStudio is ready.** iximiuz shows a loading screen until the init task is done, but [a learner can close it](https://labs.iximiuz.com/docs/custom-playgrounds/init-tasks). What the RStudio tab then gets was measured on a throwaway v5 session, with its init task held back 3 minutes, and by polling the gateway on its VM every 0.2 s during `./run.sh up`:

| Window | What a browser gets | How long |
| --- | --- | --- |
| Nothing listens on 8788 yet (VM booting, `docker load`, provisioning) | iximiuz's proxy holds the request and retries. If the gateway answers within about 110 s, the page loads normally; if not, a bare plain-text 503 (`upstream connect error or disconnect/reset before headers…`). | About 30 s from init start on first boot; about 5 s in a restart |
| The gateway is up but RStudio isn't listening | Before: nginx's own `502 Bad Gateway`, which stays until a reload. Now: the gateway's starting page (`gateway/starting.html`, 503), which reloads itself every 2 s. | About 1 s, seen in 1 of 2 restarts |

The first window needs nothing from the lab, because first boot is well inside the proxy's 110 s. So the starting page is only the gateway's answer on `/` in the second window. No placeholder server runs during `docker load`.

**End to end on iximiuz**, on a throwaway session of the new manifest. That session ran rootfs v5 with this change's `run.sh`, `compose.yaml`, gateway files, `start-lab.sh` and `lab.env` laid over it as startup files, so nothing was published. Port 8788 was exposed publicly for the test only, since a headless browser can't sign in to iximiuz, and the session was then destroyed.

| Check | Result |
| --- | --- |
| A playground with only the RStudio tab | Starts; the init task completed, 31 s from its start to ready |
| Opening RStudio while the init task ran, as a learner who closes the loading screen | The proxy held the request 27 s; then `302 /`, `302 /auth-sign-in`, `200 /`, the IDE in 30 s and the coach's picker with 29 lessons, with no sign-in form, no reload and no page errors |
| RStudio stopped inside its container (`s6-svc -d`) | `/` gave the starting page through the proxy (503, `no-store`, `Retry-After: 2`), and other paths gave nginx's 502. The open page reloaded itself twice in 5 s, then opened RStudio 4.2 s after it was started again. |
| Framing | `Content-Security-Policy: frame-ancestors https://labs.iximiuz.com` from RStudio, plus iximiuz's own `frame-ancestors 'self' https://*.iximiuz.com` |

**Audits, locally on v5's runtime image:**

| Audit | Sign-in | Result |
| --- | --- | --- |
| `tests/no_sign_in.cjs` (new): run.sh's messages and the account's password, the IDE with no form, framing, the evidence's answers, the starting page | off | 6/6 |
| `tests/coach_in_ide.cjs` (regional-revenue), including the evidence endpoint's 401s | on | 22/22 |
| `tests/lesson_switch.cjs` | on, then off | 6/6 and 6/6 |
| `tests/lesson_modes.cjs engine-check` (Demonstration, Guided, Solo) | off | 5/5 |
| `tests/test_publish_rootfs_image.py` (`lab.env` now has `DISABLE_AUTH=true`) | n/a | 9/9 |

There were no warnings or page errors. Locally, RStudio took about 23 s to answer after `s6-svc -u`, against 4 s on iximiuz; the starting page waited it out either way.

### Not done yet

- **Publishing rootfs v6** (`bash iximiuz/publish-rootfs-image.sh`), which also updates the public playground. Until then it shows v5's Terminal tab and sign-in.
- The RStudio tab on v6 by hand inside the iximiuz page: that it opens on RStudio, signed in, and what the loading screen does if closed early (part of the user's manual review, the ledger's last step). The headless checks above went through a public exposure of the same port, not the private tab.

## Plan deviations and open points

- **Demonstration control uses RStudio's own UI, not `rstudioapi`.** The plan proposed an addin calling `rstudioapi::sendToConsole()`. That needs an R-side trigger and a package the image doesn't have. Typing into the real Source pane and pressing the real Run button, with a visible pointer, works without either. It also shows the learner the exact workflow they will use.
  - Trade-off: it depends on DOM details (finding 4).
  - Rejected alternatives: RStudio's internal `/rpc/console_input` and the undocumented `window.dispatchRStudioCommandExternal`.
- **The lessons' data are fixed.** Larkhaven Bikes is generated from one seed, so every run has the same values. The plan's per-run variation by scenario key doesn't apply yet.
- **What reaches the browser.** The article lessons sent their expected Console output to the page, since it was public. Version 2 lessons send each statement's fingerprint and the values their explanations quote, but not the output. Nothing is scored, so Guided and Solo check in the page. A scored mode, or a lesson with a private answer such as `regional-revenue`, must not rely on either (plan §4).
- **The coach's checks for the older lesson format are no longer exercised.** Since the article lessons were retired, only `regional-revenue` uses that format, and only for its Guided stub. The coach's Demonstration, Guided and Solo code for it (checks against the Console's text) remains but no audit runs it.
- **Solo is the plan's Challenge mode**, under the product name ELK Guide uses. It is not scored yet: it counts hints and discloses results only on request, but has no score or replay with fresh values.
- **Not covered yet:** saved-code grading, clean replay by key, launch handoff, and headed Chrome and Firefox. Same-origin code, the coach's or a page in the Viewer, can call RStudio's RPC endpoints. The evidence endpoint has had a security review (Phase 4); the rest of the lab hasn't.
