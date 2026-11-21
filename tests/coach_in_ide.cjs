// First-pass audit: can the injected coach live inside the RStudio Server tab
// without breaking the IDE? Drives the real IDE through the gateway and records
// each probe as pass/fail rather than stopping at the first failure.
//
//   NODE_PATH=$(npm root -g) node tests/coach_in_ide.cjs [results-dir]
const {chromium} = require('@playwright/test');
const {execFileSync} = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const GATEWAY = 'http://127.0.0.1:8788';
const DIRECT = 'http://127.0.0.1:18787';
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'results'));
const PASSWORD = fs.readFileSync(path.join(ROOT, 'run/.env'), 'utf8').match(/RSTUDIO_PASSWORD=(\S+)/)[1];
const ANALYSIS = path.join(ROOT, 'run/project/analysis.R');
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

function instrument(page, bucket) {
  page.on('console', m => { if (m.type() === 'error') bucket.consoleErrors.push(m.text().slice(0, 300)); });
  page.on('pageerror', e => bucket.pageErrors.push(e.message.slice(0, 300)));
  page.on('websocket', ws => {
    const entry = {url: ws.url(), frames: 0, closed: false};
    bucket.websockets.push(entry);
    ws.on('framereceived', () => { entry.frames += 1; });
    ws.on('close', () => { entry.closed = true; });
  });
  page.on('response', r => { if (r.status() >= 400) bucket.httpErrors.push(`${r.status()} ${r.url()}`); });
  page.on('requestfailed', r => {
    const failure = r.failure()?.errorText || '';
    // Long-poll requests are aborted on reload; that is normal.
    if (!/ERR_ABORTED/.test(failure)) bucket.failedRequests.push(`${failure} ${r.url()}`);
  });
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

async function signIn(page, base) {
  await loadSignInPage(page, `${base}/`);
  await page.fill('#username', 'rstudio');
  await page.fill('#password', PASSWORD);
  const t0 = Date.now();
  await page.click('#signinbutton');
  await page.waitForSelector('#rstudio_console_input', {timeout: 90000});
  await consoleIdle(page);
  return Date.now() - t0;
}

async function consoleIdle(page) {
  // R is ready when the console shows a prompt and is not busy. (Don't rely on the
  // startup banner: a reconnect to an existing session may have a cleared console.)
  await page.waitForFunction(() => {
    const prompt = document.querySelector('#rstudio_console_input')?.closest('[id="rstudio_shell_widget"]')?.textContent || '';
    return document.getElementById('rstudio_console_output') && /> ?/.test(prompt) && !document.querySelector('#rstudio_console_input.ace_read-only');
  }, null, {timeout: 90000});
  await page.waitForTimeout(500);
}

async function runInConsole(page, code, expect, timeout = 20000) {
  if (!(await page.isVisible('#rstudio_console_input'))) await page.click('#rstudio_workbench_tab_console');
  await page.click('#rstudio_console_input');
  await page.keyboard.type(code);
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    ([needle]) => document.getElementById('rstudio_console_output')?.textContent.includes(needle),
    [expect], {timeout});
}

const coachState = page => page.evaluate(() => {
  const c = window.__rsCoach;
  const host = document.getElementById('rs-coach-host');
  const root = host?.shadowRoot;
  const panel = root?.querySelector('.panel');
  const r = panel?.getBoundingClientRect();
  return c && {
    hosts: document.querySelectorAll('#rs-coach-host').length,
    placement: c.placement,
    mounts: c.mounts,
    keyShield: c.keyShield,
    session: c.session,
    log: c.log.map(l => l.type),
    status: root?.querySelector('.status')?.textContent,
    goalsDone: [...(root?.querySelectorAll('li.done') || [])].map(li => li.dataset.goal),
    panel: r && {x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height)},
  };
});

// RStudio keeps a "*" in every Source tab's DOM and only displays it when the document
// has unsaved changes, so read the rendered text (innerText), not textContent.
const tabShows = (page, name) => page.evaluate(name => [...document.querySelectorAll('#rstudio_Source_pane [role="tab"]')]
  .find(t => t.textContent.includes(name))?.innerText.replace(/\s+/g, ''), name);

const coachEl = (page, sel) => page.locator('#rs-coach-host').locator(sel); // Playwright pierces open shadow roots

(async () => {
  const browser = await chromium.launch();
  const bucket = {consoleErrors: [], pageErrors: [], websockets: [], httpErrors: [], failedRequests: []};
  const context = await browser.newContext({viewport: {width: 1440, height: 900}});
  const page = await context.newPage();
  instrument(page, bucket);
  const metrics = {};

  await probe('sign in through gateway and IDE loads', async () => {
    metrics.gatewayLoadMs = await signIn(page, GATEWAY);
    const title = await page.title();
    assert(/regional-revenue/.test(title), `project not open, title=${title}`);
    return {loadMs: metrics.gatewayLoadMs, title};
  });

  await probe('coach mounts once in the top window only', async () => {
    await page.waitForFunction(() => window.__rsCoach?.session, null, {timeout: 10000});
    const s = await coachState(page);
    assert(s.hosts === 1 && s.mounts === 1, `hosts=${s.hosts} mounts=${s.mounts}`);
    const framesWithCoach = [];
    for (const f of page.frames()) {
      if (f === page.mainFrame()) continue;
      if (await f.evaluate(() => !!window.__rsCoach || !!document.getElementById('rs-coach-host')).catch(() => false)) framesWithCoach.push(f.url());
    }
    assert(framesWithCoach.length === 0, `coach in frames: ${framesWithCoach}`);
    return {session: s.session, frames: page.frames().length, goalsDone: s.goalsDone};
  });

  await probe('coach docks in the sidebar and covers no other pane', async () => {
    const g = await page.evaluate(() => {
      const host = document.getElementById('rs-coach-host');
      const panel = host.shadowRoot.querySelector('.panel').getBoundingClientRect();
      const sidebar = document.getElementById('rstudio_Sidebar_pane').getBoundingClientRect();
      return {parent: host.parentElement.id, placement: window.__rsCoach.placement,
        fills: sidebar.width - panel.width <= 4 && sidebar.height - panel.height <= 4,
        sidebar: [sidebar.x, sidebar.y, sidebar.width, sidebar.height].map(Math.round)};
    });
    assert(g.parent === 'rstudio_Sidebar_pane' && g.placement === 'docked' && g.fills, JSON.stringify(g));
    return g;
  });

  await probe('R runs in the Console (event long-poll through gateway)', async () => {
    await runInConsole(page, 'orders <- read.csv("data/orders.csv"); cat("rows:", nrow(orders), "\\n")', 'rows: 9');
    await page.waitForSelector('#rstudio_workbench_panel_environment >> text=orders', {timeout: 10000});
    return {environmentShowsOrders: true};
  });

  await probe('open analysis.R from the Files pane; coach observes it', async () => {
    await page.locator('#rstudio_workbench_panel_files').getByText('analysis.R', {exact: true}).click();
    await page.waitForSelector('[role="tab"]:has-text("analysis.R")', {timeout: 15000});
    await page.waitForFunction(() => window.__rsCoach && document.getElementById('rs-coach-host').shadowRoot.querySelector('li[data-goal="script"].done'), null, {timeout: 5000});
    const sourcePane = await page.evaluate(() => !!document.getElementById('rstudio_Source_pane')?.offsetParent);
    return {goalsDone: (await coachState(page)).goalsDone, sourcePaneId: sourcePane};
  });

  await probe('edit and save analysis.R in Source pane (saved to disk)', async () => {
    const editor = page.locator('#rstudio_Source_pane .ace_content').first();
    await editor.click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type('\n# saved-through-gateway\n');
    await page.keyboard.press('Control+s');
    for (let i = 0; i < 40 && (await tabShows(page, 'analysis.R')) !== 'analysis.R'; i++) await page.waitForTimeout(250);
    assert((await tabShows(page, 'analysis.R')) === 'analysis.R', 'tab still shows unsaved marker after Ctrl+S');
    for (let i = 0; i < 20 && !fs.readFileSync(ANALYSIS, 'utf8').includes('saved-through-gateway'); i++) await page.waitForTimeout(250);
    assert(fs.readFileSync(ANALYSIS, 'utf8').includes('saved-through-gateway'), 'saved text not on disk');
    return {onDisk: true};
  });

  await probe('unsaved edit stays off disk and RStudio shows its unsaved marker', async () => {
    const clean = await tabShows(page, 'analysis.R');
    await page.keyboard.type('# unsaved-edit\n');
    await page.waitForTimeout(800);
    const dirty = await tabShows(page, 'analysis.R');
    const disk = fs.readFileSync(ANALYSIS, 'utf8');
    assert(!disk.includes('unsaved-edit'), 'unsaved text reached disk');
    assert(clean === 'analysis.R' && dirty === 'analysis.R*', JSON.stringify({clean, dirty}));
    return {shownWhenClean: clean, shownWhenUnsaved: dirty};
  });

  // Typing into the coach must not leak into RStudio, and RStudio shortcuts must not hijack it.
  async function coachTypingTrial(label) {
    const textarea = coachEl(page, 'textarea.answer');
    await textarea.fill('');
    await textarea.click();
    const consoleBefore = await page.evaluate(() => document.querySelector('#rstudio_console_input .ace_text-layer')?.textContent || '');
    const sourceBefore = await page.evaluate(() => document.querySelector('#rstudio_Source_pane .ace_text-layer')?.textContent || '');
    await page.keyboard.type('North leads? 3 < 4 & (x)');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('line two');
    await page.keyboard.press('Control+Enter'); // RStudio: run current line/selection
    await page.keyboard.press('Control+2');     // RStudio: move focus to Console
    await page.keyboard.type(' still-here');
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => {
      const root = document.getElementById('rs-coach-host').shadowRoot;
      return {
        value: root.querySelector('textarea.answer').value,
        focusInCoach: document.activeElement?.id === 'rs-coach-host' && root.activeElement?.classList.contains('answer'),
        consoleInput: document.querySelector('#rstudio_console_input .ace_text-layer')?.textContent || '',
        source: document.querySelector('#rstudio_Source_pane .ace_text-layer')?.textContent || '',
      };
    });
    const expected = 'North leads? 3 < 4 & (x)\nline two still-here';
    return {
      label,
      valueOk: after.value === expected,
      value: after.value,
      focusInCoach: after.focusInCoach,
      consoleChanged: after.consoleInput !== consoleBefore,
      sourceChanged: after.source !== sourceBefore,
    };
  }

  const CHORDS = ['Control+Enter', 'Control+1', 'Control+2', 'Control+l', 'Control+Period', 'Control+Shift+n', 'Alt+Shift+k', 'F1', 'Escape'];
  async function shortcutMatrix() {
    const textarea = coachEl(page, 'textarea.answer');
    const snap = () => page.evaluate(() => {
      const root = document.getElementById('rs-coach-host').shadowRoot;
      const shown = el => el.offsetParent && el.getBoundingClientRect().height > 0;
      return {
        focusInCoach: root.activeElement?.classList.contains('answer') || false,
        consoleLen: document.getElementById('rstudio_console_output').textContent.length,
        tabs: [...document.querySelectorAll('[role="tab"]')].map(t => t.textContent.trim()),
        popups: [...document.querySelectorAll('.gwt-PopupPanel, .gwt-DialogBox, [role="dialog"], [role="menu"]')].filter(shown).length,
      };
    });
    const out = {};
    for (const chord of CHORDS) {
      await textarea.click();
      const before = await snap();
      await page.keyboard.press(chord);
      await page.waitForTimeout(600);
      const after = await snap();
      const effects = [];
      if (!after.focusInCoach) effects.push('focus left coach');
      if (after.consoleLen < before.consoleLen) effects.push('console cleared');
      if (after.consoleLen > before.consoleLen) effects.push('console output');
      const newTabs = after.tabs.filter(t => !before.tabs.includes(t));
      if (newTabs.length) effects.push(`new tab ${newTabs.join(',')}`);
      if (after.popups > before.popups) effects.push('popup opened');
      out[chord] = effects.length ? effects.join('; ') : 'none';
      if (!after.focusInCoach || after.popups > before.popups) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    }
    return out;
  }

  await probe('RStudio shortcuts pressed in the coach textarea (key shield on)', async () => {
    const m = await shortcutMatrix();
    const leaks = Object.entries(m).filter(([, v]) => v !== 'none');
    assert(leaks.length === 0, JSON.stringify(m));
    return m;
  });

  await probe('typing in coach is isolated from RStudio (key shield on)', async () => {
    const r = await coachTypingTrial('shield-on');
    assert(r.valueOk && r.focusInCoach && !r.consoleChanged && !r.sourceChanged, JSON.stringify(r));
    return r;
  });

  await probe('coach keeps focus while R prints output', async () => {
    const textarea = coachEl(page, 'textarea.answer');
    await runInConsole(page, 'Sys.sleep(2); cat("sleep-finished\\n")', 'Sys.sleep(2)', 5000);
    await textarea.fill('');
    await textarea.click();
    await page.keyboard.type('typing while R works');
    await page.waitForFunction(() => document.getElementById('rstudio_console_output').textContent.includes('sleep-finished'), null, {timeout: 10000});
    await page.keyboard.type(' and after');
    const r = await page.evaluate(() => {
      const root = document.getElementById('rs-coach-host').shadowRoot;
      return {value: root.querySelector('textarea.answer').value, focusInCoach: root.activeElement?.classList.contains('answer')};
    });
    assert(r.value === 'typing while R works and after' && r.focusInCoach, JSON.stringify(r));
    return r;
  });

  await probe('Check work round-trips to coach service', async () => {
    const [res] = await Promise.all([
      page.waitForResponse(r => r.url().endsWith('/coach/api/check')),
      coachEl(page, 'button.check').click(),
    ]);
    await page.waitForTimeout(200);
    const s = await coachState(page);
    assert(res.status() === 200 && /Save analysis\.R/.test(s.status), `status ${res.status()} text ${s.status}`);
    return {http: res.status(), status: s.status};
  });

  await probe('highlight attaches to Console and does not block clicks', async () => {
    await coachEl(page, 'button.show-console').click();
    const geom = await page.evaluate(() => {
      const hl = document.getElementById('rs-coach-overlay').shadowRoot.querySelector('.box');
      const pane = document.getElementById('rstudio_Console_pane').getBoundingClientRect();
      const h = hl.getBoundingClientRect();
      return {hidden: hl.hidden, dx: Math.abs(h.x + 3 - pane.x), dy: Math.abs(h.y + 3 - pane.y), dw: Math.abs(h.width - 6 - pane.width)};
    });
    assert(!geom.hidden && geom.dx < 4 && geom.dy < 4 && geom.dw < 4, JSON.stringify(geom));
    await page.screenshot({path: path.join(OUT, 'highlight-console.png')});
    await runInConsole(page, 'cat("click-through", 2 + 2, "\\n")', 'click-through 4');
    return geom;
  });

  await probe('sidebar hidden: coach floats, collapses and drags; shown again: re-docks', async () => {
    await page.click('#rstudio_sidebar_toggle_button');
    await page.waitForFunction(() => window.__rsCoach.placement === 'floating', null, {timeout: 10000});
    await page.waitForTimeout(500);
    await coachEl(page, 'button.collapse').click();
    const collapsed = (await coachState(page)).panel;
    await coachEl(page, 'button.collapse').click();
    const header = coachEl(page, 'header strong');
    const box = await header.boundingBox();
    await page.mouse.move(box.x + 10, box.y + 5);
    await page.mouse.down();
    await page.mouse.move(box.x - 600, box.y - 300, {steps: 8});
    await page.mouse.up();
    const moved = (await coachState(page)).panel;
    assert(collapsed.h < 60 && moved.x < box.x - 400, JSON.stringify({collapsed, moved}));
    await page.screenshot({path: path.join(OUT, 'floating.png')});
    await page.click('#rstudio_sidebar_toggle_button');
    await page.waitForFunction(() => window.__rsCoach.placement === 'docked', null, {timeout: 10000});
    const s = await coachState(page);
    assert(s.hosts === 1 && s.mounts === 1, `re-docking re-mounted the coach: ${JSON.stringify(s)}`);
    return {collapsedHeight: collapsed.h, movedTo: moved, redocked: true, mounts: s.mounts};
  });

  await probe('Help pane iframe renders without the coach', async () => {
    await runInConsole(page, '?mean', '?mean');
    let helpFrame;
    for (let i = 0; i < 60 && !helpFrame; i++) {
      helpFrame = page.frames().find(f => /\/help\/library\/base\/html\/mean\.html/.test(f.url()));
      if (!helpFrame) await page.waitForTimeout(250);
    }
    assert(helpFrame, `no help frame; frames=${JSON.stringify(page.frames().map(f => f.url()))}`);
    await helpFrame.waitForSelector('text=Arithmetic Mean', {timeout: 10000});
    const coachInFrame = await helpFrame.evaluate(() => !!window.__rsCoach || !!document.querySelector('script[src*="coach.js"]'));
    assert(!coachInFrame, 'coach injected into help iframe');
    return {helpUrl: helpFrame.url().replace(GATEWAY, '')};
  });

  await probe('Terminal works (WebSocket through gateway)', async () => {
    const before = bucket.websockets.length;
    await page.click('#rstudio_workbench_tab_terminal');
    await page.waitForSelector('#rstudio_workbench_panel_terminal .xterm', {timeout: 30000});
    await page.waitForTimeout(1500);
    await page.click('#rstudio_workbench_panel_terminal .xterm');
    const proof = path.join(ROOT, 'run/project/terminal-proof.txt');
    try {
      await page.keyboard.type('echo ws-ok-$((6*7)) > ~/regional-revenue/terminal-proof.txt');
      await page.keyboard.press('Enter');
      for (let i = 0; i < 60 && !fs.existsSync(proof); i++) await page.waitForTimeout(250);
      await page.screenshot({path: path.join(OUT, 'terminal.png')});
      const written = fs.existsSync(proof) && fs.readFileSync(proof, 'utf8').trim();
      const sockets = bucket.websockets.slice(before).map(w => ({url: w.url.replace(GATEWAY.replace('http', 'ws'), ''), frames: w.frames}));
      const renderer = await page.evaluate(() => {
        const t = document.querySelector('#rstudio_workbench_panel_terminal .xterm');
        return {canvas: !!t?.querySelector('canvas'), domRows: (t?.querySelector('.xterm-rows')?.textContent || '').length};
      });
      assert(written === 'ws-ok-42', `terminal command did not run (file=${written}) sockets=${JSON.stringify(sockets)}`);
      return {written, sockets, renderer};
    } finally {
      await page.click('#rstudio_workbench_tab_console').catch(() => {});
    }
  });

  await probe('reload: coach re-mounts once, R session and open file survive', async () => {
    await runInConsole(page, 'kept_value <- 42L', 'kept_value <- 42L');
    await page.reload();
    await page.waitForSelector('#rstudio_console_input', {timeout: 90000});
    await page.waitForFunction(() => window.__rsCoach?.session, null, {timeout: 20000});
    await page.waitForSelector('[role="tab"]:has-text("analysis.R")', {timeout: 20000});
    await page.waitForTimeout(1000);
    await runInConsole(page, 'cat("kept:", kept_value, "\\n")', 'kept: 42');
    const s = await coachState(page);
    assert(s.hosts === 1 && s.mounts === 1, JSON.stringify(s));
    return {hosts: s.hosts, mounts: s.mounts, goalsDone: s.goalsDone};
  });

  await probe('A/B: without key shield, does RStudio interfere with coach typing?', async () => {
    await page.evaluate(() => localStorage.setItem('rsCoachNoKeyShield', '1'));
    await page.reload();
    await page.waitForSelector('#rstudio_console_input', {timeout: 90000});
    await page.waitForFunction(() => window.__rsCoach?.session, null, {timeout: 20000});
    await page.waitForTimeout(1500);
    assert((await coachState(page)).keyShield === false, 'shield still on');
    const r = await coachTypingTrial('shield-off');
    const matrix = await shortcutMatrix();
    await page.evaluate(() => localStorage.removeItem('rsCoachNoKeyShield'));
    return {typing: r, matrix}; // informational: what RStudio does without the shield
  });

  await probe('no AI assistant even after the learner re-enables one in their preferences', async () => {
    const prefs = '/home/rstudio/.config/rstudio/rstudio-prefs.json';
    const script = `import json; d = json.load(open("${prefs}")); d.update({"assistant": "posit", "chat_provider": "posit", "assistant_toolbar_button_visible": True, "copilot_enabled": True}); json.dump(d, open("${prefs}", "w"))`;
    execFileSync('docker', ['compose', '--env-file', 'run/.env', 'exec', '-T', '-u', 'rstudio', 'rstudio', 'python3', '-c', script], {cwd: ROOT});
    await page.reload();
    await page.waitForSelector('#rstudio_console_input', {timeout: 90000});
    await page.waitForFunction(() => window.__rsCoach?.session, null, {timeout: 20000});
    await page.waitForTimeout(3000);
    const mentions = [];
    for (const f of page.frames()) {
      const text = await f.evaluate(() => document.body?.innerText || '').catch(() => '');
      for (const m of text.match(/[^\n]*(Posit Assistant|Copilot|Install Posit)[^\n]*/g) || []) mentions.push(m.trim().slice(0, 80));
    }
    const ui = await page.evaluate(() => ({
      toolbarButton: !!document.getElementById('rstudio_assistant_toggle_button')?.offsetParent,
      sidebarTabs: [...document.querySelectorAll('#rstudio_Sidebar_pane [role="tab"]')].map(t => t.textContent.trim()),
      placement: window.__rsCoach.placement,
    }));
    assert(!ui.toolbarButton && ui.sidebarTabs.length === 0 && mentions.length === 0 && ui.placement === 'docked', JSON.stringify({ui, mentions}));
    return ui;
  });

  // R's record of the learner's work (runtime/evidence.R) is served only to a browser signed in to
  // RStudio, and no other site's page can read it. R also lists the working directory's files every
  // second for it; before that walk was bounded, setwd("/") froze R for minutes.
  await probe('evidence: served only when signed in, never across sites; setwd("/") leaves R responsive', async () => {
    const mine = await page.evaluate(() => fetch('/coach/api/evidence', {cache: 'no-store'})
      .then(async r => ({status: r.status, type: r.headers.get('content-type'), nosniff: r.headers.get('x-content-type-options'), session: r.ok ? (await r.json()).session : null})));
    assert(mine.status === 200 && /^application\/json/.test(mine.type) && mine.nosniff === 'nosniff' && mine.session, JSON.stringify(mine));
    const anonymous = await browser.newContext();
    const statuses = {};
    for (const p of ['/coach/api/evidence', '/coach//api/evidence', '/coach/api/%65vidence', '/coach/__signed_in', '/coach/api/evidence.json']) {
      statuses[p] = (await anonymous.request.get(`${GATEWAY}${p}`, {maxRedirects: 0})).status();
    }
    await anonymous.close();
    assert(JSON.stringify(Object.values(statuses)) === '[401,401,401,404,404]', JSON.stringify(statuses));
    // Asked from another site's page, the browser would send RStudio's cookies; with no CORS header
    // in the answer, that page still can't read it.
    const userAgent = await page.evaluate(() => navigator.userAgent); // RStudio turns other user agents away
    const crossSite = await page.request.get(`${GATEWAY}/coach/api/evidence`, {headers: {Origin: 'https://example.com', 'User-Agent': userAgent}});
    assert(crossSite.status() === 200 && !('access-control-allow-origin' in crossSite.headers()), JSON.stringify({status: crossSite.status(), headers: crossSite.headers()}));
    // The Console's output must not be in the code typed, or the echo would match at once.
    await runInConsole(page, 'lab_wd <- setwd("/"); cat("wd", "moved", sep = "-")', 'wd-moved');
    await page.waitForTimeout(3000); // three of R's once-a-second listings
    const asked = Date.now();
    await runInConsole(page, 'cat("still", "responsive", sep = "-")', 'still-responsive', 10000);
    const answeredMs = Date.now() - asked;
    const state = await page.evaluate(() => fetch('/coach/api/evidence', {cache: 'no-store'}).then(r => r.json()).then(d => ({wd: d.state?.wd, files: d.state?.files?.length})));
    await runInConsole(page, 'setwd(lab_wd); rm(lab_wd); cat("wd", "back", sep = "-")', 'wd-back');
    assert(state.wd === '/' && state.files <= 500, JSON.stringify(state));
    return {statuses, answeredMs, filesListedFromRoot: state.files};
  });

  // Viewport fit: where does the panel land, and what does it cover?
  for (const vp of [{width: 1366, height: 768}, {width: 1920, height: 1080}]) {
    await probe(`viewport ${vp.width}x${vp.height}: panel fits and IDE usable`, async () => {
      await page.setViewportSize(vp);
      await page.reload();
      await page.waitForSelector('#rstudio_console_input', {timeout: 90000});
      await page.waitForFunction(() => window.__rsCoach?.session, null, {timeout: 20000});
      await page.waitForTimeout(1500);
      const s = await coachState(page);
      const covers = await page.evaluate(panel => {
        const ids = ['rstudio_Source_pane', 'rstudio_Console_pane', 'rstudio_TabSet1_pane', 'rstudio_TabSet2_pane'];
        const out = {};
        for (const id of ids) {
          const el = document.getElementById(id);
          if (!el?.offsetParent) continue;
          const r = el.getBoundingClientRect();
          const ix = Math.max(0, Math.min(r.right, panel.x + panel.w) - Math.max(r.left, panel.x));
          const iy = Math.max(0, Math.min(r.bottom, panel.y + panel.h) - Math.max(r.top, panel.y));
          if (ix * iy > 0) out[id] = `${Math.round(100 * ix * iy / (r.width * r.height))}%`;
        }
        return out;
      }, s.panel);
      const inside = s.panel.x >= 0 && s.panel.y >= 0 && s.panel.x + s.panel.w <= vp.width && s.panel.y + s.panel.h <= vp.height;
      await page.screenshot({path: path.join(OUT, `viewport-${vp.width}x${vp.height}.png`)});
      await runInConsole(page, `cat("vp-${vp.width}\\n")`, `vp-${vp.width}`);
      assert(inside, `panel off-screen ${JSON.stringify(s.panel)}`);
      assert(s.placement === 'docked' && Object.keys(covers).length === 0, `docked=${s.placement} covers=${JSON.stringify(covers)}`);
      return {placement: s.placement, panel: s.panel, panePercentCovered: covers};
    });
  }

  await page.close();

  // Baseline: same IDE without the gateway, to tell RStudio's own noise from coach/gateway faults.
  const baseline = {consoleErrors: [], pageErrors: [], websockets: [], httpErrors: [], failedRequests: []};
  await probe('baseline: direct RStudio (no gateway) for comparison', async () => {
    const ctx = await browser.newContext({viewport: {width: 1440, height: 900}});
    const p = await ctx.newPage();
    instrument(p, baseline);
    metrics.directLoadMs = await signIn(p, DIRECT);
    await runInConsole(p, 'cat("direct-ok\\n")', 'direct-ok');
    const coach = await p.evaluate(() => !!window.__rsCoach);
    await ctx.close();
    return {loadMs: metrics.directLoadMs, coachPresent: coach};
  });

  await browser.close();

  const summary = {
    when: new Date().toISOString(),
    passed: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
    metrics,
    warnings,
    results,
    gateway: bucket,
    direct: baseline,
  };
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(summary, null, 2));
  console.log(`\n${summary.passed} passed, ${summary.failed} failed; warnings: ${warnings.length}`);
  console.log('gateway page errors:', bucket.pageErrors.length, ' console errors:', bucket.consoleErrors.length, ' http>=400:', bucket.httpErrors.length, ' failed requests:', bucket.failedRequests.length);
  console.log('direct  page errors:', baseline.pageErrors.length, ' console errors:', baseline.consoleErrors.length, ' http>=400:', baseline.httpErrors.length, ' failed requests:', baseline.failedRequests.length);
  process.exit(summary.failed ? 1 : 0);
})();
