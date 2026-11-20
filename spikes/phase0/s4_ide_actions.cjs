// Phase 0, spike S4: can the coach drive the IDE actions the lessons need, and can it tell they
// happened? Every action uses synthetic events, as the coach's driver does (the coach can't make
// trusted clicks); results are read from the evidence file (runtime/evidence.R) or from RStudio.
//
//   NODE_PATH=$(npm root -g) node spikes/phase0/s4_ide_actions.cjs results/spikes
const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');
const {chromium} = require('@playwright/test');
const {ROOT, provision, signIn} = require('../../tests/lib.cjs');

const MESSY = 'x<-c(1,2,3)\nfast<-mpg|>filter(hwy>30)|>select(model,hwy)\nkm_to_miles<-function(km){km*0.621371}\n';
const QMD = '---\ntitle: "Spike"\nformat: html\n---\n\n## A chunk\n\n```{r}\n1 + 1\n```\n\n## A chart\n\n```{r}\nlibrary(ggplot2)\nggplot(mpg, aes(displ, hwy)) + geom_point()\n```\n';

// In-page helpers, the coach's way of acting: synthetic pointer and mouse events, keyboard events.
const HELPERS = () => {
  if (window.__spike) return;
  const shown = el => Boolean(el && el.offsetParent !== null && el.getClientRects().length);
  const press = el => {
    const r = el.getBoundingClientRect();
    const init = {bubbles: true, cancelable: true, composed: true, view: window, button: 0, buttons: 1,
      clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1, pointerType: 'mouse', isPrimary: true};
    for (const type of ['pointerover', 'mouseover', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      el.dispatchEvent(type.startsWith('pointer') ? new PointerEvent(type, init) : new MouseEvent(type, init));
    }
  };
  const byText = (scope, text, selector = '*') => [...(scope || document).querySelectorAll(selector)]
    .find(el => shown(el) && (text instanceof RegExp ? text.test(el.textContent.trim()) : el.textContent.trim().replace(/\s+/g, ' ') === text));
  const menubar = name => [...document.querySelectorAll('[role="menubar"] [role="menuitem"]')].find(e => shown(e) && e.textContent.trim() === name);
  const menuItem = re => [...document.querySelectorAll('[role="menu"] [role="menuitem"]')].find(e => shown(e) && re.test(e.textContent.trim().replace(/\s+/g, ' ')));
  const dialog = re => [...document.querySelectorAll('.gwt-DialogBox, [role="dialog"]')].find(d => shown(d) && re.test(d.textContent));
  const editor = () => [...document.querySelectorAll('#rstudio_Source_pane .ace_editor')].find(e => shown(e) && e.env?.editor)?.env.editor;
  const tab = name => [...document.querySelectorAll('#rstudio_Source_pane [role="tab"]')].find(t => shown(t) && t.textContent.trim().replace(/\*$/, '') === name);
  const sourceButton = re => [...document.querySelectorAll('#rstudio_Source_pane button, #rstudio_Source_pane [role="button"]')]
    .find(b => shown(b) && (re.test(b.getAttribute('title') || '') || re.test(b.getAttribute('aria-label') || '') || re.test(b.textContent.trim())));
  const key = (target, init) => {
    for (const type of ['keydown', 'keypress', 'keyup']) {
      target.dispatchEvent(new KeyboardEvent(type, {bubbles: true, cancelable: true, composed: true, view: window, ...init}));
    }
  };
  window.__spike = {shown, press, byText, menubar, menuItem, dialog, editor, tab, sourceButton, key};
};

async function main(outDir) {
  fs.mkdirSync(outDir, {recursive: true});
  const password = provision('statistical-tools');
  fs.writeFileSync(path.join(ROOT, 'run/project/messy.R'), MESSY);
  fs.writeFileSync(path.join(ROOT, 'run/project/spike.qmd'), QMD);
  const browser = await chromium.launch();
  const page = await browser.newPage({viewport: {width: 1440, height: 900}});
  await signIn(page, password, null);
  const sessionStarted = Date.now();
  const results = {};
  const evidence = () => page.evaluate(() => fetch('/coach/api/evidence', {cache: 'no-store'}).then(r => r.json()));
  const helpers = () => page.evaluate(HELPERS);
  const waitFor = (fn, arg, ms = 20000) => page.waitForFunction(fn, arg, {timeout: ms, polling: 100}).then(h => h.jsonValue());
  const consoleType = async code => {
    await page.click('#rstudio_console_input');
    await page.keyboard.insertText(code);
    await page.keyboard.press('Enter');
  };
  async function probe(name, fn) {
    const t0 = Date.now();
    try {
      await helpers();
      const detail = await fn();
      results[name] = {ok: true, ms: Date.now() - t0, ...detail};
      console.log(`PASS  ${name}  ${JSON.stringify(detail)}`);
    } catch (e) {
      results[name] = {ok: false, ms: Date.now() - t0, error: String(e.message || e).split('\n')[0]};
      console.log(`FAIL  ${name}  ${results[name].error}`);
      await page.screenshot({path: path.join(outDir, `s4-fail-${name}.png`)});
      await page.keyboard.press('Escape').catch(() => {});
    }
  }
  const openMenu = async (bar, item) => {
    await page.evaluate(bar => window.__spike.press(window.__spike.menubar(bar)), bar);
    await waitFor(re => Boolean(window.__spike.menuItem(new RegExp(re))), item.source, 5000);
    await page.evaluate(re => window.__spike.press(window.__spike.menuItem(new RegExp(re))), item.source);
  };
  const openFile = async name => {
    // Another pane (the Viewer after reprex or Render) may hide Files, as the coach's openScript allows for.
    await page.evaluate(() => {
      const files = document.getElementById('rstudio_workbench_panel_files');
      if (!window.__spike.shown(files)) window.__spike.press(document.getElementById('rstudio_workbench_tab_files'));
    });
    await page.waitForTimeout(500);
    await page.evaluate(name => {
      const panel = document.getElementById('rstudio_workbench_panel_files');
      const link = [...panel.querySelectorAll('*')].find(el => el.childElementCount === 0 && el.textContent.trim() === name && window.__spike.shown(el));
      window.__spike.press(link);
    }, name);
    await waitFor(name => window.__spike.tab(name)?.getAttribute('aria-selected') === 'true', name);
    await page.waitForTimeout(600);
  };

  await probe('menu: Code menu items with an R script open', async () => {
    await openFile('messy.R');
    await page.evaluate(() => window.__spike.press(window.__spike.menubar('Code')));
    await page.waitForTimeout(500);
    const items = await page.evaluate(() => [...document.querySelectorAll('[role="menu"] [role="menuitem"]')].filter(e => window.__spike.shown(e)).map(e => e.textContent.trim().replace(/\s+/g, ' ')));
    await page.keyboard.press('Escape');
    return {formatItems: items.filter(t => /format/i.test(t)), count: items.length};
  });

  await probe('Air: Code > Reformat Document gives what `air format` gives', async () => {
    await openFile('messy.R');
    const before = await page.evaluate(() => window.__spike.editor().getValue());
    await page.evaluate(() => { const e = window.__spike.editor(); e.focus(); e.clearSelection(); e.moveCursorTo(0, 0); });
    await openMenu('Code', /^Reformat Document/);
    await waitFor(before => window.__spike.editor().getValue() !== before, before, 15000);
    const after = await page.evaluate(() => window.__spike.editor().getValue());
    const air = execFileSync('docker', ['run', '--rm', '-i', '--network', 'none', '--entrypoint', 'sh', 'rstudio-guide-runtime:local', '-c',
      'cat > /tmp/m.R && air format /tmp/m.R && cat /tmp/m.R'], {input: MESSY}).toString();
    return {same: after === air, after};
  });

  await probe('Shortcut: synthetic Ctrl+Shift+M in the editor inserts the pipe', async () => {
    await openFile('messy.R');
    await page.evaluate(() => { const e = window.__spike.editor(); e.focus(); const n = e.session.getLength(); e.moveCursorTo(n - 1, e.session.getLine(n - 1).length); e.insert('\nmpg'); });
    const target = await page.evaluate(() => {
      const t = document.activeElement;
      window.__spike.key(t, {key: 'M', code: 'KeyM', keyCode: 77, which: 77, ctrlKey: true, shiftKey: true});
      return t.className;
    });
    await page.waitForTimeout(400);
    const line = await page.evaluate(() => { const e = window.__spike.editor(); return e.session.getLine(e.getCursorPosition().row); });
    return {target, line, inserted: /\|>/.test(line)};
  });

  await probe('Shortcut: synthetic Alt+- in the editor inserts <-', async () => {
    await page.evaluate(() => { const e = window.__spike.editor(); e.focus(); e.insert('\ny'); });
    await page.evaluate(() => window.__spike.key(document.activeElement, {key: '-', code: 'Minus', keyCode: 189, which: 189, altKey: true}));
    await page.waitForTimeout(400);
    const line = await page.evaluate(() => { const e = window.__spike.editor(); return e.session.getLine(e.getCursorPosition().row); });
    return {line, inserted: /<-/.test(line)};
  });

  await probe('Chord seen: a capture-phase listener notices a learner pressing Alt+-', async () => {
    await page.evaluate(() => { window.__chords = []; window.addEventListener('keydown', e => { if (e.altKey && e.key === '-') window.__chords.push(e.isTrusted); }, true); });
    await page.evaluate(() => window.__spike.editor().focus());
    await page.keyboard.press('Alt+Minus');
    await page.waitForTimeout(300);
    const line = await page.evaluate(() => { const e = window.__spike.editor(); return e.session.getLine(e.getCursorPosition().row); });
    return {seen: await page.evaluate(() => window.__chords), line};
  });

  await probe('Global Options: tick and untick "Restore .RData", seen in the evidence prefs', async () => {
    const setRestore = async want => {
      await openMenu('Tools', /^Global Options/);
      await waitFor(() => Boolean(window.__spike.dialog(/Restore \.RData into workspace at startup/)), null, 10000);
      await page.evaluate(want => {
        const d = window.__spike.dialog(/Restore \.RData into workspace at startup/);
        const label = [...d.querySelectorAll('label')].find(l => /Restore \.RData into workspace at startup/.test(l.textContent));
        const box = label.htmlFor ? document.getElementById(label.htmlFor) : label.parentElement.querySelector('input[type="checkbox"]');
        if (box.checked !== want) box.click();
        const ok = [...d.querySelectorAll('button')].find(b => window.__spike.shown(b) && b.textContent.trim() === 'OK');
        window.__spike.press(ok);
      }, want);
      const t0 = Date.now();
      for (;;) {
        const e = await evidence();
        if (e.state?.prefs?.load_workspace === want) return Date.now() - t0;
        if (Date.now() - t0 > 10000) throw new Error(`evidence prefs never showed load_workspace = ${want}: ${JSON.stringify(e.state?.prefs)}`);
        await page.waitForTimeout(100);
      }
    };
    const onMs = await setRestore(true);
    const offMs = await setRestore(false);
    return {seenOnAfterMs: onMs, seenOffAfterMs: offMs};
  });

  await probe('View(): the data viewer tab appears, for a data frame and a list', async () => {
    await consoleType('cars <- ggplot2::mpg');
    await consoleType('View(cars)');
    await waitFor(() => Boolean(window.__spike.tab('cars')), null, 10000);
    await consoleType('stations <- list(a = list(name = "Mill Lane", docks = 12), b = list(name = "Harbour"))');
    await consoleType('View(stations)');
    await waitFor(() => Boolean(window.__spike.tab('stations')), null, 10000);
    const tabs = await page.evaluate(() => [...document.querySelectorAll('#rstudio_Source_pane [role="tab"]')].filter(t => window.__spike.shown(t)).map(t => t.textContent.trim()));
    return {tabs};
  });

  await probe('Help: ?mean shows its page in the Help pane', async () => {
    await consoleType('?mean');
    const title = await waitFor(() => {
      for (const f of document.querySelectorAll('#rstudio_workbench_panel_help iframe')) {
        try { const h = f.contentDocument?.querySelector('h2, title'); if (h && /Arithmetic Mean/.test(h.textContent)) return h.textContent.trim(); } catch (_e) { /* ignore */ }
      }
      return null;
    }, null, 10000);
    return {title};
  });

  await probe('reprex on RStudio Server, without a clipboard', async () => {
    const before = await page.evaluate(() => document.getElementById('rstudio_console_output').textContent.length);
    await consoleType('reprex::reprex({x <- c(1, 5, 9); mean(x)})');
    await page.waitForTimeout(8000);
    const out = await page.evaluate(before => document.getElementById('rstudio_console_output').textContent.slice(before), before);
    const viewer = await page.evaluate(() => {
      for (const f of document.querySelectorAll('#rstudio_workbench_panel_viewer iframe')) {
        try { const t = f.contentDocument?.body?.innerText; if (t) return t.slice(0, 200); } catch (_e) { /* ignore */ }
      }
      return null;
    });
    const e = await evidence();
    return {console: out.replace(/\s+/g, ' ').slice(0, 300), viewer, newFiles: e.state.files.map(f => f.path).filter(p => /reprex/.test(p))};
  });

  await probe('New File > Quarto Document opens the dialog and creates an untitled document', async () => {
    const visibleItems = () => page.evaluate(() => [...document.querySelectorAll('[role="menu"] [role="menuitem"]')].filter(e => window.__spike.shown(e)).map(e => e.textContent.trim().replace(/\s+/g, ' ')));
    await page.evaluate(() => window.__spike.press(window.__spike.menubar('File')));
    await waitFor(() => Boolean(window.__spike.menuItem(/^New File/)), null, 5000).catch(async e => { throw new Error(`File menu: ${(await visibleItems()).join(' | ')}`); });
    // A submenu item opens on a lone click; the full press (mousedown, then click) opens and closes it.
    await page.evaluate(() => {
      const el = window.__spike.menuItem(/^New File/);
      const r = el.getBoundingClientRect();
      el.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, view: window, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2}));
    });
    await waitFor(() => Boolean(window.__spike.menuItem(/^Quarto Doc/)), null, 5000).catch(async e => { throw new Error(`New File submenu: ${(await visibleItems()).join(' | ')}`); });
    await page.evaluate(() => window.__spike.press(window.__spike.menuItem(/^Quarto Doc/)));
    await waitFor(() => Boolean(window.__spike.dialog(/New Quarto Document/)), null, 10000);
    const buttons = await page.evaluate(() => [...window.__spike.dialog(/New Quarto Document/).querySelectorAll('button')].filter(b => window.__spike.shown(b)).map(b => b.textContent.trim()));
    await page.evaluate(() => window.__spike.press([...window.__spike.dialog(/New Quarto Document/).querySelectorAll('button')].find(b => b.textContent.trim() === 'Create')));
    const tab = await waitFor(() => [...document.querySelectorAll('#rstudio_Source_pane [role="tab"]')].find(t => window.__spike.shown(t) && /^Untitled/.test(t.textContent.trim()))?.textContent.trim(), null, 10000);
    return {buttons, tab};
  });

  await probe('Render: spike.qmd renders to spike.html, shown in the Viewer', async () => {
    await openFile('spike.qmd');
    const started = Date.now() / 1000;
    const button = await page.evaluate(() => {
      const b = window.__spike.sourceButton(/^Render\b/);
      window.__spike.press(b);
      return b.getAttribute('title');
    });
    let html = null;
    const t0 = Date.now();
    while (!html && Date.now() - t0 < 90000) {
      const e = await evidence();
      html = e.state.files.find(f => f.path === 'spike.html' && f.mtime >= started - 1);
      if (!html) await page.waitForTimeout(250);
    }
    if (!html) throw new Error('spike.html never appeared in the evidence');
    const fileMs = Date.now() - t0;
    const viewer = await waitFor(() => {
      for (const f of document.querySelectorAll('#rstudio_workbench_panel_viewer iframe')) {
        try { const t = f.contentDocument?.body?.innerText; if (t && /A chart/.test(t)) return t.slice(0, 80); } catch (_e) { /* ignore */ }
      }
      return null;
    }, null, 30000);
    return {button, fileSeenAfterMs: fileMs, viewerShownAfterMs: Date.now() - t0, viewer: viewer.replace(/\s+/g, ' ')};
  });

  await probe('Visual editor: switch to Visual and back; the file is unchanged on disk', async () => {
    await openFile('spike.qmd');
    const toVisual = await page.evaluate(() => {
      const b = window.__spike.sourceButton(/^Visual$/) || window.__spike.byText(document.getElementById('rstudio_Source_pane'), 'Visual', 'button, [role="button"], [role="tab"], a');
      window.__spike.press(b);
      return b?.outerHTML.slice(0, 120);
    });
    // RStudio asks once, a second or two later, before switching (user state visual_mode_confirmed).
    await waitFor(() => Boolean(window.__spike.dialog(/Switch to Visual Mode/) || [...document.querySelectorAll('#rstudio_Source_pane .ProseMirror')].find(window.__spike.shown)), null, 10000);
    const confirm = await page.evaluate(() => {
      const d = window.__spike.dialog(/Switch to Visual Mode/);
      if (!d) return null;
      const text = d.textContent.replace(/\s+/g, ' ').slice(0, 160);
      const b = [...d.querySelectorAll('button')].find(x => window.__spike.shown(x) && /Use Visual Mode|OK|Yes/i.test(x.textContent));
      if (b) window.__spike.press(b);
      return text;
    });
    await waitFor(() => Boolean([...document.querySelectorAll('#rstudio_Source_pane .ProseMirror')].find(window.__spike.shown)), null, 15000);
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      const b = window.__spike.sourceButton(/^Source$/) || window.__spike.byText(document.getElementById('rstudio_Source_pane'), 'Source', 'button, [role="button"], [role="tab"], a');
      window.__spike.press(b);
    });
    await waitFor(() => Boolean(window.__spike.editor()), null, 15000);
    await page.waitForTimeout(1500);
    const inEditor = await page.evaluate(() => window.__spike.editor().getValue());
    const onDisk = fs.readFileSync(path.join(ROOT, 'run/project/spike.qmd'), 'utf8');
    return {toVisual, confirm, editorSameAsOriginal: inEditor === QMD, diskSameAsOriginal: onDisk === QMD,
      editorDiff: inEditor === QMD ? null : inEditor.slice(0, 200)};
  });

  await probe('Restart R from the Session menu: time until R answers (session age noted)', async () => {
    const age = Math.round((Date.now() - sessionStarted) / 1000);
    const before = (await evidence()).session;
    const t0 = Date.now();
    await openMenu('Session', /^Restart R/);
    let after = before;
    while (after === before && Date.now() - t0 < 60000) {
      await page.waitForTimeout(200);
      after = (await evidence()).session;
    }
    if (after === before) throw new Error('no new R session within 60 s');
    return {sessionAgeS: age, newSessionAfterMs: Date.now() - t0};
  });

  await page.screenshot({path: path.join(outDir, 's4.png')});
  fs.writeFileSync(path.join(outDir, 's4.json'), JSON.stringify(results, null, 2));
  await browser.close();
}

main(process.argv[2] || 'results/spikes').catch(e => { console.error(e); process.exit(1); });
