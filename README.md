# RStudio guide: a coach inside the RStudio tab

RStudio Server with an in-IDE coach, two lessons that can each be watched (Demonstration), done with help (Guided) or done alone (Solo), and an iximiuz Labs playground. It began as the feasibility spike for `plan-docs/R_STUDIO_WRAPPED.md` §6 (probes "Proxy and coach" and "Demonstration control"). This README is also the spike's decision record, dated 19 November 2026.

**Try it in your browser:** [RStudio coach on iximiuz Labs](https://labs.iximiuz.com/playgrounds/rstudio-guide-16afe14e). It needs a free iximiuz account. Starting it takes about a minute. The **Terminal** tab then shows the RStudio password; open the **RStudio** tab and sign in. (The playground still runs the version before the mode picker until the rootfs is republished.)

| Question | Answer |
| --- | --- |
| Can the coach run inside the RStudio IDE tab without breaking RStudio? | **Yes.** It needs a capture-phase keyboard shield that loads before RStudio's own code. |
| Can it dock into RStudio's layout instead of floating over it? | **Yes.** It docks into RStudio's own sidebar column, and RStudio resizes the other panes around it. If the learner hides the sidebar, it falls back to a floating card. |
| Can the learner choose a lesson, and whether to watch, be guided, or work alone? | **Yes.** A new run holds both lessons and opens on a picker in the coach: a lesson, then **Demonstration**, **Guided** or **Solo**, over the same steps, script and reference output. Guided and Solo check the learner's own work from what RStudio shows. |
| Can it drive a visible, automatic demonstration in the real IDE? | **Yes, for two article-based scenarios.** It works RStudio the way a learner would: a visible pointer moves to each control it clicks, and it types each line into the Source pane one key at a time. It then presses RStudio's Run button and waits for the Console or Plots pane to show the reference result. Only then does it explain, quoting values that are on screen. |

Final runs: the guided audit passed 21/21, including the AI-assistant lockout, and the demonstration audit passed 12/12 on four consecutive runs (8 fresh provisions). There were no warnings, page errors, console errors, HTTP errors or failed requests through the gateway. After the demonstrations were changed to type their code with a visible pointer, the demonstration audit passed 12/12 and the guided audit 21/21, each on one run, again with no warnings or page errors. After the lesson and mode picker, Guided and Solo were added, one run each: picker, Guided and Solo audit 17/17, demonstration 12/12 (now choosing Demonstration on the picker) and the regional-revenue audit 21/21, with no warnings or page errors. After the dimmed spotlight and slower pacing, one run each: the same 17/17, 12/12 and 21/21. After the demonstration panel was changed to show only the current step, narrated by each line's purpose, the demonstration audit passed 12/12 on one run, with no warnings or page errors (the other audits were not rerun). After every line and explanation were given a reading countdown with **Advance**, it passed 12/12 again on one run, with no warnings or page errors, in 9.2 minutes. After every mode choice (and **Start over**) was made to start the lesson afresh, one run each: picker, Guided and Solo audit 19/19, demonstration 12/12 in 9.9 minutes, and the regional-revenue audit 21/21, with no warnings or page errors.

One intermittent failure appeared earlier, before the fix in finding 7: Chromium dropped the sign-in page's scripts while Docker was still changing the host network. It has not recurred in those 8 provisions, but that is evidence, not proof. The audits still check for it and report it as a warning if it happens.

## Run it

```bash
./run.sh up                      # both lessons in one project, "lessons" (the default)
./run.sh up statistical-tools    # one lesson only (or graphical-tools, or regional-revenue)
./run.sh down                    # stop and delete the run directory

# Audits (need @playwright/test installed globally). Each provisions its own runs.
./run.sh up regional-revenue && NODE_PATH=$(npm root -g) node tests/coach_in_ide.cjs results
NODE_PATH=$(npm root -g) node tests/demo_mode.cjs results
NODE_PATH=$(npm root -g) node tests/practice_modes.cjs results
```

After signing in, choose a lesson and then **Demonstration**, **Guided** or **Solo** in the Coach pane on the right; `run.sh` prints the same reminder. A one-lesson run skips the lesson cards. `regional-revenue` is the original Guided stub (a Check work button, no steps), so it opens straight into it with no picker, and it can't share a run.

- Gateway with the coach: <http://127.0.0.1:8788/>. The user is `rstudio`; `./run.sh up` prints the password, which is also in `run/.env`.
- Direct RStudio without the coach, for comparison: <http://127.0.0.1:18787/>.
- Both ports listen on loopback only. On a remote VM, keep that and use an SSH tunnel: `ssh -L 8788:127.0.0.1:8788 <vm>`, then open <http://127.0.0.1:8788/> locally. `GATEWAY_BIND=0.0.0.0 ./run.sh up …` serves RStudio over plain HTTP on every network the VM is on, where anyone who can read the traffic can take over the session, and Docker's published ports bypass host firewalls such as ufw. Use it only behind something that adds TLS and access control, as the iximiuz playground's private RStudio tab does.

### Requirements

- Docker Engine with Compose v2, Python 3, curl and bash. `run.sh up` checks for these.
- About 3 GB of disk for the RStudio image (amd64 or arm64), and about 200 MB of RAM per run at idle.
- Free ports 8788 and 18787.
- Audits only: Node with `@playwright/test` and its Chromium installed globally.
- `run.sh` passes your UID/GID to the container, so RStudio can save into the bind-mounted project. UID 1000 is tested here. On iximiuz, `laborant` is UID 1001, and sign-in and both demos worked through rocker's re-created user. Saving a file under a non-1000 UID has not been tested.

## What is built

| Piece | File | Notes |
| --- | --- | --- |
| Scenarios | `scenarios/<id>/scenario.json`, `scenarios/<id>/project/` | `graphical-tools` and `statistical-tools` offer `"modes": ["demonstration", "guided", "solo"]` and can share a run; `regional-revenue` offers only its Guided stub. A lesson's steps, code, evidence type, captured values, narration (each line's `purpose`) and the task shown to a learner for each line all live in one file. |
| Provisioning | `tools/provision.py`, `runtime/reference.R` | Copies each lesson's files into one project (named after the lesson, or `lessons` when there are several, with a README listing them; it refuses clashing file names) and generates each lesson's script from `scenario.json`: a header and one `# Step N.` heading per step, with no code yet. The coach or the learner types it, depending on the mode. Every line needs a `task` when Guided or Solo is offered, and gets two generated hints: how it starts (`plot(…)`) and the line without its comment. It then runs every line in a throwaway container from the same image (`--network none`, 512 MB, 1 CPU, 60 s) to record what R prints and whether it draws. The run is not reported ready if any line errors, its plot/no-plot behaviour is wrong, or a capture pattern doesn't match. It writes `run/public/session.json` (the lessons and their modes) and `steps.json` for the coach. `run.sh` reports Ready only after the gateway answers and the host network has settled (finding 7). |
| Runtime | `runtime/Dockerfile`, `runtime/rstudio-prefs.json`, `runtime/03_lab_project` | `rocker/rstudio:4.6.2@sha256:ab667f41…` (RStudio Server 2026.11.0+203, R 4.6.2). The preferences show the sidebar on the right and hide Posit Assistant. Admin settings in `/etc/rstudio/rsession.conf` lock out Posit Assistant and Copilot, so a learner can't turn them back on: `posit-assistant-enabled`, `posit-assistant-installation-enabled`, `copilot-enabled` and the two `allow-*` options, all `0`. A container-init hook opens the run's project on first sign-in. |
| Gateway | `gateway/nginx.conf` | `nginx:1.30.7-alpine` (stable branch). Proxies everything, including WebSockets and long-polls. Only the IDE host page (`location = /`) is rewritten, with the coach script tag placed right after `<head>`. `/coach/api/session` and `/coach/api/steps` serve the run's public files. `/coach/api/check` is a stub. |
| Coach | `coach/coach.js` | Vanilla JS in a Shadow DOM, about 1,800 lines. Contains the keyboard shield, docking and floating placement, an overlay with the highlight box and the pointer, the lesson and mode picker, the fresh start (script reset, Environment, Plots and Console cleared), the RStudio driver (Demonstration and Show me), the Console watcher (Guided and Solo), and the regional-revenue Guided stub. |
| Audits | `tests/coach_in_ide.cjs`, `tests/demo_mode.cjs`, `tests/practice_modes.cjs` (shared helpers in `tests/lib.cjs`) | Playwright on headless Chromium. They drive the real IDE through the gateway, using only the coach's visible buttons and the keyboard, as a learner would; they never call coach internals to complete a step. They write `results/*.json` and screenshots to a local, git-ignored `results/` folder. |

## Docking into the sidebar

RStudio 2026.11 has a full-height **Sidebar** pane. It is configured through `panes.sidebar_visible`, `sidebar_location` and `sidebar` in the user preferences, and by default holds Posit Assistant's Chat tab. The runtime turns the sidebar on (right-hand side) and Posit Assistant off. The coach mounts inside `#rstudio_Sidebar_pane` and covers its contents. A lab coach should not sit next to an AI assistant that could do the exercise anyway.

- RStudio lays out the other panes around the sidebar, so the coach covers none of them. That holds at 1366×768 (a 362 px column), 1440×900 (382 px) and 1920×1080 (511 px). Before docking, the floating card covered 37% of the Files/Plots pane at 1366×768.
- If the learner hides the sidebar (toolbar button), the coach floats, with collapse and drag. When the sidebar is shown again, it re-docks.
- **Hiding the sidebar deletes that pane's DOM, coach included.** The first version mounted a new coach, losing typed text and orphaning a running demo. The coach now keeps its element and re-attaches that same element. The audits check this mid-demo: the step still finishes, the coach is mounted exactly once, and the floating drag position is cleared on re-dock.

## Choosing a lesson and a mode

A new run opens the coach on a picker. Under **Choose a lesson** are two compact cards, one per lesson, each with its title and the functions it covers (`4 steps: plot(), type = "l", pie(), barplot()`). The selected one is marked like a radio button. Below them, **How do you want to work through it?** offers three mode cards. Everything stays in view without scrolling in the docked coach at 1366×768, where the last card ends at 580 px. A one-lesson run (`./run.sh up graphical-tools`) shows the lesson's title and summary instead of the lesson cards. Until the learner picks a mode, the coach does nothing in RStudio. The header shows the chosen mode, and **Change lesson or mode** (**Change mode** in a one-lesson run) returns to the picker at any time.

Both lessons live in one RStudio project and one R session, so `graphical-tools.R` and `statistical-tools.R` sit side by side in the Files pane, and switching lesson needs no new run.

| Mode | Who works RStudio | When results are shown |
| --- | --- | --- |
| **Demonstration** | The coach, with its pointer and typing (below). | After each step, with an explanation. |
| **Guided** | The learner, one step at a time. **Hint** gives up to three hints per line: where to type it and how to run it (highlighting the Source pane), how it starts (`plot(…)`), then the whole line. **Show me** makes the coach type and run that one line, exactly as in Demonstration. | Each line is ticked as soon as RStudio shows its result; the step's explanation follows. An R error is quoted back, and a line that runs but gives a different result gets a nudge. A debrief at the end counts steps done without help, hints read and lines the coach showed. |
| **Solo** | The learner, with the whole task list. One hint per line (how it starts), counted in the results. | Only when the learner presses **Check my work**: each line ticked or not, and hints used. When every line is done, the steps' explanations are offered. |

### Every choice starts afresh

Choosing a mode on the picker starts that lesson from scratch, whatever ran before, in any mode of either lesson. Before the mode opens, the coach puts the lesson's script back to the step headings it was provisioned with (`provision.py` publishes that text in `steps.json` as `starter`). It saves the script and clears its undo history, so Ctrl+Z can't bring the old code back. Then it empties R the way a learner would, with the brooms on the Environment pane (**Clear objects**, hidden objects included) and the Plots pane (**Clear all Plots**). It confirms each in RStudio's own dialog, and uses each only when there is something to clear. Last, it clears the Console. Demonstration's **Start over** does the same, then runs step 1 by itself, so every line is typed again. A reset takes under a second. The panel says what is happening and offers nothing to press until it finishes. If part of it fails (say the learner deleted the script), the mode still opens, with a red note saying what wasn't reset.

The first version kept everything when the mode changed. A learner who watched step 1 of the demonstration and then chose Guided found `plot(5, 5)` already written under step 1's heading, and its chart already in the Plots pane.

The reset first used **Restart R**, which would also unload packages (these lessons load none). In a session's first half-minute, though, RStudio holds a restart back: one asked for 7 s after sign-in took 23.6 s, and one at 5 s took 12.6 s, against 1–2 s once the session was 40 s old. The session was idle meanwhile, with no outbound connections, so the cause is inside RStudio. That window is exactly when a learner picks their first mode, and the first audit run with a restart failed 16 of 19 probes on it. While R restarts, RStudio also drops requests to open or save a file and to clear the Console. With the brooms instead, a reset that cleared objects and a chart took 0.8 s, 15 s into a session.

Two details of RStudio's controls matter here. **Clear all Plots** does nothing unless the Plots tab is showing, so the coach shows it first. The dialogs' Yes buttons have no fixed id (`rstudio_dlg_ok` in one, `rstudio_dlg_yes` in the other), so the coach finds the dialog by its title and the button by its label.

The chosen lesson, its mode and the mode's progress are kept per run in `sessionStorage`, so a reload reopens them where they were, without a reset. Choosing a mode forgets the progress of every other mode and lesson, because it no longer matches the script or R. Pressing **Change lesson or mode** may be a slip, so the picker then offers **Back to Guided** (or whichever mode was open, with the lesson's name when the run has two). This returns to the mode just left, as it was. Back isn't offered after **Stop**.

### How Guided and Solo recognise the learner's work

The coach reads what RStudio shows, not keystrokes, so the Console and the script (Ctrl+Enter or Run) both work.

- **A line that prints something** counts when the Console shows output with the same tokens as the reference, without an error, however it was written. `max(airquality$Temp)` counts for `max(sample_data$Temp)`.
- **A line that prints nothing** (an assignment or a chart) counts when the command matches the reference, ignoring spaces, comments and quote style, and reading `=` as `<-` for an assignment. `slices = c(50,20,30)` counts. A chart line also needs a new chart in the Plots pane after the command.
- **Only work done in this mode counts.** The coach notes where the Console stood when the mode was chosen. After a reload, RStudio refills the Console with earlier output, so a reopened mode waits until the Console has been quiet for 1 s before deciding where it stood. A chosen mode counts from the click, so a learner who types at once isn't missed. The first version waited for quiet in both cases, and the audit caught it missing lines typed within 1.5 s of choosing.
- These lessons hide nothing (their code and output are public), so the check runs in the page. A lesson with a private answer needs the server-side grader (plan §4).

### Audit results (`tests/practice_modes.cjs`)

The audit works as a learner: it clicks the coach's buttons and types into the Console and Source pane with the keyboard. It reads the coach's state only to know when to look.

| Probe | Result |
| --- | --- |
| A new run opens on Demonstration, Guided and Solo, all in view in the docked coach, and the coach clicks and types nothing until one is chosen (1440×900 and 1366×768) | Pass. Lowest card ends at 516 px and 535 px. |
| Guided: `plot(5, q)` gets R's error quoted back; `plot(4, 4)` gets a nudge; neither counts | Pass |
| Guided: `plot(5,5)` typed in the Console counts for `plot(5, 5)` once a new chart has loaded, then the step's explanation appears | Pass |
| Guided: three hints arrive one per click; **Show me** types and runs the line with the pointer and the spotlight, saves it under the step heading, and is recorded as shown; nothing stays dimmed afterwards | Pass. 4 clicks on the pointer and in the spotlight, 20 keystrokes for 20 characters. |
| Guided: lines typed below the heading in the script and run with Ctrl+Enter count, including `slices = c(50, 20, 30)` for `<-` | Pass |
| Guided: reload mid-step keeps the mode and progress | Pass |
| Guided: finishing step 4 shows the debrief | Pass. 3 of 4 steps without help, 3 hints read, 1 line shown. |
| Solo: **Change mode** returns to the picker, which offers **Back to Guided**. Solo starts afresh: `graphical-tools.R` holds only its headings (saved, with no undo history), and Guided's objects, chart and Console lines are gone. Solo lists all 7 tasks; a line that counts is recorded but not shown before **Check my work** | Pass. Reset in 0.7 s. |
| Solo: after a reload, Solo keeps the line it saw, and nothing run in Guided counts | Pass |
| Solo: the check shows 1 of 7; a hint is counted; after the other six lines, the result changes only when the learner checks again, then shows all 7 and the explanations | Pass |
| Solo (statistical): `max(airquality$Temp)` counts for `max(sample_data$Temp)`, and `sample_data = airquality` for `<-`; `mean(…, trim = 0.1)` prints a different number and doesn't count | Pass. 2 of 8. |
| Guided (statistical): starts afresh after Solo (`sample_data` is gone, the script holds only its headings). After the learner removes `sample_data`, **Show me** quotes R's error and doesn't count the line. Once it is restored, **Show me** runs the line already typed, with no keystrokes | Pass |
| Two lessons (the default run, 1366×768): two lesson cards above three mode cards, all in view, Graphical selected; the project holds both scripts; the coach acts on nothing | Pass. Last card ends at 580 px. |
| Two lessons: Statistical, then Solo, opens that lesson (8 tasks) and counts `max(airquality$Temp)` | Pass |
| Two lessons: **Change lesson or mode** remembers Statistical; Graphical in Demonstration opens `graphical-tools.R` from Files (next to `statistical-tools.R`) and finishes step 1 with the pointer and typing | Pass. 3 clicks on the pointer, 10 keystrokes. |
| Two lessons: reload reopens Graphical Demonstration at step 2. **Change lesson or mode** offers **Back to Demonstration: Graphical tools in base R**, which returns to step 2 with nothing reset (`plot(5, 5)` and its chart still there) | Pass |
| Two lessons, the reported case: Demonstration step 1, then Guided. `plot(5, 5)` is gone from the script on screen and on disk, the Console, Environment and Plots are empty, and Guided starts at step 1 with nothing done. The learner's own `plot(5, 5)` then counts | Pass. Reset in 0.45 s. |
| Two lessons: Statistical Solo starts afresh too. Graphical's chart is gone, the Console is empty, and the line Solo saw earlier no longer counts | Pass. 0 of 8. |

19/19 passed, with no warnings or page errors.

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

The coach works RStudio the way a learner would, so the learner can watch the whole workflow.

- **The panel.** Before the first step, the coach introduces the lesson and lists its steps. Once the learner presses **Start demonstration** (or **Next**), that overview gives way to the current step alone: its heading, then one "now" line saying what the coach is doing, then, once RStudio shows the result, the step's explanation. Each line of code is narrated by what it is for, from the run's `purpose` in `scenario.json`: "Writing code to draw a line through the numbers 1 to 10". `provision.py` refuses a Demonstration or Guided lesson with a line that has no `purpose`, because Show me narrates the same way. After a reload, the overview comes back with the steps done so far ticked, until the learner presses **Next**.
- **The pointer.** An amber mouse pointer, labelled as the coach's in the card during the first step, starts at the coach button the learner pressed. It glides along a slight curve, easing in and out, to each thing the coach clicks. Every synthetic click carries the pointer's coordinates, so it lands where the learner sees it. The pointer fades out while the coach types, as most systems hide the mouse during typing, and at the end of each step. With `prefers-reduced-motion`, it jumps instead of gliding.
- **The typing.** Code is typed through Ace's `insert`, one character at a time, at about 70 ms per key (ELK Guide's rate). The gap varies from 0.6× to 1.4×, with a little extra after a space and a short pause before a `#` comment. RStudio's auto-pairing runs as it does for a learner: `(` also inserts `)`, and the `)` typed later steps over it. All 15 scenario lines come out exact. `localStorage.rsCoachTypeMs` changes the rate.
- **The spotlight.** While the coach works, RStudio is dimmed except for what it acts on, and the coach panel stays bright so its narration can be read. This is ELK Guide's spotlight: an amber ring arrives wide, closes in on its target and pulses once, and each new target replays that entrance. The spotlight follows its target every frame:
  - the file in Files, the **Run** and **Save** buttons;
  - the step's heading plus the line being typed, across the editor;
  - while R runs, the Console or Plots pane, then exactly what R printed (the echoed command and its output), the chart, or, after an assignment, the new variable's row in Environment.

  The dimming is a fixed layer cut by a `clip-path` with two holes, the spotlight and the coach panel, because a single `box-shadow` (ELK's way) would dim the coach too. With `prefers-reduced-motion`, the rings fade in instead.
- **The pace: the learner's turn to read.** The narration is a "now" line in the card, amber-edged and fading in on each change, in plain words: "Writing code to find the mean (average) temperature", "Pressing Run to send this line to the Console (Ctrl+Enter does the same)", "R printed `[1] 77.88235` in the Console", "`slices` now appears in the Environment pane (an assignment prints nothing in the Console)". As with ELK Guide's reading beats, each line then waits for the learner. Before a click (opening the script, **Run**, **Save**), the line announces it, and the countdown runs with the spotlight already on the control. After typing or a result, the countdown runs with the code or the result in the spotlight. Each explanation except the last waits the same way, and the next step then starts by itself. The wait is 5 s for up to 60 characters, plus 3 s each time the text doubles in length (`rsCoachReadMinMs`, `rsCoachReadStepMs`): 5 s for "Saving graphical-tools.R", 5.8 s for the Run line, 6.9 s for the longest line, and 10–12.6 s for the explanations. The green button counts the wait down ("Advance · 5s", "Next: step 3 · 12s") while a blue bar fills under the card; while the coach acts, the bar sweeps amber, like ELK's. **Advance** ends the wait on screen at once. Pressed while the coach is still acting, it reads "Advancing when ready…" and ends the next wait as soon as that starts, but never an explanation's. R's own run isn't a turn to read: "Pressing Run…" stays up until R answers, and only a line still running after 1.5 s says so. Show me in Guided keeps its own pace with no countdown: 0.7 s before each click (`rsCoachLeadMs`) and 2.4 s on each result (`rsCoachDwellMs`). All these settings are `localStorage` numbers in milliseconds, like `rsCoachTypeMs`.

1. If the script isn't already the active Source tab, the pointer opens it from the Files pane.
2. For each line, the coach looks below the step's `# Step N.` heading, up to the next heading.
   - If the line isn't there, the pointer clicks at the end of the step's last non-blank line (at first, the heading itself). The coach presses Enter and types the line.
   - If the line is already there (typed in an earlier attempt at the step, or by the learner, which is common for Show me in Guided), the pointer clicks at its start, and the coach runs it as it is, without typing it twice. Clicking at the end of one of the article's long commented lines scrolled the editor sideways and hid the code.
3. The pointer presses **Run** with no selection, which sends the cursor's line, comment included. RStudio treats a comment directly above a statement as part of it, so the first line of each step also echoes its heading in the Console. That is also what a learner would see pressing Ctrl+Enter there. GWT ignores a bare `.click()`, so presses are a synthetic pointer and mouse down/up/click sequence.
4. The coach waits until the Console echoes the line. The output after the echo must have the same tokens as the reference output, and a plotting line must show a new, fully loaded `/graphics/<id>.png` in the Plots pane. All of that must stay true for 300 ms. Token comparison tolerates RStudio wrapping output to fit a narrow Console.
5. Only then does it read each captured value from the Console text and compare it with the reference. The spotlight then moves to the result and holds there.
6. After the last line, the pointer presses **Save** if the script has unsaved changes, and the coach waits for the tab's unsaved marker to clear. The dimming then lifts, an evidence ring (ELK's, without dimming) stays on what the step printed or drew, and the explanation appears, filled with the captured values. The ring stays until the next step starts: when the learner presses **Next**, or when the explanation's countdown ends.

**Failures stop visibly.** The step turns red, the card says why, and **Try this step again** and **Start over** appear. Tested cases:

- The script lost a step's heading, so the coach can't tell where the code goes. Message: `graphical-tools.R no longer has the line # Step 1. Plots: plot(), so the coach can't tell where step 1 goes…`. The coach types and runs nothing.
- R raised an error. Message: `R reported: Error: object 'sample_data' not found`, shown immediately. RStudio prints errors after its inline "Show Traceback / Rerun with Debug" links, so the check looks for them there too.
- No echo, no chart, or different output within 20 s. The message names which of these happened.

Handled but not audited: if the learner moves the cursor while the coach is typing, the coach puts it back. If the typed line still doesn't match, for example because the learner typed into it, the step stops with `Line 8 of graphical-tools.R reads … instead of …`.

Progress is kept per run in `sessionStorage`, so a reload resumes at the next step. **Start over** starts afresh (see [Every choice starts afresh](#every-choice-starts-afresh)) and types every line again. **Stop** ends the demo, and no further RStudio actions happen after it, keystrokes included. A line stopped part-way stays as typed, unsaved. The coach looks up RStudio elements again after every pause, because RStudio re-renders the Files list and toolbar when files change. The first version clicked a stale Files link and the open silently failed.

### Audit results (`tests/demo_mode.cjs`)

Each run starts by choosing **Demonstration** on the mode picker; after a reload the coach reopens in it.

| Probe | Result |
| --- | --- |
| Choosing Demonstration starts afresh: `graphical-tools.R` is open with only its headings, and the Console, Environment and Plots are empty. Coach docks in the sidebar and covers no other pane (1440×900 and 1366×768) | Pass. Reset in 0.26 s. |
| The learner deletes step 1's heading in the editor, so step 1 stops with a clear message before typing or running anything | Pass |
| After the learner undoes the edit, saves and closes the tab, **Try this step again** reopens the script from Files, types `plot(5, 5)` and passes | Pass |
| Graphical steps 2–3: typed, run, and explained only after a new chart is on screen. Nothing is pressed after step 2, so its explanation counts down ("Next: step 3 · 13s") and step 3 starts by itself | Pass. Step 3 started 12.2 s after step 2's explanation appeared (reading time 12.1 s). 25.9 s and 65.5 s per step with every line read in full (9.3 s and 22.3 s before the reading countdowns). |
| Hiding and re-showing the sidebar while step 4 is typed and run | Pass. Same coach, all 145 characters typed, step completes, re-docked geometry. |
| Reload keeps progress. **Start over** puts the script back to its headings and clears the objects, chart and Console from all four steps, then starts typing step 1 by itself. **Stop** after 4 characters halts the typing and RStudio | Pass. Reset in 0.54 s. The line stayed `plot` for 4 s, with no further actions or Console output, and the pointer, dimming and rings gone. |
| Statistical steps 1–2 at 1366×768, typed, quoting values the Console printed. **Advance** is pressed on the first countdown | Pass (`max=97`, `min=56`, `mean=77.88235`). The first countdown ("Writing code to copy R's built-in airquality data…") started at 6 s, and Advance moved on to "Pressing Run…" 0.16 s later. 74.4 s and 30.1 s. |
| Reload resumes at step 3 | Pass |
| The learner runs `rm(sample_data)`, so step 3 stops with R's error | Pass |
| **Start over** puts the script back to its headings (step 3's failed line is gone) and types all 5 steps again, and finishes | Pass. All 8 summary and percentile values match. 579 keystrokes for 579 characters; steps 2–5 took 30.2 s, 29.4 s, 55.1 s and 30.8 s. |
| The saved script holds all 8 lines once each, under their headings, with nothing unsaved | Pass |

At every explanation, the audit takes its own snapshot of the Console and Plots pane. It checks the reference output and every quoted value against that snapshot, independently of the coach's checks. Each finished step is also checked for:

- **The pointer:** every click the coach makes (a synthetic mousedown) lands within 2 px of the pointer's tip while the pointer is visible, and the pointer took at least 5 animation frames to get there.
- **The typing:** the edits Ace applied number no more than the characters typed and at least 70% of them, none is more than 2 characters, and the median gap is 35–250 ms. Measured: 65–77 ms, with one insert per character in every step. A step whose code was already in the script must record no keystrokes.
- **The save:** the script on disk holds the step's lines directly below its heading, each exactly once, and no tab shows an unsaved marker.
- **The panel and the reading time** (steps run by `runSteps`): every line the card narrated, from Start to the explanation, appeared with the lesson overview hidden. For each line of code, the card said "Writing code to <purpose>", or "The code to <purpose> is already in the script…" for a line run again. Every line stayed up for at least its reading time, worked out independently by the audit (5 s up to 60 characters, plus 3 s per doubling), except a line the audit pressed **Advance** on and R's "still running" note. Before the first Start, and after a reload, the overview is shown instead.
- **The spotlight:** every coach click happened with RStudio dimmed and the click point inside the spotlight ring, and every typed key with the caret's line inside it. The caret's x isn't checked, because Ace reports each edit before it scrolls sideways to follow the caret along a long line; the first version of this check failed on exactly that, at x −86. When the explanation appears, the dimming has lifted and an evidence ring at least 15 px tall sits on the Console (or, for a chart step, the Plots pane). A failed step also leaves nothing dimmed.

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

## Remote playground (iximiuz Labs)

The public playground is [`rstudio-guide-16afe14e`](https://labs.iximiuz.com/playgrounds/rstudio-guide-16afe14e). Anyone can list, view and start it (`accessControl: anyone` in `iximiuz/manifest.yaml`); each session runs on the quota of the person who starts it.

It runs from a published **rootfs image**, `ghcr.io/lpmi-13/rstudio-guide-rootfs`. It is built on iximiuz's Docker base (`ubuntu-docker-c36cb070`) and carries this repository, the terminal banner, and the RStudio runtime and gateway images, preloaded so no Docker Hub pull is needed. Publishing works like argo-remotelab's `scripts/publish-rootfs-image.sh`.

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

**What a learner sees:** the playground opens on **Terminal**, which prints the RStudio username and this run's password. If RStudio is still starting, the terminal waits and then prints them. A second tab, **RStudio**, shows the IDE inside the playground page with the coach docked. That makes one click plus sign-in. Both lessons are in the run, so the learner picks one in the Coach pane, as the terminal banner and the playground's description say. `./run.sh up statistical-tools` still starts a one-lesson run; a new terminal then shows the new password.

### How it works

- **Init:** the manifest's single init task runs `iximiuz/start-lab.sh`. On first start it does `docker load` on `/opt/rstudio-guide/images.tar`, then runs `./run.sh up` (both lessons; versions up to v2 started `graphical-tools` only).
- **`lab.env`** is baked into the rootfs with `FRAME_ORIGIN=https://labs.iximiuz.com`, `GATEWAY_BIND=0.0.0.0` and `LAB_PREBUILT=1`. Every later `./run.sh up` keeps these, so switching scenario keeps the RStudio tab working and never rebuilds or pulls. Values set in the environment still win.
- **The RStudio tab** is an `http-port` tab on 8788 with private access: only the person who started that session can open it, even though anyone can start the playground. RStudio allows `labs.iximiuz.com` to frame it via `www-frame-origin`, set at container start by `runtime/04_lab_frame_origin`. The coach skips only frames nested *inside* RStudio, so it runs when RStudio itself is framed.
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

**The public playground** (`rstudio-guide-16afe14e`, v2) was started with `labctl playground start --as-free-tier-user` on 19 November 2026. The init task completed and the command returned in **62 s**. The terminal banner showed the graphical-tools sign-in, and the gateway answered by machine name. The playground page loaded without an iximiuz login.

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

- The RStudio tab on v2, signed in by hand. The same mechanism was confirmed on the earlier version.

## Plan deviations and open points

- **Demonstration control uses RStudio's own UI, not `rstudioapi`.** The plan proposed an addin calling `rstudioapi::sendToConsole()`. That needs an R-side trigger and a package the image doesn't have. Typing into the real Source pane and pressing the real Run button, with a visible pointer, works without either. It also shows the learner the exact workflow they will use.
  - Trade-off: it depends on DOM details (finding 4).
  - Rejected alternatives: RStudio's internal `/rpc/console_input` and the undocumented `window.dispatchRStudioCommandExternal`.
- **The demo data are fixed.** Both scenarios use the article's literal values and R's built-in `airquality` data. The plan's per-run variation by scenario key does not apply to them yet.
- **The article's "Lines" text and code disagree.** The text describes `lines()`, which adds to an existing plot, but the code is `plot(1:10, type="l")`, which draws a new one. The demo runs the article's code and the narration explains both.
- **Expected values reach the browser in every mode of these two lessons.** Their code and output are public (they come from the article), and nothing is scored, so Guided and Solo check in the page. A scored mode, or a lesson with a private answer such as `regional-revenue`, must not do this (plan §4).
- **Solo is the plan's Challenge mode**, under the product name ELK Guide uses. It is not scored yet: it counts hints and discloses results only on request, but has no score or replay with fresh values.
- **Not covered yet:** saved-code grading, clean replay by key, launch handoff, headed Chrome and Firefox, and a security review. Same-origin coach code can call RStudio's RPC endpoints.
