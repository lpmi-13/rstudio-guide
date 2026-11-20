// Phase 0, spikes S5 (switching lesson) and S7 (lesson 6's new project).
//
// S5: how long Restart R takes at different session ages, whether a script reset (open, edit,
// save) and a Console clear straight after it work, and whether attaching duckplyr changes later
// dplyr results and whether a restart undoes that.
// S7: create a project from File > New Project..., check the coach survives the page reload, then
// return to the lab's project from the project menu.
//
//   NODE_PATH=$(npm root -g) node spikes/phase0/s5_s7_session.cjs results/spikes
const fs = require('fs');
const path = require('path');
const {chromium} = require('@playwright/test');
const {ROOT, provision, signIn} = require('../../tests/lib.cjs');

const HELPERS = () => {
  if (window.__spike) return;
  const shown = el => Boolean(el && el.offsetParent !== null && el.getClientRects().length);
  const fire = (el, types) => {
    const r = el.getBoundingClientRect();
    const init = {bubbles: true, cancelable: true, composed: true, view: window, button: 0, buttons: 1,
      clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1, pointerType: 'mouse', isPrimary: true};
    for (const type of types) el.dispatchEvent(type.startsWith('pointer') ? new PointerEvent(type, init) : new MouseEvent(type, init));
  };
  const press = el => fire(el, ['pointerover', 'mouseover', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']);
  const menubar = name => [...document.querySelectorAll('[role="menubar"] [role="menuitem"]')].find(e => shown(e) && e.textContent.trim() === name);
  const menuItem = re => [...document.querySelectorAll('[role="menu"] [role="menuitem"]')].find(e => shown(e) && re.test(e.textContent.trim().replace(/\s+/g, ' ')));
  const dialog = re => [...document.querySelectorAll('.gwt-DialogBox, [role="dialog"]')].find(d => shown(d) && re.test(d.textContent));
  const editor = () => [...document.querySelectorAll('#rstudio_Source_pane .ace_editor')].find(e => shown(e) && e.env?.editor)?.env.editor;
  const tab = name => [...document.querySelectorAll('#rstudio_Source_pane [role="tab"]')].find(t => shown(t) && t.textContent.trim().replace(/\*$/, '') === name);
  const leaf = (scope, text) => [...(scope || document).querySelectorAll('*')].find(el => el.childElementCount === 0 && shown(el) && el.textContent.trim() === text);
  window.__spike = {shown, fire, press, menubar, menuItem, dialog, editor, tab, leaf};
};

async function main(outDir) {
  fs.mkdirSync(outDir, {recursive: true});
  const password = provision('statistical-tools');
  fs.writeFileSync(path.join(ROOT, 'run/project/reset-me.R'), '# Step 1. Heading\n\n');
  const browser = await chromium.launch();
  const page = await browser.newPage({viewport: {width: 1440, height: 900}});
  const signedInAt = Date.now();
  await signIn(page, password, null);
  const results = {};
  const evidence = () => page.evaluate(() => fetch('/coach/api/evidence', {cache: 'no-store'}).then(r => (r.ok ? r.json() : {})).catch(() => ({})));
  const waitFor = (fn, arg, ms = 20000) => page.waitForFunction(fn, arg, {timeout: ms, polling: 100}).then(h => h.jsonValue());
  const consoleType = async code => {
    await page.click('#rstudio_console_input');
    await page.keyboard.insertText(code);
    await page.keyboard.press('Enter');
  };
  const consoleSays = re => waitFor(re => new RegExp(re).test(document.getElementById('rstudio_console_output')?.textContent || ''), re.source, 20000);
  async function probe(name, fn) {
    const t0 = Date.now();
    try {
      await page.evaluate(HELPERS);
      const detail = await fn();
      results[name] = {ok: true, ms: Date.now() - t0, ...detail};
      console.log(`PASS  ${name}  ${JSON.stringify(detail)}`);
    } catch (e) {
      results[name] = {ok: false, ms: Date.now() - t0, error: String(e.message || e).split('\n')[0]};
      console.log(`FAIL  ${name}  ${results[name].error}`);
      await page.screenshot({path: path.join(outDir, `s5s7-fail-${name.slice(0, 40).replace(/[^\w]+/g, '-')}.png`)});
    }
  }
  const restart = async () => {
    const before = (await evidence()).session;
    const t0 = Date.now();
    await page.evaluate(() => window.__spike.press(window.__spike.menubar('Session')));
    await waitFor(() => Boolean(window.__spike.menuItem(/^Restart R/)), null, 5000);
    await page.evaluate(() => window.__spike.press(window.__spike.menuItem(/^Restart R/)));
    for (;;) {
      const e = await evidence();
      if (e.session && e.session !== before) return Date.now() - t0;
      if (Date.now() - t0 > 60000) throw new Error('no new R session within 60 s');
      await page.waitForTimeout(100);
    }
  };

  // S5: restart times. The first is asked for as early as the evidence shows an R session.
  await probe('S5 Restart R at different session ages', async () => {
    await waitFor(() => true, null);
    for (let i = 0; i < 100 && !(await evidence()).session; i += 1) await page.waitForTimeout(100);
    const times = [];
    times.push({askedAtS: Math.round((Date.now() - signedInAt) / 1000), tookMs: await restart()});
    times.push({askedAtS: Math.round((Date.now() - signedInAt) / 1000), what: 'straight after the previous restart', tookMs: await restart()});
    const wait = 45000 - (Date.now() - signedInAt);
    if (wait > 0) await page.waitForTimeout(wait);
    times.push({askedAtS: Math.round((Date.now() - signedInAt) / 1000), tookMs: await restart()});
    return {times};
  });

  await probe('S5 Script reset and Console clear straight after Restart R', async () => {
    await consoleType('stale <- 1');
    await page.waitForTimeout(800);
    const restartMs = await restart();
    const t0 = Date.now();
    // Open the script from Files, replace its text, save, clear the Console: the coach's reset.
    await page.evaluate(() => {
      const files = document.getElementById('rstudio_workbench_panel_files');
      if (!window.__spike.shown(files)) window.__spike.press(document.getElementById('rstudio_workbench_tab_files'));
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => window.__spike.press(window.__spike.leaf(document.getElementById('rstudio_workbench_panel_files'), 'reset-me.R')));
    await waitFor(() => window.__spike.tab('reset-me.R')?.getAttribute('aria-selected') === 'true', null, 15000);
    const opened = Date.now() - t0;
    await page.evaluate(() => { const e = window.__spike.editor(); e.setValue('# Step 1. Heading\n\n# reset after restart\n', -1); });
    await page.evaluate(() => window.__spike.press([...document.querySelectorAll('#rstudio_Source_pane button')].find(b => window.__spike.shown(b) && /^Save current document/.test(b.title))));
    await waitFor(() => !(window.__spike.tab('reset-me.R')?.innerText || '').includes('*'), null, 15000);
    const saved = Date.now() - t0;
    await page.evaluate(() => window.__spike.press(document.getElementById('rstudio_tb_consoleclear')));
    await waitFor(() => !(document.getElementById('rstudio_console_output')?.textContent || '').includes('stale <- 1'), null, 15000);
    const onDisk = fs.readFileSync(path.join(ROOT, 'run/project/reset-me.R'), 'utf8');
    return {restartMs, openedMs: opened, savedMs: saved, clearedMs: Date.now() - t0, diskUpdated: onDisk.includes('reset after restart')};
  });

  await probe('S5 duckplyr: what attaching it changes, and whether Restart R undoes it', async () => {
    const before = (await evidence()).calls?.length || 0;
    const show = async code => {
      const seq = (await evidence()).seq || 0;
      await consoleType(code);
      for (let i = 0; i < 100; i += 1) {
        const c = ((await evidence()).calls || []).find(x => x.seq > seq);
        if (c) return c;
        await page.waitForTimeout(100);
      }
      throw new Error(`no evidence for ${code}`);
    };
    await consoleType('library(dplyr)');
    await page.waitForTimeout(1500);
    const plain = await show('tibble::tibble(a = 1:3) |> mutate(b = a * 2)');
    const plainClass = await show('class(tibble::tibble(a = 1:3) |> mutate(b = a * 2))');
    const consoleBefore = await page.evaluate(() => document.getElementById('rstudio_console_output').textContent.length);
    await consoleType('library(duckplyr)');
    await page.waitForTimeout(4000);
    const attachText = await page.evaluate(n => document.getElementById('rstudio_console_output').textContent.slice(n), consoleBefore);
    const duck = await show('tibble::tibble(a = 1:3) |> mutate(b = a * 2)');
    const duckClassText = await page.evaluate(() => document.getElementById('rstudio_console_output').textContent.length);
    await consoleType('class(tibble::tibble(a = 1:3) |> mutate(b = a * 2))');
    await page.waitForTimeout(1200);
    const duckClass = await page.evaluate(n => document.getElementById('rstudio_console_output').textContent.slice(n), duckClassText);
    await restart();
    await page.waitForTimeout(1500);
    await consoleType('library(dplyr)');
    await page.waitForTimeout(1500);
    const afterText = await page.evaluate(() => document.getElementById('rstudio_console_output').textContent.length);
    await consoleType('c(loaded = "duckplyr" %in% loadedNamespaces(), class = class(tibble::tibble(a = 1:3) |> mutate(b = a * 2))[1])');
    await page.waitForTimeout(1200);
    const after = await page.evaluate(n => document.getElementById('rstudio_console_output').textContent.slice(n), afterText);
    return {sameFingerprint: plain.fp === duck.fp, plainClass: plainClass.class, attachMessage: attachText.replace(/\s+/g, ' ').slice(0, 400),
      duckClass: duckClass.replace(/\s+/g, ' ').slice(0, 160), afterRestart: after.replace(/\s+/g, ' ').slice(0, 160), callsBefore: before};
  });

  // S7: lesson 6's "create a project", then back to the lab's project.
  await probe('S7 New Project > New Directory > New Project, and the coach after the reload', async () => {
    await page.evaluate(() => window.__spike.press(window.__spike.menubar('File')));
    await waitFor(() => Boolean(window.__spike.menuItem(/^New Project/)), null, 5000);
    await page.evaluate(() => window.__spike.press(window.__spike.menuItem(/^New Project/)));
    await waitFor(() => Boolean(window.__spike.dialog(/New Project Wizard/)), null, 10000);
    const steps = [];
    for (const label of ['New Directory', 'New Project']) {
      await waitFor(label => Boolean(window.__spike.leaf(window.__spike.dialog(/New Project Wizard/), label)), label, 10000);
      await page.evaluate(label => window.__spike.press(window.__spike.leaf(window.__spike.dialog(/New Project Wizard/), label)), label);
      steps.push(label);
      await page.waitForTimeout(800);
    }
    await waitFor(() => Boolean([...window.__spike.dialog(/New Project Wizard/).querySelectorAll('input[type="text"]')].find(window.__spike.shown)), null, 10000);
    await page.evaluate(() => {
      const d = window.__spike.dialog(/New Project Wizard/);
      const input = [...d.querySelectorAll('input[type="text"]')].find(window.__spike.shown);
      input.focus();
      input.value = 'practice';
      input.dispatchEvent(new Event('input', {bubbles: true}));
      input.dispatchEvent(new KeyboardEvent('keyup', {bubbles: true, key: 'e'}));
      input.dispatchEvent(new Event('change', {bubbles: true}));
    });
    await page.waitForTimeout(400);
    const navigated = page.waitForNavigation({timeout: 60000}).catch(() => null);
    await page.evaluate(() => window.__spike.press([...window.__spike.dialog(/New Project Wizard/).querySelectorAll('button')].find(b => window.__spike.shown(b) && b.textContent.trim() === 'Create Project')));
    const t0 = Date.now();
    await navigated;
    await page.waitForSelector('#rstudio_console_input', {timeout: 90000});
    await page.waitForFunction(() => window.__rsCoach && window.__rsCoach.mode !== undefined, null, {timeout: 30000});
    let wd = null;
    for (let i = 0; i < 100 && !(wd || '').endsWith('/practice'); i += 1) { wd = (await evidence()).state?.wd; await page.waitForTimeout(200); }
    const coach = await page.evaluate(() => ({mounted: document.querySelectorAll('#rs-coach-host').length, mode: window.__rsCoach.mode}));
    const projectLabel = await page.evaluate(() => document.getElementById('rstudio_project_menubutton_toolbar')?.title || null);
    return {steps, reloadedAfterMs: Date.now() - t0, wd, coach, projectLabel};
  });

  await probe('S7 Back to the lab project from the project menu', async () => {
    await page.evaluate(HELPERS);
    const menu = await page.evaluate(() => {
      const b = document.getElementById('rstudio_project_menubutton_toolbar');
      window.__spike.press(b);
      return b?.outerHTML.slice(0, 100);
    });
    await waitFor(() => Boolean(window.__spike.menuItem(/statistical-tools/)), null, 8000);
    const navigated = page.waitForNavigation({timeout: 60000}).catch(() => null);
    await page.evaluate(() => window.__spike.press(window.__spike.menuItem(/statistical-tools/)));
    await navigated;
    await page.waitForSelector('#rstudio_console_input', {timeout: 90000});
    let wd = null;
    for (let i = 0; i < 100 && !(wd || '').endsWith('/statistical-tools'); i += 1) { wd = (await evidence()).state?.wd; await page.waitForTimeout(200); }
    return {menu, wd};
  });

  fs.writeFileSync(path.join(outDir, 's5s7.json'), JSON.stringify(results, null, 2));
  await page.screenshot({path: path.join(outDir, 's5s7.png')});
  await browser.close();
}

main(process.argv[2] || 'results/spikes').catch(e => { console.error(e); process.exit(1); });
