// Demonstration-mode audit, on two of the lessons modelled on R for Data Science: 01 Data
// visualization (charts) and 03 Data transformation (pipelines, at 1366x768). For each it
// provisions a fresh run, signs in through the gateway, chooses Demonstration on the coach's mode
// picker, and drives the coach only through its visible buttons, the way a learner would, at the
// coach's normal pace. It never calls the coach's internals to complete a step.
//
// It checks that:
// - the coach docks into the sidebar without covering any other pane;
// - every click the coach makes lands where its visible pointer is, and the
//   pointer glides there rather than jumping;
// - the panel introduces the lesson until a step starts; from then on it shows only the
//   current step, narrated statement by statement by what each is for ("Writing code to ...");
// - every narrated line stays up for its reading time (5 s or more, longer for longer text),
//   counted down on the button; Advance ends a countdown at once, and with nothing pressed an
//   explanation counts down and the next step starts by itself;
// - with Auto-advance off, an explanation waits for Next however long it takes (the switch is
//   kept across a reload); turned on again, its countdown carries on and the next step starts;
// - while the coach works, RStudio is dimmed and every click and keystroke is
//   inside the spotlight; when a step is explained, the dimming has lifted and
//   an evidence ring marks the Console output or the chart;
// - code is typed into the script one key at a time, at a person's pace, with each |> of a
//   statement that teaches Ctrl+Shift+M typed by the shortcut; the coach never presses Save, so
//   the script stays unsaved, as a learner's would;
// - choosing Demonstration, and Start over, start afresh: the script holds only its
//   step headings and the Console, Environment and Plots are empty, and
//   Start over then types every step again;
// - each step's explanation appears only once RStudio shows each statement run in the Console
//   (and, for a chart, a newly loaded chart), and R's own evidence holds the bake's result for
//   each statement: its fingerprint, package or file, checked here apart from the coach;
// - the explanation quotes the bake's values;
// - failures stop the demonstration visibly and can be recovered;
// - reload resumes, and Stop halts further RStudio actions, typing included.
//
//   NODE_PATH=$(npm root -g) node tests/demo_mode.cjs [results-dir]
const {chromium} = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const {
  ROOT, audit, assert, provision, warnings, signIn, waitForCoach, coachEl,
  now, record, editorLines, verifyPointer, verifyTyping, verifySpotlight, overlayState, plotSrc, dockedGeometry,
  rstudioState, verifyFresh, waitForFreshStart, freshStarts, rEvidence, verifyEvidence,
} = require('./lib.cjs');

const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'results'));
const {results, probe} = audit(OUT);
const escapeRe = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const firstLine = code => code.split('\n')[0];
const pipesByShortcut = runs => runs.filter(r => r.code && r.keys).reduce((n, r) => n + r.code.split('|>').length - 1, 0);

// The script in the editor holds the statements of steps 0..last directly below their heading, in
// order, each once. The coach doesn't save it, so the editor, not the file, has the code.
async function verifyScript(page, manifest, last) {
  const lines = await editorLines(page);
  assert(lines, 'no script is open in the Source pane');
  const text = `${lines.join('\n')}\n`;
  for (const step of manifest.steps.slice(0, last + 1)) {
    const at = lines.indexOf(step.heading);
    assert(at >= 0, `the script has no ${step.heading}`);
    const want = step.runs.filter(r => r.code).map(r => r.code).join('\n').split('\n');
    const got = lines.slice(at + 1, at + 1 + want.length);
    assert(got.join('\n') === want.join('\n'), `below ${step.heading} the script has ${JSON.stringify(got)}`);
    for (const run of step.runs.filter(r => r.code)) {
      const count = text.split(`\n${run.code}\n`).length - 1;
      assert(count === 1, `the script has ${JSON.stringify(firstLine(run.code))} ${count} times`);
    }
  }
}
// The coach's clicks on Save, ever: there should be none.
const saveClicks = page => page.evaluate(() => window.__rsCoach.log.filter(e => e.type === 'demo_click' && e.target === 'save').length);
const unsavedTabs = page => page.evaluate(() => [...document.querySelectorAll('#rstudio_Source_pane [role="tab"]')]
  .map(t => t.innerText.trim()).filter(t => t.includes('*')));
const autoSwitch = page => page.evaluate(() => {
  const root = document.getElementById('rs-coach-host').shadowRoot;
  return {on: root.querySelector('button.auto')?.getAttribute('aria-checked'), note: root.querySelector('.auto-off') ? !root.querySelector('.auto-off').hidden : null};
});

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

// While a step ran, the card stood alone (no lesson overview), said what each statement is for,
// and left every line up for its reading time. Exempt: lines the learner pressed Advance on, and
// R's "still running" note, which goes as soon as R answers.
function verifyNarration(lines, step, typed, advanced = []) {
  const shown = lines.map((l, k) => ({...l, ms: (lines[k + 1]?.t ?? Infinity) - l.t})).filter(l => l.text);
  assert(shown.length > 0, 'the card narrated nothing');
  const crowded = shown.find(l => l.overview || !l.card);
  assert(!crowded, `"${crowded?.text}" was narrated with the lesson overview still shown (or the card hidden)`);
  for (const run of step.runs.filter(r => r.code)) {
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
  }, i, {timeout: 180000, polling: 50});
  return handle.jsonValue();
}

// Independent check of one finished step against the manifest, the snapshot and R's evidence
// since `mark`.
function verifyStep(step, snap, plotBefore, allValues, doc, mark) {
  assert(!snap.failed, `step failed: ${snap.explain}`);
  const runs = step.runs.filter(r => r.code);
  for (const run of runs) {
    assert(snap.console.lastIndexOf(`> ${firstLine(run.code)}`) >= 0, `Console never showed > ${firstLine(run.code)}`);
  }
  if (runs.length) {
    const from = snap.console.lastIndexOf(`> ${firstLine(runs[0].code)}`);
    const error = /^Error.*$/m.exec(snap.console.slice(from));
    assert(!error, `the Console shows ${JSON.stringify(error?.[0])} after the step's statements`);
  }
  const evidence = verifyEvidence(doc, runs, mark);
  const charted = step.runs.some(r => ['plot', 'ggplot'].includes(r.evidence));
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
  }
  return {quoted: quoted.map(n => `${n}=${allValues[n]}`), evidence};
}

// Everything a learner should see in one finished step: the pointer, the typing (or none, when
// the step's code was already in the script), the evidence, and the script, which the coach
// never saved.
async function verifyStepFully(page, manifest, i, snap, since, {plotBefore, allValues, scriptPath, typed, mark}) {
  const step = manifest.steps[i];
  const doc = await rEvidence(page);
  const checked = verifyStep(step, snap, plotBefore, allValues, doc, mark);
  const rec = await record(page);
  const clicks = verifyPointer(rec, since, snap.t);
  const runs = step.runs.filter(r => r.code);
  const typing = verifyTyping(rec, since, snap.t, typed ? runs.map(r => r.code) : [], {shortcuts: typed ? pipesByShortcut(runs) : 0});
  const spotlit = verifySpotlight(rec, since, snap.t);
  await verifyScript(page, manifest, i);
  const saves = await saveClicks(page);
  assert(saves === 0, `the coach pressed Save ${saves} times`);
  return {...checked, clicks, ...typing, spotlitKeys: spotlit.spotlitKeys};
}

const allValuesOf = manifest => Object.assign({}, ...manifest.steps.flatMap(s => s.runs.map(r => r.expected_values)));

// `auto`: after the first step, press nothing; each explanation must count down and then start
// the next step by itself. `advance`: press Advance once, during the first step's first countdown.
async function runSteps(page, manifest, from, to, tag, {scriptPath, typed = true, auto = false, advance = false}) {
  const allValues = allValuesOf(manifest);
  const done = [];
  let explained = null; // the previous step's snapshot, taken as its explanation appeared
  for (let i = from; i <= to; i++) {
    const plotBefore = await plotSrc(page);
    const mark = await rEvidence(page);
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
      }, i, {timeout: 120000, polling: 20}).then(h => h.jsonValue());
      const waited = started - explained.t;
      const need = readingMs(explained.explain);
      assert(waited >= need - 150 && waited <= need + 2500, `step ${i + 1} started ${Math.round(waited)} ms after the explanation, whose reading time is ${Math.round(need)} ms`);
      auto_ = {label, startedAfterMs: Math.round(waited), readingMs: Math.round(need)};
    } else {
      await coachEl(page, 'button.go').click();
    }
    const advanced = advance && i === from ? await pressAdvance(page) : null;
    const snap = await settleStep(page, i);
    const checks = await verifyStepFully(page, manifest, i, snap, since, {plotBefore, allValues, scriptPath, typed, mark});
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

  // ---------------- 01 Data visualization ----------------
  {
    const LESSON = '01-data-visualization';
    const password = provision(LESSON);
    const scriptPath = path.join(ROOT, 'run/project', `${LESSON}.R`);
    const original = fs.readFileSync(scriptPath, 'utf8');
    const context = await browser.newContext({viewport: {width: 1440, height: 900}});
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(`${LESSON}: ${e.message}`));
    let manifest;

    await probe('lesson 1: sign in; choosing Demonstration opens the script, fresh; coach docks in the sidebar and covers no other pane', async () => {
      await signIn(page, password);
      manifest = await page.evaluate(() => fetch('/coach/api/steps').then(r => r.json()).then(s => s.lessons[0]));
      assert(manifest.id === LESSON && manifest.version === 2, `the run's lesson is ${manifest.id}`);
      assert(manifest.starter === original, 'the coach would reset the script to something other than what was provisioned');
      const {last} = await waitForFreshStart(page, 1);
      verifyFresh(await rstudioState(page), manifest, scriptPath);
      const g = await dockedGeometry(page);
      assert(g.parent === 'rstudio_Sidebar_pane' && g.fills && Object.keys(g.overlaps).length === 0, JSON.stringify(g));
      const view = await coachView(page);
      assert(view.overview && !view.card, `before Start, the panel should introduce the lesson: ${JSON.stringify(view)}`);
      assert((await autoSwitch(page)).on === 'false', 'Auto-advance should start off');
      await coachEl(page, 'button.auto').click(); // later probes exercise automatic steps
      await page.screenshot({path: path.join(OUT, 'lesson1-docked.png')});
      return {resetMs: last.ms, ...g};
    });

    await probe('lesson 1: a script without step 1\'s heading stops step 1 visibly, before typing', async () => {
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
      assert(snap.failed && new RegExp(`no longer has the line ${escapeRe(heading)}`).test(snap.explain), snap.explain);
      assert(!snap.dim && !snap.spot, 'RStudio stayed dimmed after the step failed');
      assert(view.go === 'Try this step again' && !view.goDisabled && view.restartShown, JSON.stringify(view));
      verifyTyping(await record(page), since, snap.t, []);
      assert(!snap.console.includes(`> ${manifest.steps[0].runs[0].code}`), 'the coach ran a statement after failing');
      await page.screenshot({path: path.join(OUT, 'lesson1-step1-failed.png')});
      return {message: snap.explain.trim()};
    });

    await probe('lesson 1: after the script is restored and its tab closed, "Try this step again" reopens it and passes', async () => {
      // The learner undoes their edit, saves and closes the script's tab; the coach must
      // reopen it from the Files pane.
      const first = await page.locator('#rstudio_Source_pane .ace_line').first().boundingBox();
      await page.mouse.click(first.x + 40, first.y + first.height / 2); // back into the editor
      await page.keyboard.press('Control+z');
      await page.keyboard.press('Control+s');
      await page.waitForFunction(() => ![...document.querySelectorAll('#rstudio_Source_pane [role="tab"]')].some(t => t.innerText.includes('*')), null, {timeout: 10000});
      assert(fs.readFileSync(scriptPath, 'utf8') === original, 'undo and save did not restore the script');
      const tab = page.locator('#rstudio_Source_pane [role="tab"]', {hasText: `${LESSON}.R`});
      await tab.locator('img[alt="Close document tab"]').click();
      await tab.waitFor({state: 'detached', timeout: 10000});
      const plotBefore = await plotSrc(page);
      const mark = await rEvidence(page);
      const since = await now(page);
      await coachEl(page, 'button.go').click();
      const snap = await settleStep(page, 0);
      const checks = await verifyStepFully(page, manifest, 0, snap, since, {plotBefore, allValues: {}, scriptPath, typed: true, mark});
      await page.screenshot({path: path.join(OUT, 'lesson1-step1.png')});
      return {explain: snap.explain.slice(0, 60), ...checks};
    });

    await probe('lesson 1: steps 2-3 typed, run and explained only once R has the bake\'s results (and a new chart); with nothing pressed, step 2\'s explanation counts down into step 3', async () => runSteps(page, manifest, 1, 2, 'lesson1', {scriptPath, auto: true}));

    await probe('lesson 1: hiding and re-showing the sidebar mid-step keeps the same coach and finishes step 4', async () => {
      const plotBefore = await plotSrc(page);
      // Step 4 starts by itself once step 3's explanation has counted down.
      const started = await page.waitForFunction(() => window.__rsCoach.demo.state === 'running' && window.__rsCoach.demo.index === 3
        ? performance.now() : null, null, {timeout: 120000, polling: 20}).then(h => h.jsonValue());
      const mark = await rEvidence(page);
      await page.waitForFunction(() => window.__rsCoach.demo.state === 'running' && window.__rsCoach.demo.actions >= 1, null, {timeout: 15000});
      await page.click('#rstudio_sidebar_toggle_button');
      await page.waitForFunction(() => window.__rsCoach.placement === 'floating', null, {timeout: 10000});
      await page.waitForTimeout(1500);
      await page.screenshot({path: path.join(OUT, 'lesson1-step4-floating.png')});
      await page.click('#rstudio_sidebar_toggle_button');
      await page.waitForFunction(() => window.__rsCoach.placement === 'docked', null, {timeout: 10000});
      const snap = await settleStep(page, 3);
      const checks = await verifyStepFully(page, manifest, 3, snap, started, {plotBefore, allValues: allValuesOf(manifest), scriptPath, typed: true, mark});
      const mounts = await page.evaluate(() => window.__rsCoach.mounts);
      assert(mounts === 1, `coach re-mounted ${mounts} times`);
      const g = await dockedGeometry(page);
      assert(g.fills && Object.keys(g.overlaps).length === 0, `after re-docking: ${JSON.stringify(g)}`);
      await page.screenshot({path: path.join(OUT, 'lesson1-step4.png')});
      const view = await coachView(page);
      assert(view.steps.slice(0, 4).every(s => s === 'done') && /^Next: step 5/.test(view.go), JSON.stringify(view));
      return {mounts, panel: g.panel, ...checks};
    });

    await probe('lesson 1: Auto-advance off holds step 4\'s explanation for Next, also after a reload; on again, the countdown carries on into step 5', async () => {
      const counting = await coachView(page);
      assert(/^Next: step 5 · \d+s$/.test(counting.go), `step 4's explanation should be counting down: ${counting.go}`);
      await coachEl(page, 'button.auto').click();
      const off = {...await autoSwitch(page), go: (await coachView(page)).go};
      assert(off.on === 'false' && off.note && off.go === 'Next: step 5', `after turning Auto-advance off: ${JSON.stringify(off)}`);
      const need = readingMs((await coachView(page)).explain);
      await page.waitForTimeout(need + 3000); // longer than the whole reading time
      const held = await page.evaluate(() => ({state: window.__rsCoach.demo.state, index: window.__rsCoach.demo.index}));
      assert(held.state === 'waiting' && held.index === 3 && (await coachView(page)).go === 'Next: step 5', `step 5 started with Auto-advance off: ${JSON.stringify(held)}`);
      await page.reload();
      await page.waitForSelector('#rstudio_console_input', {timeout: 90000});
      await waitForCoach(page);
      const reloaded = await autoSwitch(page);
      assert(reloaded.on === 'false' && reloaded.note, `Auto-advance was not kept across a reload: ${JSON.stringify(reloaded)}`);
      // On again: nothing counts down after a reload, so the learner presses Next, and step 5's
      // explanation then counts down into step 6 by itself.
      await coachEl(page, 'button.auto').click();
      assert((await autoSwitch(page)).on === 'true', 'Auto-advance did not come back on');
      const plotBefore = await plotSrc(page);
      const mark = await rEvidence(page);
      const since = await now(page);
      await coachEl(page, 'button.go').click();
      const snap = await settleStep(page, 4);
      const checks = await verifyStepFully(page, manifest, 4, snap, since, {plotBefore, allValues: allValuesOf(manifest), scriptPath, typed: true, mark});
      const after = await coachView(page);
      assert(/^Next: step 6 · \d+s$/.test(after.go), `with Auto-advance on, step 5's explanation should count down: ${after.go}`);
      return {heldForMs: need + 3000, readingMs: Math.round(need), afterReload: reloaded, step5: checks.quoted, go: after.go};
    });

    await probe('lesson 1: reload keeps progress; Start over resets the script and R, then types step 1 again; Stop part-way through typing halts the typing and RStudio', async () => {
      await page.reload(); // within step 5's reading time, so step 6 hasn't started
      await page.waitForSelector('#rstudio_console_input', {timeout: 90000});
      await waitForCoach(page);
      const restored = await coachView(page);
      assert(restored.steps.slice(0, 5).every(s => s === 'done') && restored.steps[5] !== 'done' && restored.go === 'Next: step 6' && restored.restartShown, JSON.stringify(restored));
      const before = await rstudioState(page);
      assert(before.chart && /week/.test(before.environment), `the demonstration left nothing to reset: ${JSON.stringify(before).slice(0, 300)}`);
      const heading = manifest.steps[0].heading;
      const code = manifest.steps[0].runs[0].code;
      const fresh = await freshStarts(page);
      await coachEl(page, 'button.restart').click();
      const {last} = await waitForFreshStart(page, fresh + 1);
      verifyFresh(await rstudioState(page), manifest, scriptPath); // step 1 starts by itself, typing within a second
      // Stop once the statement under the heading is partly typed.
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
      await page.screenshot({path: path.join(OUT, 'lesson1-stopped.png')});
      return {restoredGo: restored.go, resetMs: last.ms, lineAtStop: atStop.line, actionsAtStop: atStop.actions};
    });
    await context.close();
  }

  // ---------------- 03 Data transformation (narrower window) ----------------
  {
    const LESSON = '03-data-transformation';
    const password = provision(LESSON);
    const scriptPath = path.join(ROOT, 'run/project', `${LESSON}.R`);
    const context = await browser.newContext({viewport: {width: 1366, height: 768}});
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(`${LESSON}: ${e.message}`));
    let manifest;

    await probe('lesson 3 (1366x768): docked coach covers no other pane', async () => {
      await signIn(page, password);
      manifest = await page.evaluate(() => fetch('/coach/api/steps').then(r => r.json()).then(s => s.lessons[0]));
      assert(manifest.id === LESSON, `the run's lesson is ${manifest.id}`);
      const g = await dockedGeometry(page);
      assert(g.parent === 'rstudio_Sidebar_pane' && g.fills && Object.keys(g.overlaps).length === 0, JSON.stringify(g));
      return g;
    });

    await probe('lesson 3: steps 1-2 typed, then explained with the bake\'s values; Advance ends a countdown at once', async () => runSteps(page, manifest, 0, 1, 'lesson3', {scriptPath, advance: true}));

    await probe('lesson 3: reload resumes at step 3', async () => {
      await page.reload(); // within step 2's reading time
      await page.waitForSelector('#rstudio_console_input', {timeout: 90000});
      await waitForCoach(page);
      const view = await coachView(page);
      assert(view.steps[0] === 'done' && view.steps[1] === 'done' && view.go === 'Next: step 3', JSON.stringify(view));
      assert(view.overview, `after a reload, the panel should show the lesson with its progress: ${JSON.stringify(view)}`);
      return {go: view.go};
    });

    await probe('lesson 3: an R error stops step 3 visibly (the learner removed trips)', async () => {
      await page.click('#rstudio_console_input');
      await page.keyboard.type('rm(trips)');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(800);
      await coachEl(page, 'button.go').click();
      const snap = await settleStep(page, 2);
      const view = await coachView(page);
      assert(snap.failed && /R reported: Error.*trips/.test(snap.explain), snap.explain);
      assert(view.go === 'Try this step again' && view.restartShown, JSON.stringify(view));
      await page.screenshot({path: path.join(OUT, 'lesson3-step3-failed.png')});
      return {message: snap.explain.trim()};
    });

    await probe('lesson 3: Start over resets the script and R (trips and step 3\'s statement are gone), types all 8 steps again, and finishes', async () => {
      const allValues = allValuesOf(manifest);
      const before = await rstudioState(page);
      assert(before.script.includes(manifest.steps[2].runs[0].code), 'step 3\'s statement was not in the script before Start over');
      const fresh = await freshStarts(page);
      const mark = await rEvidence(page);
      await coachEl(page, 'button.restart').click();
      // The reset's own clicks are RStudio commands, not the pointer's: check the pointer from here.
      const {t: since, last} = await waitForFreshStart(page, fresh + 1);
      verifyFresh(await rstudioState(page), manifest, scriptPath);
      const snap = await settleStep(page, 0);
      const first = await verifyStepFully(page, manifest, 0, snap, since, {plotBefore: null, allValues, scriptPath, typed: true, mark});
      const done = [{step: 1, ...first}, ...await runSteps(page, manifest, 1, manifest.steps.length - 1, 'lesson3-rerun', {scriptPath})];
      const view = await coachView(page);
      assert(view.steps.every(s => s === 'done') && view.go === 'Demonstration complete', JSON.stringify(view));
      return {resetMs: last.ms, done};
    });

    await probe('lesson 3: the script holds every statement once, under its heading; the coach never pressed Save, so it shows as unsaved', async () => {
      await verifyScript(page, manifest, manifest.steps.length - 1);
      const saves = await saveClicks(page);
      assert(saves === 0, `the coach pressed Save ${saves} times`);
      const dirty = await unsavedTabs(page);
      assert(dirty.some(t => t.startsWith(`${LESSON}.R`)), `the script's tab shows no unsaved marker: ${dirty}`);
      return {statements: manifest.steps.reduce((n, s) => n + s.runs.length, 0), saveClicks: saves, unsavedTabs: dirty};
    });
    await context.close();
  }

  await browser.close();
  const summary = {when: new Date().toISOString(), passed: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length, warnings, pageErrors: errors, results};
  fs.writeFileSync(path.join(OUT, 'demo-results.json'), JSON.stringify(summary, null, 2));
  console.log(`\n${summary.passed} passed, ${summary.failed} failed; warnings: ${warnings.length}; page errors: ${errors.length}`);
  process.exit(summary.failed || errors.length ? 1 : 0);
})();
