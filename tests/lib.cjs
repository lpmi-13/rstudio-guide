// Shared by the browser audits of lessons (tests/demo_mode.cjs, tests/practice_modes.cjs):
// provisioning a run, signing in, choosing a mode the way a learner does, and an independent
// in-page record of the coach's pointer, clicks and keystrokes.
const {execFileSync} = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
// The run under test: run.sh's defaults, or another run's folder and port (tests/run_lesson_audits.py
// runs several side by side, each with its own LAB_RUN_DIR, LAB_GATEWAY_PORT and so on).
const RUN_DIR = path.join(ROOT, process.env.LAB_RUN_DIR || 'run');
const GATEWAY = `http://127.0.0.1:${process.env.LAB_GATEWAY_PORT || 8788}`;

function audit(outDir) {
  fs.mkdirSync(outDir, {recursive: true});
  const results = [];
  async function probe(name, fn) {
    const started = Date.now();
    try {
      const detail = await fn();
      results.push({name, ok: true, ms: Date.now() - started, detail});
      console.log(`PASS  ${name}${detail ? `  ${JSON.stringify(detail)}` : ''}`);
    } catch (error) {
      results.push({name, ok: false, ms: Date.now() - started, error: String(error.message || error).split('\n')[0]});
      console.log(`FAIL  ${name}  ${String(error.message || error).split('\n')[0]}`);
    }
  }
  return {results, probe};
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const tokens = s => s.split(/\s+/).filter(Boolean).sort().join(' ');

// `./run.sh up` with these scenarios; none means the default run with both lessons.
function provision(...scenarios) {
  execFileSync(path.join(ROOT, 'run.sh'), ['up', ...scenarios], {stdio: ['ignore', 'ignore', 'inherit']});
  return fs.readFileSync(path.join(RUN_DIR, '.env'), 'utf8').match(/RSTUDIO_PASSWORD=(\S+)/)[1];
}

// RStudio's sign-in button calls submitRealForm() from js/signin.js. Once in ~6 audit runs
// the sign-in page loaded without its scripts (never requested; not reproduced in 10 fresh
// starts). Record it as a warning with diagnostics and reload once, rather than letting one
// glitch cascade into every later probe.
const warnings = [];
async function loadSignInPage(page, url) {
  const failed = [];
  const onFail = r => failed.push(`${r.url()} ${r.failure()?.errorText}`);
  page.on('requestfailed', onFail);
  await page.goto(url);
  let ready = await page.waitForFunction(() => typeof window.submitRealForm === 'function', null, {timeout: 10000}).then(() => true, () => false);
  if (!ready) {
    warnings.push({what: 'sign-in page scripts did not load; reloaded once', url, failedRequests: failed, at: new Date().toISOString()});
    console.log(`WARN  sign-in page scripts did not load (${failed.length} failed requests); reloading once`);
    await page.reload();
    ready = await page.waitForFunction(() => typeof window.submitRealForm === 'function', null, {timeout: 10000}).then(() => true, () => false);
  }
  page.off('requestfailed', onFail);
  if (!ready) throw new Error('sign-in page scripts did not load, even after a reload');
}

// Whether the run under test has RStudio's sign-in off (DISABLE_AUTH=true, as on iximiuz). Any audit
// that signs in with signIn() also runs that way: `DISABLE_AUTH=true node tests/<audit>.cjs`.
const signInOff = () => /^DISABLE_AUTH=true$/m.test(fs.readFileSync(path.join(RUN_DIR, '.env'), 'utf8'));

async function signIn(page, password, mode) {
  if (signInOff()) {
    await page.goto(`${GATEWAY}/`);
  } else {
    await loadSignInPage(page, `${GATEWAY}/`);
    await page.fill('#username', 'rstudio');
    await page.fill('#password', password);
    await page.click('#signinbutton');
  }
  await page.waitForSelector('#rstudio_console_input', {timeout: 90000});
  await waitForCoach(page, mode);
}

const coachEl = (page, sel) => page.locator('#rs-coach-host').locator(sel);
const MODE_STATE = {demonstration: 'demo', guided: 'guided', solo: 'solo'};

// Wait until the coach has loaded its lesson. A new run opens on the mode picker, where this
// clicks `mode`'s card as a learner would; after a reload the coach reopens the mode chosen
// before, so there is nothing to click. `mode` null: leave the picker as it is.
async function waitForCoach(page, mode = 'demonstration') {
  await page.waitForFunction(() => window.__rsCoach && window.__rsCoach.mode !== undefined, null, {timeout: 30000});
  if (mode) {
    const current = await page.evaluate(() => window.__rsCoach.mode);
    if (current === null) await coachEl(page, `button.mode-card[data-mode="${mode}"]`).click();
    else if (current !== mode) throw new Error(`the coach reopened in ${current}, not ${mode}`);
    await page.waitForFunction(state => window.__rsCoach[state], MODE_STATE[mode], {timeout: 30000});
  }
  await page.waitForTimeout(800);
  await installRecorder(page);
}

// An independent record of what the learner sees, kept in the page (and re-installed after a
// reload): the coach's pointer on every animation frame, every synthetic mousedown with where
// the pointer was at that moment, and every edit Ace applies to the open script with where its
// caret was. Clicks and edits also record whether RStudio was dimmed and where the spotlight was.
async function installRecorder(page) {
  await page.evaluate(() => {
    if (window.__audit) return;
    const rec = (window.__audit = {pointer: [], clicks: [], edits: []});
    const spot = () => {
      const root = document.getElementById('rs-coach-overlay')?.shadowRoot;
      const ring = root?.querySelector('.spot');
      const r = ring && !ring.hidden ? ring.getBoundingClientRect() : null;
      return {dim: Boolean(root?.querySelector('.dim.on')), ring: r && {left: r.left, top: r.top, right: r.right, bottom: r.bottom}};
    };
    const tip = () => {
      const el = document.getElementById('rs-coach-overlay')?.shadowRoot?.querySelector('.pointer');
      const m = el && /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(el.style.transform);
      return m ? {x: +m[1], y: +m[2], visible: el.classList.contains('visible')} : null;
    };
    let last = '';
    const sample = () => {
      const p = tip();
      const key = p ? `${p.x},${p.y},${p.visible}` : '';
      if (key !== last) { last = key; if (p) rec.pointer.push({t: performance.now(), ...p}); }
      requestAnimationFrame(sample);
    };
    sample();
    window.addEventListener('mousedown', e => {
      if (e.isTrusted) return; // the audit's own clicks
      rec.clicks.push({t: performance.now(), x: e.clientX, y: e.clientY, at: tip(), ...spot(),
        target: (e.target.closest('button')?.title || e.target.textContent || '').trim().slice(0, 50)});
    }, true);
    const hooked = new WeakSet();
    setInterval(() => {
      for (const el of document.querySelectorAll('#rstudio_Source_pane .ace_editor')) {
        const session = el.env?.editor?.session;
        if (!session || hooked.has(session)) continue;
        hooked.add(session);
        const renderer = el.env.editor.renderer;
        session.on('change', d => {
          const at = renderer.textToScreenCoordinates(d.end.row, d.end.column);
          rec.edits.push({t: performance.now(), action: d.action, row: d.start.row, text: d.lines.join('\n'),
            caret: {x: at.pageX, y: at.pageY + renderer.lineHeight / 2}, ...spot()});
        });
      }
    }, 50);
  });
}
const now = page => page.evaluate(() => performance.now());
const record = page => page.evaluate(() => window.__audit);
const editorLines = page => page.evaluate(() => {
  const el = [...document.querySelectorAll('#rstudio_Source_pane .ace_editor')].find(e => e.offsetParent && e.env?.editor);
  return el ? el.env.editor.session.getDocument().getAllLines() : null;
});

// Every click the coach made in [since, until] landed on its visible pointer's tip, and the
// pointer took several frames to get there from wherever it was before.
function verifyPointer(rec, since, until) {
  const clicks = rec.clicks.filter(c => c.t >= since && c.t <= until);
  assert(clicks.length > 0, 'the coach made no clicks');
  let previous = since;
  for (const c of clicks) {
    assert(c.at?.visible, `the coach clicked "${c.target}" with its pointer hidden`);
    const off = Math.hypot(c.at.x - c.x, c.at.y - c.y);
    assert(off <= 2, `the click on "${c.target}" landed ${off.toFixed(1)} px from the pointer`);
    const frames = rec.pointer.filter(p => p.t > previous && p.t <= c.t && p.visible).length;
    assert(frames >= 5, `the pointer reached "${c.target}" in ${frames} frames; it should glide, not jump`);
    previous = c.t;
  }
  return clicks.length;
}

// While the coach worked RStudio in [since, until], RStudio was dimmed and every click it made,
// and the caret at every key it typed, sat inside the spotlight.
function verifySpotlight(rec, since, until) {
  const inside = (p, r) => r && p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
  const clicks = rec.clicks.filter(c => c.t >= since && c.t <= until);
  for (const c of clicks) {
    assert(c.dim && inside(c, c.ring), `the coach clicked "${c.target}" at ${Math.round(c.x)},${Math.round(c.y)} outside the spotlight (${JSON.stringify(c.ring)}, dimmed: ${c.dim})`);
  }
  // The spotlight spans the editor, so the caret's line must be inside it. Its x isn't checked: the
  // edit is recorded before Ace scrolls sideways to follow the caret along (or back from) a long line.
  // Indentation isn't checked either: the coach sets a new line's indentation in the same instant as
  // it presses Enter, before the spotlight's next frame reaches that line.
  const keys = rec.edits.filter(e => e.t >= since && e.t <= until && e.action === 'insert' && !e.text.includes('\n') && e.text.trim());
  for (const k of keys) {
    const r = k.ring;
    assert(k.dim && r && k.caret.y >= r.top && k.caret.y <= r.bottom,
      `the coach typed "${k.text}" on a line outside the spotlight (caret y ${Math.round(k.caret.y)}, ring ${JSON.stringify(r)}, dimmed: ${k.dim})`);
  }
  return {spotlitClicks: clicks.length, spotlitKeys: keys.length};
}
// What the overlay shows now: dimming, spotlight ring, evidence ring.
const overlayState = page => page.evaluate(() => {
  const root = document.getElementById('rs-coach-overlay')?.shadowRoot;
  const rect = el => (el && !el.hidden ? (r => ({left: r.left, top: r.top, right: r.right, bottom: r.bottom}))(el.getBoundingClientRect()) : null);
  return {dim: Boolean(root?.querySelector('.dim.on')), spot: rect(root?.querySelector('.spot')), ring: rect(root?.querySelector('.box'))};
});

// The code was typed one key at a time at a person's pace. RStudio's auto-pairing adds ")" as a
// second insert after "(", and the ")" typed later only moves the cursor, so inserts match characters.
// `codes` is what should have been typed; [] means the code was already there, so nothing is.
// Spaces aren't counted on either side: RStudio indents each new line of a statement, and the coach
// sets that indentation to the reference's in one edit. `shortcuts` pipes or arrows came from
// Ctrl+Shift+M or Alt+-: for each, RStudio inserts " |> " or " <- " and the coach rewrites the line
// up to it, so neither of those edits is a keystroke and the two characters aren't counted.
function verifyTyping(rec, since, until, codes, {shortcuts = 0} = {}) {
  const fromShortcut = k => shortcuts > 0 && k.text.length > 2 && /(\|>|<-)$/.test(k.text.trimEnd());
  const keys = rec.edits.filter(e => e.t >= since && e.t <= until && e.action === 'insert' && !e.text.includes('\n')
    && e.text.trim() && !fromShortcut(e));
  const chars = codes.reduce((n, code) => n + code.replace(/\s/g, '').length, 0) - 2 * shortcuts;
  if (!chars) {
    assert(keys.length === 0, `${keys.length} keystrokes, but the code was already in the script`);
    return {keys: 0};
  }
  const pasted = keys.find(k => k.text.length > 2);
  assert(!pasted, `"${pasted?.text}" arrived in one insert, not typed`);
  assert(keys.length >= chars * 0.7 && keys.length <= chars, `${keys.length} keystrokes for ${chars} characters`);
  const gaps = keys.slice(1).map((k, i) => k.t - keys[i].t).filter(gap => gap < 1000).sort((a, b) => a - b); // not between lines
  const median = gaps[Math.floor(gaps.length / 2)];
  assert(median >= 35 && median <= 250, `median gap between keystrokes was ${median.toFixed(0)} ms`);
  return {keys: keys.length, chars, medianGapMs: Math.round(median)};
}

// R's own record of what ran (runtime/evidence.R, served at /coach/api/evidence to a signed-in
// browser): the session, its recent calls with their fingerprints, and IDE state such as the
// attached packages and the project's files.
const rEvidence = page => page.evaluate(() => fetch('/coach/api/evidence', {cache: 'no-store'})
  .then(r => (r.ok ? r.json() : {session: null, seq: 0, calls: [], state: null})));
// Each statement in `runs` left the bake's evidence in R since `mark` (an earlier rEvidence): a call
// with the reference fingerprint, the package attached, or the file written. This checks R's record
// against the bake directly, apart from the coach's own matching. Returns the kinds checked.
function verifyEvidence(doc, runs, mark) {
  const fresh = (doc.calls || []).filter(c => doc.session !== mark.session || c.seq > mark.seq);
  const met = [];
  for (const run of runs.filter(r => r.code)) {
    const want = run.expected || {};
    let ok;
    switch (run.evidence) {
      case 'value': ok = fresh.some(c => (run.order === 'any' ? c.fp_any === want.fp_any : c.fp === want.fp)); break;
      case 'assign': ok = fresh.some(c => c.assigned === want.assigned && c.fp === want.fp); break;
      case 'ggplot': ok = fresh.some(c => c.visible && c.fp === want.fp); break;
      case 'attached': ok = (doc.state?.attached || []).includes(want.library); break;
      case 'file': ok = (doc.state?.files || []).some(f => f.path === run.path); break;
      default: continue; // console and pattern evidence show in the Console
    }
    assert(ok, `R's evidence has no ${run.evidence} result matching the bake for ${JSON.stringify(run.code.split('\n')[0])}`);
    met.push(run.evidence);
  }
  return met;
}

// What a fresh start resets, as RStudio shows it: the script in the Source pane (and whether Ctrl+Z
// could bring older text back), the Console, the Environment, and whether the Plots pane shows a chart.
const rstudioState = page => page.evaluate(() => {
  const editor = [...document.querySelectorAll('#rstudio_Source_pane .ace_editor')].find(e => e.offsetParent && e.env?.editor)?.env.editor;
  const tab = [...document.querySelectorAll('#rstudio_Source_pane [role="tab"]')].find(t => t.getAttribute('aria-selected') === 'true');
  let chart = false;
  for (const f of document.querySelectorAll('#rstudio_workbench_panel_plots iframe')) {
    try {
      const img = f.contentDocument.querySelector('img');
      if (img && img.naturalWidth > 0 && getComputedStyle(img).display !== 'none') chart = true;
    } catch (_e) { /* ignore */ }
  }
  return {tab: tab?.innerText.trim(), script: editor ? editor.getValue() : null, canUndo: editor ? editor.session.getUndoManager().hasUndo() : null,
    console: document.getElementById('rstudio_console_output')?.textContent ?? '',
    environment: document.getElementById('rstudio_workbench_panel_environment')?.innerText.replace(/\s+/g, ' ').trim() ?? '',
    chart};
});
// The coach has just started `lesson` afresh: its script, open and saved, holds only the step
// headings with no undo history, and R's Console, Environment and Plots are empty.
function verifyFresh(state, lesson, scriptPath) {
  assert(state.tab === lesson.script, `the Source pane shows ${state.tab}, not ${lesson.script}`);
  assert(state.script === lesson.starter, `${lesson.script} was not reset to its step headings: ${JSON.stringify(state.script)}`);
  assert(state.canUndo === false, `Ctrl+Z in ${lesson.script} could bring back the code from before`);
  assert(fs.readFileSync(scriptPath, 'utf8') === lesson.starter, `${lesson.script} on disk was not reset`);
  assert(!state.console.trim(), `the Console still shows ${JSON.stringify(state.console.slice(-120))}`);
  assert(/Environment is empty/.test(state.environment), `the Environment is not empty: ${state.environment.slice(-80)}`);
  assert(!state.chart, 'the Plots pane still shows a chart from before');
}
// Wait for the coach's fresh start number `n` to finish, and return when (performance.now()).
// It must have met no problems.
async function waitForFreshStart(page, n) {
  const done = await page.waitForFunction(n => (window.__rsCoach.fresh.count >= n ? {t: performance.now(), last: window.__rsCoach.fresh.last} : null),
    n, {timeout: 60000, polling: 20}).then(h => h.jsonValue());
  assert(done.last.problems.length === 0, `the fresh start met problems: ${done.last.problems.join(' ')}`);
  return done;
}
const freshStarts = page => page.evaluate(() => window.__rsCoach.fresh.count);

const plotSrc = page => page.evaluate(() => {
  for (const f of document.querySelectorAll('#rstudio_workbench_panel_plots iframe')) {
    try { const img = f.contentDocument.querySelector('img'); if (img) return img.src; } catch (_e) { /* ignore */ }
  }
  return null;
});

async function dockedGeometry(page) {
  return page.evaluate(() => {
    const host = document.getElementById('rs-coach-host');
    const panel = host.shadowRoot.querySelector('.panel').getBoundingClientRect();
    const sidebar = document.getElementById('rstudio_Sidebar_pane').getBoundingClientRect();
    const overlaps = {};
    for (const id of ['rstudio_Source_pane', 'rstudio_Console_pane', 'rstudio_TabSet1_pane', 'rstudio_TabSet2_pane']) {
      const el = document.getElementById(id);
      if (!el?.offsetParent) continue;
      const r = el.getBoundingClientRect();
      const ix = Math.max(0, Math.min(r.right, panel.right) - Math.max(r.left, panel.left));
      const iy = Math.max(0, Math.min(r.bottom, panel.bottom) - Math.max(r.top, panel.top));
      if (ix * iy > 0) overlaps[id] = Math.round(ix * iy);
    }
    return {parent: host.parentElement.id, fills: sidebar.width - panel.width <= 4 && sidebar.height - panel.height <= 4, // inside the pane's 1px frame
      panel: [panel.x, panel.y, panel.width, panel.height].map(Math.round), overlaps};
  });
}

module.exports = {
  ROOT, RUN_DIR, GATEWAY, audit, assert, tokens, provision, warnings, signIn, waitForCoach, coachEl,
  installRecorder, now, record, editorLines, verifyPointer, verifyTyping, verifySpotlight, overlayState, plotSrc, dockedGeometry,
  rstudioState, verifyFresh, waitForFreshStart, freshStarts, rEvidence, verifyEvidence,
};
