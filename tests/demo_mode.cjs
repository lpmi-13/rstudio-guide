// Demonstration-mode audit. For each demo scenario it provisions a fresh run,
// signs in through the gateway, and drives the coach only through its visible
// buttons, the way a learner would. It never calls the coach's internals to
// complete a step.
//
// It checks that:
// - the coach docks into the sidebar without covering any other pane;
// - each step's explanation appears only once RStudio shows the matching
//   Console output, or a newly loaded chart;
// - the explanation quotes values that are on screen;
// - failures stop the demonstration visibly and can be recovered;
// - reload resumes, and Stop halts further RStudio actions.
//
//   NODE_PATH=$(npm root -g) node tests/demo_mode.cjs [results-dir]
const {chromium} = require('@playwright/test');
const {execFileSync} = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const GATEWAY = 'http://127.0.0.1:8788';
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'results'));
fs.mkdirSync(OUT, {recursive: true});

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
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const tokens = s => s.split(/\s+/).filter(Boolean).sort().join(' ');

function provision(scenario) {
  execFileSync(path.join(ROOT, 'run.sh'), ['up', scenario], {stdio: ['ignore', 'ignore', 'inherit']});
  return fs.readFileSync(path.join(ROOT, 'run/.env'), 'utf8').match(/RSTUDIO_PASSWORD=(\S+)/)[1];
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

async function signIn(page, password) {
  await loadSignInPage(page, `${GATEWAY}/`);
  await page.fill('#username', 'rstudio');
  await page.fill('#password', password);
  await page.click('#signinbutton');
  await page.waitForSelector('#rstudio_console_input', {timeout: 90000});
  await waitForCoach(page);
}
async function waitForCoach(page) {
  await page.waitForFunction(() => window.__rsCoach?.demo, null, {timeout: 30000});
  await page.waitForTimeout(800);
}

const coachEl = (page, sel) => page.locator('#rs-coach-host').locator(sel);
const coachView = page => page.evaluate(() => {
  const root = document.getElementById('rs-coach-host').shadowRoot;
  return {
    steps: [...root.querySelectorAll('li[data-step]')].map(li => li.className || 'pending'),
    go: root.querySelector('.go')?.textContent,
    goDisabled: root.querySelector('.go')?.disabled,
    restartShown: root.querySelector('.restart') ? !root.querySelector('.restart').hidden : false,
    explain: root.querySelector('.explain')?.textContent || '',
    ended: root.querySelector('.ended')?.textContent || '',
    placement: window.__rsCoach.placement,
  };
});
const plotSrc = page => page.evaluate(() => {
  for (const f of document.querySelectorAll('#rstudio_workbench_panel_plots iframe')) {
    try { const img = f.contentDocument.querySelector('img'); if (img) return img.src; } catch (_e) { /* ignore */ }
  }
  return null;
});

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
    return {failed, explain, console: document.getElementById('rstudio_console_output').textContent, plot};
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
  if (step.runs.some(r => r.evidence === 'plot')) {
    assert(snap.plot && snap.plot.loaded && snap.plot.src !== plotBefore, `no new chart when the explanation appeared (${JSON.stringify(snap.plot)})`);
  }
  const quoted = [...step.explain.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
  for (const name of quoted) {
    const value = allValues[name];
    assert(value !== undefined && snap.explain.includes(value), `explanation lacks ${name}=${value}`);
    assert(snap.console.includes(value), `explanation quotes ${name}=${value}, which the Console does not show`);
  }
  return quoted.map(n => `${n}=${allValues[n]}`);
}

async function runSteps(page, manifest, from, to, tag) {
  const allValues = Object.assign({}, ...manifest.steps.flatMap(s => s.runs.map(r => r.expected_values)));
  const done = [];
  for (let i = from; i <= to; i++) {
    const before = await plotSrc(page);
    const t0 = Date.now();
    await coachEl(page, 'button.go').click();
    const snap = await settleStep(page, i);
    const quoted = verifyStep(manifest.steps[i], snap, before, allValues);
    await page.screenshot({path: path.join(OUT, `${tag}-step${i + 1}.png`)});
    done.push({step: i + 1, s: +((Date.now() - t0) / 1000).toFixed(1), quoted});
  }
  return done;
}

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

    await probe('graphical: sign in; coach docks in the sidebar and covers no other pane', async () => {
      await signIn(page, password);
      manifest = await page.evaluate(() => fetch('/coach/api/demo').then(r => r.json()));
      const g = await dockedGeometry(page);
      assert(g.parent === 'rstudio_Sidebar_pane' && g.fills && Object.keys(g.overlaps).length === 0, JSON.stringify(g));
      await page.screenshot({path: path.join(OUT, 'graphical-docked.png')});
      return g;
    });

    await probe('graphical: a changed demo script stops step 1 visibly', async () => {
      fs.writeFileSync(scriptPath, original.replace('plot(5, 5)', 'plot(5, 6)'));
      await coachEl(page, 'button.go').click();
      const snap = await settleStep(page, 0);
      const view = await coachView(page);
      assert(snap.failed && /no longer contains the line plot\(5, 5\)/.test(snap.explain), snap.explain);
      assert(view.go === 'Try this step again' && !view.goDisabled && view.restartShown, JSON.stringify(view));
      assert(!snap.console.includes('> plot(5, 6)'), 'the coach ran a line it did not expect');
      await page.screenshot({path: path.join(OUT, 'graphical-step1-failed.png')});
      return {message: snap.explain.trim()};
    });

    await probe('graphical: after the script is restored, "Try this step again" passes', async () => {
      // The learner restores the file and closes its tab (headless RStudio does not reload
      // a changed file by itself); the coach must reopen it from the Files pane.
      fs.writeFileSync(scriptPath, original);
      const tab = page.locator('#rstudio_Source_pane [role="tab"]', {hasText: 'graphical-tools.R'});
      await tab.locator('img').last().click(); // the tab's close icon (unlabelled in this RStudio build)
      await tab.waitFor({state: 'detached', timeout: 10000});
      const before = await plotSrc(page);
      await coachEl(page, 'button.go').click();
      const snap = await settleStep(page, 0);
      verifyStep(manifest.steps[0], snap, before, {});
      await page.screenshot({path: path.join(OUT, 'graphical-step1.png')});
      return {explain: snap.explain.slice(0, 60)};
    });

    await probe('graphical: steps 2-3 each explained only after a new chart is on screen', async () => runSteps(page, manifest, 1, 2, 'graphical'));

    await probe('graphical: hiding and re-showing the sidebar mid-step keeps the same coach and finishes step 4', async () => {
      const allValues = {};
      const before = await plotSrc(page);
      await coachEl(page, 'button.go').click();
      await page.waitForFunction(() => window.__rsCoach.demo.state === 'running' && window.__rsCoach.demo.actions >= 1, null, {timeout: 15000});
      await page.click('#rstudio_sidebar_toggle_button');
      await page.waitForFunction(() => window.__rsCoach.placement === 'floating', null, {timeout: 10000});
      await page.waitForTimeout(1500);
      await page.screenshot({path: path.join(OUT, 'graphical-step4-floating.png')});
      await page.click('#rstudio_sidebar_toggle_button');
      await page.waitForFunction(() => window.__rsCoach.placement === 'docked', null, {timeout: 10000});
      const snap = await settleStep(page, 3);
      verifyStep(manifest.steps[3], snap, before, allValues);
      const mounts = await page.evaluate(() => window.__rsCoach.mounts);
      assert(mounts === 1, `coach re-mounted ${mounts} times`);
      const g = await dockedGeometry(page);
      assert(g.fills && Object.keys(g.overlaps).length === 0, `after re-docking: ${JSON.stringify(g)}`);
      await page.screenshot({path: path.join(OUT, 'graphical-step4.png')});
      const view = await coachView(page);
      assert(view.steps.every(s => s === 'done') && view.go === 'Demonstration complete' && view.goDisabled, JSON.stringify(view));
      return {mounts, panel: g.panel};
    });

    await probe('graphical: reload keeps progress; Stop during a step halts RStudio actions', async () => {
      await page.reload();
      await page.waitForSelector('#rstudio_console_input', {timeout: 90000});
      await waitForCoach(page);
      const restored = await coachView(page);
      assert(restored.steps.every(s => s === 'done') && restored.go === 'Demonstration complete' && restored.restartShown, JSON.stringify(restored));
      await coachEl(page, 'button.restart').click();
      await page.waitForFunction(() => window.__rsCoach.demo.state === 'running' && window.__rsCoach.demo.actions >= 1, null, {timeout: 15000});
      await coachEl(page, 'button.stop').click();
      const atStop = await page.evaluate(() => ({actions: window.__rsCoach.demo.actions, console: document.getElementById('rstudio_console_output').textContent.length}));
      await page.waitForTimeout(4000);
      const after = await page.evaluate(() => ({actions: window.__rsCoach.demo.actions, console: document.getElementById('rstudio_console_output').textContent.length, doneAfterStop: window.__rsCoach.log.filter(l => l.type === 'demo_step_done').slice(-1)[0]?.at > window.__rsCoach.log.filter(l => l.type === 'stop').slice(-1)[0]?.at}));
      const view = await coachView(page);
      assert(/demonstration has ended/.test(view.ended), JSON.stringify(view));
      assert(after.actions === atStop.actions && !after.doneAfterStop, `actions continued after Stop: ${JSON.stringify({atStop, after})}`);
      await page.screenshot({path: path.join(OUT, 'graphical-stopped.png')});
      return {restoredGo: restored.go, actionsAtStop: atStop.actions, actionsAfter: after.actions};
    });
    await context.close();
  }

  // ---------------- statistical-tools (narrower window) ----------------
  {
    const password = provision('statistical-tools');
    const context = await browser.newContext({viewport: {width: 1366, height: 768}});
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(`statistical: ${e.message}`));
    let manifest;

    await probe('statistical (1366x768): docked coach covers no other pane', async () => {
      await signIn(page, password);
      manifest = await page.evaluate(() => fetch('/coach/api/demo').then(r => r.json()));
      const g = await dockedGeometry(page);
      assert(g.parent === 'rstudio_Sidebar_pane' && g.fills && Object.keys(g.overlaps).length === 0, JSON.stringify(g));
      return g;
    });

    await probe('statistical: steps 1-2 explained with values the Console printed', async () => runSteps(page, manifest, 0, 1, 'statistical'));

    await probe('statistical: reload resumes at step 3', async () => {
      await page.reload();
      await page.waitForSelector('#rstudio_console_input', {timeout: 90000});
      await waitForCoach(page);
      const view = await coachView(page);
      assert(view.steps[0] === 'done' && view.steps[1] === 'done' && view.go === 'Next: step 3', JSON.stringify(view));
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

    await probe('statistical: Start over recreates the data and finishes all 5 steps', async () => {
      const allValues = Object.assign({}, ...manifest.steps.flatMap(s => s.runs.map(r => r.expected_values)));
      await coachEl(page, 'button.restart').click();
      const snap = await settleStep(page, 0);
      verifyStep(manifest.steps[0], snap, null, allValues);
      const done = await runSteps(page, manifest, 1, 4, 'statistical-rerun');
      const view = await coachView(page);
      assert(view.steps.every(s => s === 'done') && view.go === 'Demonstration complete', JSON.stringify(view));
      return done;
    });

    await probe('statistical: demo script was never modified by the demonstration', async () => {
      const dirty = await page.evaluate(() => [...document.querySelectorAll('#rstudio_Source_pane [role="tab"]')].map(t => t.innerText.trim()).filter(t => t.includes('*')));
      assert(dirty.length === 0, `unsaved changes shown on: ${dirty}`);
      return {visibleUnsavedMarkers: 0};
    });
    await context.close();
  }

  await browser.close();
  const summary = {when: new Date().toISOString(), passed: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length, warnings, pageErrors: errors, results};
  fs.writeFileSync(path.join(OUT, 'demo-results.json'), JSON.stringify(summary, null, 2));
  console.log(`\n${summary.passed} passed, ${summary.failed} failed; warnings: ${warnings.length}; page errors: ${errors.length}`);
  process.exit(summary.failed || errors.length ? 1 : 0);
})();
