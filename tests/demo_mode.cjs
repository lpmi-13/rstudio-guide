// Demonstration-mode audit. For each lesson it provisions a fresh run, signs in
// through the gateway, chooses Demonstration on the coach's mode picker, and
// drives the coach only through its visible buttons, the way a learner would.
// It never calls the coach's internals to complete a step.
//
// It checks that:
// - the coach docks into the sidebar without covering any other pane;
// - every click the coach makes lands where its visible pointer is, and the
//   pointer glides there rather than jumping;
// - the panel introduces the lesson until a step starts; from then on it shows only the
//   current step, narrated line by line by what each line is for ("Writing code to ...");
// - every narrated line stays up for its reading time (5 s or more, longer for longer text),
//   counted down on the button; Advance ends a countdown at once, and with nothing pressed an
//   explanation counts down and the next step starts by itself;
// - while the coach works, RStudio is dimmed and every click and keystroke is
//   inside the spotlight; when a step is explained, the dimming has lifted and
//   an evidence ring marks the Console output or the chart;
// - code is typed into the script one key at a time, at a person's pace, and
//   saved;
// - choosing Demonstration, and Start over, start afresh: the script holds only its
//   step headings and the Console, Environment and Plots are empty, and
//   Start over then types every step again;
// - each step's explanation appears only once RStudio shows the matching
//   Console output, or a newly loaded chart;
// - the explanation quotes values that are on screen;
// - failures stop the demonstration visibly and can be recovered;
// - reload resumes, and Stop halts further RStudio actions, typing included.
//
//   NODE_PATH=$(npm root -g) node tests/demo_mode.cjs [results-dir]
const {chromium} = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const {
  ROOT, audit, assert, tokens, provision, warnings, signIn, waitForCoach, coachEl,
  now, record, editorLines, verifyPointer, verifyTyping, verifySpotlight, overlayState, plotSrc, dockedGeometry,
  rstudioState, verifyFresh, waitForFreshStart, freshStarts,
} = require('./lib.cjs');

const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'results'));
const {results, probe} = audit(OUT);

// The script on disk holds each line of steps 0..last directly below its heading, once.
function verifySaved(scriptPath, manifest, last) {
  const lines = fs.readFileSync(scriptPath, 'utf8').split('\n');
  for (const step of manifest.steps.slice(0, last + 1)) {
    const at = lines.indexOf(step.heading);
    assert(at >= 0, `the saved script has no ${step.heading}`);
    step.runs.forEach((run, k) => assert(lines[at + 1 + k] === run.code, `saved line ${at + 2 + k} is ${JSON.stringify(lines[at + 1 + k])}, not ${run.code}`));
    for (const run of step.runs) {
      const count = lines.filter(line => line === run.code).length;
      assert(count === 1, `the saved script has ${run.code} ${count} times`);
    }
  }
}
const unsavedTabs = page => page.evaluate(() => [...document.querySelectorAll('#rstudio_Source_pane [role="tab"]')]
  .map(t => t.innerText.trim()).filter(t => t.includes('*')));

const coachView = page => page.evaluate(() => {
  const root = document.getElementById('rs-coach-host').shadowRoot;
  return {
    steps: [...root.querySelectorAll('li[data-step]')].map(li => li.className || 'pending'),
    go: root.querySelector('.go')?.textContent,
    goDisabled: root.querySelector('.go')?.disabled,
    restartShown: root.querySelector('.restart') ? !root.querySelector('.restart').hidden : false,
    explain: root.querySelector('.explain')?.textContent || '',
    ended: root.querySelector('.ended')?.textContent || '',
    overview: Boolean(root.querySelector('.overview')?.offsetParent), // lesson intro and step list
    card: Boolean(root.querySelector('.card')?.offsetParent),
    placement: window.__rsCoach.placement,
  };
});

// From now on, record each change to the line the card narrates (cleared, too), when it
// happened, and whether the lesson overview was on screen alongside it.
const logNarration = page => page.evaluate(() => {
  const root = document.getElementById('rs-coach-host').shadowRoot;
  window.__narration?.observer.disconnect();
  const log = (window.__narration = {lines: [], observer: null});
  const visible = sel => Boolean(root.querySelector(sel)?.offsetParent);
  log.observer = new MutationObserver(() => {
    const text = root.querySelector('.phase')?.textContent || '';
    if (text !== (log.lines.at(-1)?.text ?? '')) log.lines.push({t: performance.now(), text, overview: visible('.overview'), card: visible('.card')});
  });
  log.observer.observe(root, {subtree: true, childList: true, characterData: true, attributes: true});
});
const narration = page => page.evaluate(() => window.__narration.lines);

// How long the coach must leave a text up for the learner to read, by this audit's own reading of
// the spec: 5 s for up to 60 characters, then 3 s more each time the text doubles in length.
const readingMs = text => 5000 + 3000 * Math.log2(Math.max(1, text.trim().length / 60));

// While a step ran, the card stood alone (no lesson overview), said what each line is for, and
// left every line up for its reading time. Exempt: lines the learner pressed Advance on, and
// R's "still running" note, which goes as soon as R answers.
function verifyNarration(lines, step, typed, advanced = []) {
  const shown = lines.map((l, k) => ({...l, ms: (lines[k + 1]?.t ?? Infinity) - l.t})).filter(l => l.text);
  assert(shown.length > 0, 'the card narrated nothing');
  const crowded = shown.find(l => l.overview || !l.card);
  assert(!crowded, `"${crowded?.text}" was narrated with the lesson overview still shown (or the card hidden)`);
  for (const run of step.runs) {
    const purpose = run.purpose.replace(/`/g, ''); // backticks become <code>
    const want = typed ? `Writing code to ${purpose}` : `The code to ${purpose} is already in the script`;
    assert(shown.some(l => l.text.startsWith(want)), `the card never said "${want}": ${JSON.stringify(shown.map(l => l.text))}`);
  }
  const hurried = shown.find(l => !/^R is still/.test(l.text) && !advanced.includes(l.text) && l.ms < readingMs(l.text) - 150);
  assert(!hurried, `"${hurried?.text}" was up for ${Math.round(hurried?.ms)} ms, short of its ${Math.round(readingMs(hurried?.text || ''))} ms reading time`);
  return shown.map(l => `${l.text} (${(l.ms / 1000).toFixed(1)} s)`);
}

// The learner presses Advance during the step's first countdown. The button counted down from
// the text's reading time (at least 5 s), and the wait ends at once: the narration moves on, or
// the button stops counting. When the next line is narrated in the same tick (the click on Run
// after "Writing code to ..."), the button never shows a bare "Advance" in between.
async function pressAdvance(page) {
  const at = await page.waitForFunction(() => {
    const root = document.getElementById('rs-coach-host').shadowRoot;
    const m = /^Advance · (\d+)s$/.exec(root.querySelector('.go').textContent);
    return m && {seconds: +m[1], text: root.querySelector('.phase').textContent, t: performance.now()};
  }, null, {timeout: 30000, polling: 20}).then(h => h.jsonValue());
  const need = Math.ceil(readingMs(at.text) / 1000);
  assert(at.seconds >= 5 && at.seconds >= need - 1 && at.seconds <= need, `"${at.text}" counted down from ${at.seconds} s; its reading time rounds up to ${need} s`);
  await coachEl(page, 'button.go').click();
  const after = await page.waitForFunction(text => {
    const root = document.getElementById('rs-coach-host').shadowRoot;
    const go = root.querySelector('.go').textContent;
    const phase = root.querySelector('.phase').textContent;
    return go.includes('·') && phase === text ? null : {go, phase, t: performance.now()};
  }, at.text, {timeout: 5000, polling: 20}).then(h => h.jsonValue());
  const waited = after.t - at.t;
  assert(waited < readingMs(at.text) - 2000, `Advance ended "${at.text}" ${Math.round(waited)} ms into its countdown`);
  return {text: at.text, countedFrom: at.seconds, advancedAfterMs: Math.round(waited), then: after.phase || after.go};
}
// Wait for step i to finish or fail. The snapshot is taken in the same poll in which the
// explanation first appears, so it shows exactly what RStudio displayed at that moment.
async function settleStep(page, i) {
  const handle = await page.waitForFunction(i => {
    const root = document.getElementById('rs-coach-host')?.shadowRoot;
    const li = root?.querySelector(`li[data-step="${i}"]`);
    const explain = root?.querySelector('.explain')?.textContent || '';
    if (!li) return null;
    const failed = li.classList.contains('failed');
    if (!failed && !(li.classList.contains('done') && explain && window.__rsCoach.demo.state !== 'running')) return null;
    let plot = null;
    for (const f of document.querySelectorAll('#rstudio_workbench_panel_plots iframe')) {
      try { const img = f.contentDocument.querySelector('img'); if (img) plot = {src: img.src, loaded: img.complete && img.naturalWidth > 0}; } catch (_e) { /* ignore */ }
    }
    const overlay = document.getElementById('rs-coach-overlay')?.shadowRoot;
    const rect = el => (el && !el.hidden ? el.getBoundingClientRect().toJSON() : null);
    const pane = id => document.getElementById(id)?.getBoundingClientRect().toJSON();
    return {failed, explain, console: document.getElementById('rstudio_console_output').textContent, plot, t: performance.now(),
      dim: Boolean(overlay?.querySelector('.dim.on')), spot: rect(overlay?.querySelector('.spot')), ring: rect(overlay?.querySelector('.box')),
      panes: {console: pane('rstudio_Console_pane'), plots: pane('rstudio_workbench_panel_plots')}};
  }, i, {timeout: 120000, polling: 50});
  return handle.jsonValue();
}

// Independent check of one finished step against the manifest and the snapshot.
function verifyStep(step, snap, plotBefore, allValues) {
  assert(!snap.failed, `step failed: ${snap.explain}`);
  for (const run of step.runs) {
    const echo = `> ${run.code}`;
    const at = snap.console.lastIndexOf(echo);
    assert(at >= 0, `Console never showed ${echo}`);
    const rest = snap.console.slice(snap.console.indexOf('\n', at) + 1);
    const next = rest.search(/^> /m); // the next echoed command, if any
    const output = next < 0 ? rest : rest.slice(0, next);
    assert(tokens(output) === tokens(run.expected_output), `output for ${run.code} was ${JSON.stringify(output)}; reference ${JSON.stringify(run.expected_output)}`);
  }
  const charted = step.runs.some(r => r.evidence === 'plot');
  if (charted) {
    assert(snap.plot && snap.plot.loaded && snap.plot.src !== plotBefore, `no new chart when the explanation appeared (${JSON.stringify(snap.plot)})`);
  }
  // The dimming has lifted, and a ring marks what the explanation talks about.
  assert(!snap.dim && !snap.spot, 'RStudio was still dimmed when the explanation appeared');
  const pane = charted ? snap.panes.plots : snap.panes.console;
  const overlaps = snap.ring && pane && snap.ring.left < pane.right && snap.ring.right > pane.left && snap.ring.top < pane.bottom && snap.ring.bottom > pane.top;
  assert(overlaps && snap.ring.height >= 15, `no evidence ring on the ${charted ? 'Plots pane' : 'Console'} when the explanation appeared: ${JSON.stringify(snap.ring)}`);
  const quoted = [...step.explain.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
  for (const name of quoted) {
    const value = allValues[name];
    assert(value !== undefined && snap.explain.includes(value), `explanation lacks ${name}=${value}`);
    assert(snap.console.includes(value), `explanation quotes ${name}=${value}, which the Console does not show`);
  }
  return quoted.map(n => `${n}=${allValues[n]}`);
}

// Everything a learner should see in one finished step: the pointer, the typing (or none, when
// the step's code was already in the script), the evidence, and the saved script.
async function verifyStepFully(page, manifest, i, snap, since, {plotBefore, allValues, scriptPath, typed}) {
  const step = manifest.steps[i];
  const quoted = verifyStep(step, snap, plotBefore, allValues);
  const rec = await record(page);
  const clicks = verifyPointer(rec, since, snap.t);
  const typing = verifyTyping(rec, since, snap.t, typed ? step.runs.map(r => r.code) : []);
  const spotlit = verifySpotlight(rec, since, snap.t);
  verifySaved(scriptPath, manifest, i);
  const unsaved = await unsavedTabs(page);
  assert(unsaved.length === 0, `unsaved changes shown on ${unsaved} when the explanation appeared`);
  return {quoted, clicks, ...typing, spotlitKeys: spotlit.spotlitKeys};
}

// `auto`: after the first step, press nothing; each explanation must count down and then start
// the next step by itself. `advance`: press Advance once, during the first step's first countdown.
async function runSteps(page, manifest, from, to, tag, {scriptPath, typed = true, auto = false, advance = false}) {
  const allValues = Object.assign({}, ...manifest.steps.flatMap(s => s.runs.map(r => r.expected_values)));
  const done = [];
  let explained = null; // the previous step's snapshot, taken as its explanation appeared
  for (let i = from; i <= to; i++) {
    const plotBefore = await plotSrc(page);
    const t0 = Date.now();
    const since = await now(page);
    await logNarration(page);
    let auto_ = null;
    if (auto && explained) {
      const label = (await coachView(page)).go;
      assert(/^Next: step \d+ · \d+s$/.test(label), `the explanation's button read "${label}", with no countdown`);
      const started = await page.waitForFunction(i => {
        const li = document.getElementById('rs-coach-host').shadowRoot.querySelector(`li[data-step="${i}"]`);
        return li.classList.contains('active') ? performance.now() : null;
      }, i, {timeout: 60000, polling: 20}).then(h => h.jsonValue());
      const waited = started - explained.t;
      const need = readingMs(explained.explain);
      assert(waited >= need - 150 && waited <= need + 2500, `step ${i + 1} started ${Math.round(waited)} ms after the explanation, whose reading time is ${Math.round(need)} ms`);
      auto_ = {label, startedAfterMs: Math.round(waited), readingMs: Math.round(need)};
    } else {
      await coachEl(page, 'button.go').click();
    }
    const advanced = advance && i === from ? await pressAdvance(page) : null;
    const snap = await settleStep(page, i);
    const checks = await verifyStepFully(page, manifest, i, snap, since, {plotBefore, allValues, scriptPath, typed});
    const said = verifyNarration(await narration(page), manifest.steps[i], typed, advanced ? [advanced.text] : []);
    const view = await coachView(page);
    assert(!view.overview && view.card, `once step ${i + 1} was explained, the panel showed ${JSON.stringify(view)}`);
    await page.screenshot({path: path.join(OUT, `${tag}-step${i + 1}.png`)});
    explained = snap;
    done.push({step: i + 1, s: +((Date.now() - t0) / 1000).toFixed(1), ...checks, said,
      ...(auto_ ? {autoAdvance: auto_} : {}), ...(advanced ? {advanced} : {})});
  }
  return done;
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  // ---------------- graphical-tools ----------------
  {
    const password = provision('graphical-tools');
    const scriptPath = path.join(ROOT, 'run/project/graphical-tools.R');
    const original = fs.readFileSync(scriptPath, 'utf8');
    const context = await browser.newContext({viewport: {width: 1440, height: 900}});
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(`graphical: ${e.message}`));
    let manifest;

    await probe('graphical: sign in; choosing Demonstration opens the script, fresh; coach docks in the sidebar and covers no other pane', async () => {
      await signIn(page, password);
      manifest = await page.evaluate(() => fetch('/coach/api/steps').then(r => r.json()).then(s => s.lessons[0]));
      assert(manifest.starter === original, 'the coach would reset the script to something other than what was provisioned');
      const {last} = await waitForFreshStart(page, 1);
      verifyFresh(await rstudioState(page), manifest, scriptPath);
      const g = await dockedGeometry(page);
      assert(g.parent === 'rstudio_Sidebar_pane' && g.fills && Object.keys(g.overlaps).length === 0, JSON.stringify(g));
      const view = await coachView(page);
      assert(view.overview && !view.card, `before Start, the panel should introduce the lesson: ${JSON.stringify(view)}`);
      await page.screenshot({path: path.join(OUT, 'graphical-docked.png')});
      return {resetMs: last.ms, ...g};
    });

    await probe('graphical: a script without step 1\'s heading stops step 1 visibly, before typing', async () => {
      // The learner deletes the heading's text with the keyboard.
      const heading = manifest.steps[0].heading;
      const box = await page.locator('#rstudio_Source_pane .ace_line', {hasText: heading}).boundingBox();
      await page.mouse.click(box.x + 40, box.y + box.height / 2); // Ace's layers fail Playwright's click checks
      await page.keyboard.press('Home');
      await page.keyboard.press('Shift+End');
      await page.keyboard.press('Backspace');
      assert(!(await editorLines(page)).includes(heading), `the learner's edit did not remove ${heading}`);
      const since = await now(page);
      await coachEl(page, 'button.go').click();
      const snap = await settleStep(page, 0);
      const view = await coachView(page);
      assert(snap.failed && /no longer has the line # Step 1\. Plots: plot\(\)/.test(snap.explain), snap.explain);
      assert(!snap.dim && !snap.spot, 'RStudio stayed dimmed after the step failed');
      assert(view.go === 'Try this step again' && !view.goDisabled && view.restartShown, JSON.stringify(view));
      verifyTyping(await record(page), since, snap.t, []);
      assert(!snap.console.includes('> plot(5, 5)'), 'the coach ran a line after failing');
      await page.screenshot({path: path.join(OUT, 'graphical-step1-failed.png')});
      return {message: snap.explain.trim()};
    });

    await probe('graphical: after the script is restored, "Try this step again" passes', async () => {
      // The learner undoes their edit, saves and closes the script's tab; the coach must
      // reopen it from the Files pane.
      const first = await page.locator('#rstudio_Source_pane .ace_line').first().boundingBox();
      await page.mouse.click(first.x + 40, first.y + first.height / 2); // back into the editor
      await page.keyboard.press('Control+z');
      await page.keyboard.press('Control+s');
      await page.waitForFunction(() => ![...document.querySelectorAll('#rstudio_Source_pane [role="tab"]')].some(t => t.innerText.includes('*')), null, {timeout: 10000});
      assert(fs.readFileSync(scriptPath, 'utf8') === original, 'undo and save did not restore the script');
      const tab = page.locator('#rstudio_Source_pane [role="tab"]', {hasText: 'graphical-tools.R'});
      await tab.locator('img').last().click(); // the tab's close icon (unlabelled in this RStudio build)
      await tab.waitFor({state: 'detached', timeout: 10000});
      const plotBefore = await plotSrc(page);
      const since = await now(page);
      await coachEl(page, 'button.go').click();
      const snap = await settleStep(page, 0);
      const checks = await verifyStepFully(page, manifest, 0, snap, since, {plotBefore, allValues: {}, scriptPath, typed: true});
      await page.screenshot({path: path.join(OUT, 'graphical-step1.png')});
      return {explain: snap.explain.slice(0, 60), ...checks};
    });

    await probe('graphical: steps 2-3 typed, run and explained only after a new chart is on screen; with nothing pressed, step 2\'s explanation counts down into step 3', async () => runSteps(page, manifest, 1, 2, 'graphical', {scriptPath, auto: true}));

    await probe('graphical: hiding and re-showing the sidebar mid-step keeps the same coach and finishes step 4', async () => {
      const plotBefore = await plotSrc(page);
      const since = await now(page);
      await coachEl(page, 'button.go').click();
      await page.waitForFunction(() => window.__rsCoach.demo.state === 'running' && window.__rsCoach.demo.actions >= 1, null, {timeout: 15000});
      await page.click('#rstudio_sidebar_toggle_button');
      await page.waitForFunction(() => window.__rsCoach.placement === 'floating', null, {timeout: 10000});
      await page.waitForTimeout(1500);
      await page.screenshot({path: path.join(OUT, 'graphical-step4-floating.png')});
      await page.click('#rstudio_sidebar_toggle_button');
      await page.waitForFunction(() => window.__rsCoach.placement === 'docked', null, {timeout: 10000});
      const snap = await settleStep(page, 3);
      const checks = await verifyStepFully(page, manifest, 3, snap, since, {plotBefore, allValues: {}, scriptPath, typed: true});
      const mounts = await page.evaluate(() => window.__rsCoach.mounts);
      assert(mounts === 1, `coach re-mounted ${mounts} times`);
      const g = await dockedGeometry(page);
      assert(g.fills && Object.keys(g.overlaps).length === 0, `after re-docking: ${JSON.stringify(g)}`);
      await page.screenshot({path: path.join(OUT, 'graphical-step4.png')});
      const view = await coachView(page);
      assert(view.steps.every(s => s === 'done') && view.go === 'Demonstration complete' && view.goDisabled, JSON.stringify(view));
      return {mounts, panel: g.panel, ...checks};
    });

    await probe('graphical: reload keeps progress; Start over resets the script and R, then types step 1 again; Stop part-way through typing halts the typing and RStudio', async () => {
      await page.reload();
      await page.waitForSelector('#rstudio_console_input', {timeout: 90000});
      await waitForCoach(page);
      const restored = await coachView(page);
      assert(restored.steps.every(s => s === 'done') && restored.go === 'Demonstration complete' && restored.restartShown, JSON.stringify(restored));
      const before = await rstudioState(page);
      assert(before.chart && /frequencies/.test(before.environment), `the demonstration left nothing to reset: ${JSON.stringify(before).slice(0, 300)}`);
      const heading = manifest.steps[0].heading;
      const code = manifest.steps[0].runs[0].code;
      const fresh = await freshStarts(page);
      await coachEl(page, 'button.restart').click();
      const {last} = await waitForFreshStart(page, fresh + 1);
      verifyFresh(await rstudioState(page), manifest, scriptPath); // step 1 starts by itself, typing within a second
      // Stop once the line under the heading is partly typed.
      await page.waitForFunction(([heading, code]) => {
        const el = [...document.querySelectorAll('#rstudio_Source_pane .ace_editor')].find(e => e.offsetParent && e.env?.editor);
        const lines = el?.env.editor.session.getDocument().getAllLines() || [];
        const line = lines[lines.indexOf(heading) + 1] || '';
        return line.length >= 3 && line !== code;
      }, [heading, code], {timeout: 20000, polling: 10});
      await coachEl(page, 'button.stop').click();
      const state = () => page.evaluate(([heading]) => {
        const el = [...document.querySelectorAll('#rstudio_Source_pane .ace_editor')].find(e => e.offsetParent && e.env?.editor);
        const lines = el.env.editor.session.getDocument().getAllLines();
        const pointer = document.getElementById('rs-coach-overlay').shadowRoot.querySelector('.pointer');
        return {actions: window.__rsCoach.demo.actions, console: document.getElementById('rstudio_console_output').textContent.length,
          line: lines[lines.indexOf(heading) + 1], pointerShown: pointer.classList.contains('visible'),
          doneAfterStop: window.__rsCoach.log.filter(l => l.type === 'demo_step_done').slice(-1)[0]?.at > window.__rsCoach.log.filter(l => l.type === 'stop').slice(-1)[0]?.at};
      }, [heading]);
      const atStop = await state();
      await page.waitForTimeout(4000);
      const after = await state();
      const view = await coachView(page);
      assert(/demonstration has ended/.test(view.ended), JSON.stringify(view));
      assert(after.line === atStop.line, `typing continued after Stop: ${JSON.stringify(atStop.line)} became ${JSON.stringify(after.line)}`);
      assert(after.actions === atStop.actions && after.console === atStop.console && !after.doneAfterStop, `RStudio actions continued after Stop: ${JSON.stringify({atStop, after})}`);
      assert(!after.pointerShown, 'the coach pointer is still shown after Stop');
      const shade = await overlayState(page);
      assert(!shade.dim && !shade.spot && !shade.ring, `the overlay still shows after Stop: ${JSON.stringify(shade)}`);
      await page.screenshot({path: path.join(OUT, 'graphical-stopped.png')});
      return {restoredGo: restored.go, resetMs: last.ms, lineAtStop: atStop.line, actionsAtStop: atStop.actions};
    });
    await context.close();
  }

  // ---------------- statistical-tools (narrower window) ----------------
  {
    const password = provision('statistical-tools');
    const scriptPath = path.join(ROOT, 'run/project/statistical-tools.R');
    const context = await browser.newContext({viewport: {width: 1366, height: 768}});
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(`statistical: ${e.message}`));
    let manifest;

    await probe('statistical (1366x768): docked coach covers no other pane', async () => {
      await signIn(page, password);
      manifest = await page.evaluate(() => fetch('/coach/api/steps').then(r => r.json()).then(s => s.lessons[0]));
      const g = await dockedGeometry(page);
      assert(g.parent === 'rstudio_Sidebar_pane' && g.fills && Object.keys(g.overlaps).length === 0, JSON.stringify(g));
      return g;
    });

    await probe('statistical: steps 1-2 typed, then explained with values the Console printed; Advance ends a countdown at once', async () => runSteps(page, manifest, 0, 1, 'statistical', {scriptPath, advance: true}));

    await probe('statistical: reload resumes at step 3', async () => {
      await page.reload();
      await page.waitForSelector('#rstudio_console_input', {timeout: 90000});
      await waitForCoach(page);
      const view = await coachView(page);
      assert(view.steps[0] === 'done' && view.steps[1] === 'done' && view.go === 'Next: step 3', JSON.stringify(view));
      assert(view.overview, `after a reload, the panel should show the lesson with its progress: ${JSON.stringify(view)}`);
      return {go: view.go};
    });

    await probe('statistical: an R error stops step 3 visibly (learner removed sample_data)', async () => {
      await page.click('#rstudio_console_input');
      await page.keyboard.type('rm(sample_data)');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(800);
      await coachEl(page, 'button.go').click();
      const snap = await settleStep(page, 2);
      const view = await coachView(page);
      assert(snap.failed && /R reported: Error.*sample_data/.test(snap.explain), snap.explain);
      assert(view.go === 'Try this step again' && view.restartShown, JSON.stringify(view));
      await page.screenshot({path: path.join(OUT, 'statistical-step3-failed.png')});
      return {message: snap.explain.trim()};
    });

    await probe('statistical: Start over resets the script and R (sample_data and step 3\'s line are gone), types all 5 steps again, and finishes', async () => {
      const allValues = Object.assign({}, ...manifest.steps.flatMap(s => s.runs.map(r => r.expected_values)));
      const before = await rstudioState(page);
      assert(before.script.includes(manifest.steps[2].runs[0].code), 'step 3\'s line was not in the script before Start over');
      const fresh = await freshStarts(page);
      await coachEl(page, 'button.restart').click();
      // The reset's own clicks are RStudio commands, not the pointer's: check the pointer from here.
      const {t: since, last} = await waitForFreshStart(page, fresh + 1);
      verifyFresh(await rstudioState(page), manifest, scriptPath);
      const snap = await settleStep(page, 0);
      const first = await verifyStepFully(page, manifest, 0, snap, since, {plotBefore: null, allValues, scriptPath, typed: true});
      const done = [{step: 1, ...first}, ...await runSteps(page, manifest, 1, 4, 'statistical-rerun', {scriptPath})];
      const view = await coachView(page);
      assert(view.steps.every(s => s === 'done') && view.go === 'Demonstration complete', JSON.stringify(view));
      return {resetMs: last.ms, done};
    });

    await probe('statistical: the saved script holds every line once, under its heading, with nothing unsaved', async () => {
      verifySaved(scriptPath, manifest, manifest.steps.length - 1);
      const dirty = await unsavedTabs(page);
      assert(dirty.length === 0, `unsaved changes shown on: ${dirty}`);
      return {lines: manifest.steps.reduce((n, s) => n + s.runs.length, 0), visibleUnsavedMarkers: 0};
    });
    await context.close();
  }

  await browser.close();
  const summary = {when: new Date().toISOString(), passed: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length, warnings, pageErrors: errors, results};
  fs.writeFileSync(path.join(OUT, 'demo-results.json'), JSON.stringify(summary, null, 2));
  console.log(`\n${summary.passed} passed, ${summary.failed} failed; warnings: ${warnings.length}; page errors: ${errors.length}`);
  process.exit(summary.failed || errors.length ? 1 : 0);
})();
