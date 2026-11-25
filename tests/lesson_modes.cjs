// Lesson audit: one lesson in all three modes, driven as a learner would, for the lessons modelled
// on R for Data Science ("version": 2). It provisions a fresh run of the lesson, signs in through
// the gateway and:
//
// - Demonstration, at a fast pace (the coach's localStorage pacing settings): every step runs to
//   its explanation, the script ends up holding every statement under its heading, exactly, and
//   the coach never presses Save (the script is read from its editor; a lesson that ends in a new
//   project has left it, saved by RStudio's question on the way out, so it is read from disk);
// - Guided: the learner types each statement at the Console prompt and does each IDE action with
//   real clicks (menus, Global Options), presses Next after each step, and asks for Show me once,
//   on the first statement that spans several lines; every task ticks, by the learner except the
//   one shown, and the debrief appears;
// - Solo: the learner types each statement's first alternative where it has one (equivalent code
//   the bake has proved gives the same value), otherwise the statement itself, and does the
//   actions; Check my work ticks every task.
//
// A statement that teaches Ctrl+Shift+M or Alt+- (`keys`) gets its |> or <- from the shortcut in
// every mode. In a
// Quarto lesson (its script is a .qmd), the learner types code into the document's chunk, below its
// step's heading, and runs it with Ctrl+Enter; text steps are typed into the document; and Show me
// is asked for on the first text step.
//
// A lesson with a Source step (lesson 6) is written in its script too, since Source runs only what
// the script holds. A lesson that ends in a new project (lesson 6) reloads the page into it in each
// mode, and the next mode's fresh start takes RStudio back to the lessons' project, which reloads
// it again; the waits here carry on across those reloads.
//
// Each mode starts afresh from the picker, as a learner's choice would. Any page error fails it.
//
// With LAB_PACE=normal, it runs Demonstration only, at the coach's own pace (typing, pointer and
// reading times as a learner gets them), and records how long each step took. The other modes
// don't depend on the pace.
//
//   NODE_PATH=$(npm root -g) node tests/lesson_modes.cjs <lesson> [results-dir]
//   LAB_PACE=normal NODE_PATH=$(npm root -g) node tests/lesson_modes.cjs <lesson> [results-dir]
const {chromium} = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const {ROOT, RUN_DIR, GATEWAY, audit, assert, provision, warnings, signIn, coachEl} = require('./lib.cjs');

const LESSON = process.argv[2];
if (!LESSON) {
  console.error('usage: node tests/lesson_modes.cjs <lesson> [results-dir]');
  process.exit(2);
}
const OUT = path.resolve(process.argv[3] || path.join(ROOT, 'results', `lesson-${LESSON}`));
const {results, probe: record} = audit(OUT);
let shotPage = null;
// A failing probe leaves a screenshot and the full error (Playwright's says which locator it waited for).
const probe = (name, fn) => record(name, async () => {
  try {
    return await fn();
  } catch (error) {
    const file = `fail-${results.length + 1}.png`;
    await shotPage?.screenshot({path: path.join(OUT, file)}).catch(() => {});
    console.log(`      ${String(error.message || error).split('\n').slice(0, 6).join('\n      ')}\n      (screenshot ${file})`);
    throw error;
  }
});
let lessonScript = null; // the lesson's script or document, once loaded
let inDocument = false; // whether the learner writes each statement in it: a Quarto document, or a script the lesson sources
const FAST = {rsCoachTypeMs: 5, rsCoachReadMinMs: 200, rsCoachReadStepMs: 1, rsCoachPaceMs: 200, rsCoachLeadMs: 100, rsCoachDwellMs: 300};
const NORMAL = process.env.LAB_PACE === 'normal';

// page.waitForFunction carries on across a reload; until the coach loads again, window.__rsCoach
// is missing, so the conditions below use ?. throughout.
const wait = (page, fn, arg, timeout = 30000) => page.waitForFunction(fn, arg, {timeout, polling: 100});
// RStudio reloads the page into a new project: wait for the IDE and the coach to be back.
async function afterReload(page, navigated) {
  await navigated;
  await page.waitForSelector('#rstudio_console_input', {timeout: 90000});
  await wait(page, () => window.__rsCoach?.mode !== undefined, null, 30000);
}
const escapeRe = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The learner at the Console prompt: the statement goes in as typed (pasted, so RStudio's
// auto-pairing doesn't add brackets), then Enter runs all its lines.
// A statement that teaches Ctrl+Shift+M or Alt+- (`keys`) gets each |> or <- from the shortcut,
// which RStudio types as " |> " or " <- ".
const SHORTCUTS = {'Ctrl+Shift+M': '|>', 'Alt+-': '<-'};
const playwrightKeys = keys => keys.replace('Ctrl', 'Control').replace('Cmd', 'Meta').replace(/\+-$/, '+Minus');
async function consoleRun(page, code, keys = null) {
  // After a Render, RStudio's Background Jobs tab can cover the Console: click the Console tab.
  if (!(await page.locator('#rstudio_console_input').isVisible())) await page.getByRole('tab', {name: /^Console/}).first().click();
  await page.click('#rstudio_console_input');
  const parts = keys ? code.split(SHORTCUTS[keys]) : [code];
  for (const [i, part] of parts.entries()) {
    if (i > 0) await page.keyboard.press(playwrightKeys(keys));
    await page.keyboard.insertText(i < parts.length - 1 ? part.trimEnd() : part);
  }
  await page.keyboard.press('Enter');
}
async function clickMenu(page, menuPath) {
  await page.locator('[role="menubar"] [role="menuitem"]', {hasText: new RegExp(`^${escapeRe(menuPath[0])}$`)}).first().click();
  for (const item of menuPath.slice(1)) {
    await page.locator('[role="menu"] [role="menuitem"]:visible', {hasText: new RegExp(`^${escapeRe(item.replace(/…$/, ''))}`)}).first().click();
  }
}
// The learner does an IDE action with the mouse.
async function learnerAction(page, run) {
  if (run.action === 'menu') {
    await clickMenu(page, run.menu);
  } else if (run.action === 'option') {
    await clickMenu(page, ['Tools', 'Global Options']);
    const label = page.locator('label:visible', {hasText: run.label});
    await page.getByRole('button', {name: 'OK', exact: true}).waitFor();
    if (!(await label.count())) await page.getByText(run.pane, {exact: true}).first().click();
    const box = page.locator(`input[type="checkbox"]#${await label.first().getAttribute('for')}`);
    if ((await box.isChecked()) !== run.value) await label.first().click();
    await page.getByRole('button', {name: 'OK', exact: true}).click();
  } else if (run.action === 'format-document') {
    await clickMenu(page, ['Code', 'Reformat Document']);
  } else if (run.action === 'open-file') {
    if (!(await page.locator('#rstudio_workbench_panel_files').isVisible())) await page.click('#rstudio_workbench_tab_files');
    await page.locator('#rstudio_workbench_panel_files').getByText(run.file, {exact: true}).click();
  } else if (run.action === 'new-file') {
    await page.locator('[role="menubar"] [role="menuitem"]', {hasText: /^File$/}).first().click();
    await page.locator('[role="menu"] [role="menuitem"]:visible', {hasText: /^New File/}).first().hover();
    await page.locator('[role="menu"] [role="menuitem"]:visible', {hasText: new RegExp(`^${escapeRe(run.kind.replace(/…$/, ''))}`)}).first().click();
    await page.getByRole('button', {name: 'Create', exact: true}).click();
  } else if (run.action === 'editor-mode') {
    const label = run.to === 'visual' ? 'Visual' : 'Source';
    await page.locator('#rstudio_Source_pane').getByText(label, {exact: true}).locator('visible=true').first().click();
    if (run.to === 'visual') {
      const use = page.getByRole('button', {name: 'Use Visual Mode'});
      await use.waitFor({timeout: 4000}).then(() => use.click(), () => {}); // RStudio asks only the first time
    }
  } else if (run.action === 'render') {
    await page.locator('#rstudio_Source_pane button[title^="Render"]:visible').first().click();
  } else if (run.action === 'type') {
    // The learner opens the lesson's document, clicks at the end of the line the text follows (the
    // last line with text, unless the step says otherwise) and types it.
    await openDocument(page);
    await page.evaluate(after => {
      const editor = [...document.querySelectorAll('#rstudio_Source_pane .ace_editor')].find(e => e.offsetParent && e.env?.editor).env.editor;
      const lines = editor.session.getDocument().getAllLines();
      let row = after ? lines.findIndex(line => new RegExp(after).test(line)) : lines.length - 1;
      if (!after) while (row > 0 && !lines[row].trim()) row -= 1;
      editor.focus();
      editor.clearSelection();
      editor.moveCursorTo(row, lines[row].length);
    }, run.after || null);
    await page.keyboard.press('Enter');
    await page.keyboard.insertText(run.text.replace(/^\n/, ''));
  } else if (run.action === 'source') {
    // Straight after Restart R, RStudio can fail to save the script first ("Error Saving File"):
    // the learner presses OK and Source again.
    await openDocument(page);
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await page.click('#rstudio_text_source');
      const failed = page.locator('.gwt-DialogBox:visible', {hasText: 'Error Saving File'});
      if (!(await failed.waitFor({timeout: 2000}).then(() => true, () => false))) break;
      await failed.getByRole('button', {name: 'OK'}).click();
      await page.waitForTimeout(2000);
    }
  } else if (run.action === 'new-project') {
    await clickMenu(page, ['File', 'New Project…']);
    // RStudio asks about unsaved documents first: Save for one, Save Selected for several.
    const unsaved = page.getByRole('button', {name: /^Save( Selected)?$/});
    const wizard = page.locator('.gwt-DialogBox:visible', {hasText: 'New Project Wizard'});
    await Promise.race([wizard.waitFor({timeout: 10000}), unsaved.first().waitFor({timeout: 10000})]).catch(() => {});
    if (await unsaved.first().isVisible()) await unsaved.first().click();
    await wizard.getByText('New Directory', {exact: true}).click();
    await wizard.getByText('New Project', {exact: true}).click();
    await page.locator('#rstudio_new_project_directory_name').fill(run.name);
    const navigated = page.waitForNavigation({timeout: 60000}).catch(() => null);
    await wizard.getByRole('button', {name: 'Create Project'}).click();
    await afterReload(page, navigated);
  } else if (run.action === 'shortcut') {
    await page.locator('#rstudio_Source_pane .ace_content:visible').first().click(); // the cursor goes in the open document
    await page.keyboard.press(playwrightKeys(run.keys));
  } else {
    throw new Error(`the audit can't do the action ${run.action} yet`);
  }
}
// What `name` holds as the learner sees it: its editor, shown by clicking its tab, when it is open;
// otherwise (RStudio has moved to another project) the file.
async function scriptText(page, name) {
  const tab = page.locator('#rstudio_Source_pane [role="tab"]', {hasText: name}).first();
  if (!(await tab.isVisible().catch(() => false))) return fs.readFileSync(path.join(RUN_DIR, 'project', name), 'utf8');
  await tab.click();
  await page.waitForFunction(name => [...document.querySelectorAll('#rstudio_Source_pane [role="tab"]')]
    .some(t => t.getAttribute('aria-selected') === 'true' && t.innerText.trim().replace(/\s*\*$/, '') === name), name, {timeout: 10000});
  return page.evaluate(() => [...document.querySelectorAll('#rstudio_Source_pane .ace_editor')].find(e => e.offsetParent && e.env?.editor).env.editor.getValue());
}
async function openDocument(page) {
  if (!(await page.locator('#rstudio_workbench_panel_files').isVisible())) await page.click('#rstudio_workbench_tab_files');
  await page.locator('#rstudio_workbench_panel_files').getByText(lessonScript, {exact: true}).click();
  await page.waitForFunction(name => [...document.querySelectorAll('#rstudio_Source_pane [role="tab"]')]
    .some(t => t.getAttribute('aria-selected') === 'true' && t.innerText.trim().replace(/\s*\*$/, '') === name), lessonScript, {timeout: 10000});
}
// In a Quarto lesson, code belongs in the document's chunk, below its step's heading, so that
// rendering runs it too: the learner types it there and runs it with Ctrl+Enter.
async function documentRun(page, code, heading) {
  await openDocument(page);
  await page.evaluate(heading => {
    const editor = [...document.querySelectorAll('#rstudio_Source_pane .ace_editor')].find(e => e.offsetParent && e.env?.editor).env.editor;
    const lines = editor.session.getDocument().getAllLines();
    const at = lines.findIndex(line => line.trimEnd() === heading);
    let end = lines.findIndex((line, r) => r > at && /^(# Step \d+\. |```)/.test(line));
    if (end < 0) end = lines.length;
    let last = at;
    for (let r = at + 1; r < end; r += 1) if (lines[r].trim()) last = r;
    editor.focus();
    editor.clearSelection();
    editor.moveCursorTo(last, lines[last].length);
  }, heading);
  await page.keyboard.press('Enter');
  await page.keyboard.insertText(code);
  await page.keyboard.press('Control+Enter');
}
async function learnerDoes(page, run, {alternative = false, step = null} = {}) {
  const code = alternative && run.alternatives?.length ? run.alternatives[0] : run.code;
  if (run.action) await learnerAction(page, run);
  else if (inDocument) await documentRun(page, code, step.heading);
  else await consoleRun(page, code, run.keys);
}
const coachState = page => page.evaluate(() => ({mode: window.__rsCoach.mode, guided: window.__rsCoach.guided, solo: window.__rsCoach.solo,
  demo: window.__rsCoach.demo && {state: window.__rsCoach.demo.state, completed: window.__rsCoach.demo.completed, failure: window.__rsCoach.demo.failure}}));
// The fresh start is the first one to finish after the click. It is found by its time, not by the
// count of fresh starts, which starts again at 0 if the coach first goes back to the lessons'
// project and so reloads the page.
async function chooseMode(page, mode) {
  if (await page.evaluate(() => window.__rsCoach.mode !== null)) await coachEl(page, 'button.switch').click();
  const clicked = await page.evaluate(() => Date.now());
  await coachEl(page, `button.mode-card[data-mode="${mode}"]`).click();
  const last = await page.waitForFunction(t => (window.__rsCoach?.fresh.last?.at >= t ? window.__rsCoach.fresh.last : null), clicked, {timeout: 90000, polling: 50})
    .then(h => h.jsonValue());
  assert(last.problems.length === 0, `the fresh start met problems: ${last.problems.join(' ')}`);
  await wait(page, state => Boolean(window.__rsCoach?.[state]), {demonstration: 'demo', guided: 'guided', solo: 'solo'}[mode]);
  if (mode === 'demonstration') {
    assert(await coachEl(page, 'button.auto').getAttribute('aria-checked') === 'false', 'Auto-advance should start off');
    await coachEl(page, 'button.auto').click(); // this audit runs the full demonstration without presses
  } else {
    const preview = await coachEl(page, '.lesson-preview').textContent();
    assert(!preview.includes('What you\'ll learn') && preview.includes(lessonScript) && await coachEl(page, '.lesson-preview details.steps-box').evaluate(d => d.open), `missing lesson overview, or the summary repeated: ${preview}`);
    await coachEl(page, 'button.begin').click();
  }
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const password = provision(LESSON);
  const context = await browser.newContext({viewport: {width: 1440, height: 900}});
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  shotPage = page;
  let lesson;

  await probe('sign in: the coach loads the lesson', async () => {
    await page.goto(`${GATEWAY}/auth-sign-in`);
    if (!NORMAL) await page.evaluate(settings => { for (const [k, v] of Object.entries(settings)) localStorage.setItem(k, String(v)); }, FAST);
    await signIn(page, password, null);
    lesson = await page.evaluate(id => fetch('/coach/api/steps').then(r => r.json()).then(s => s.lessons.find(l => l.id === id)), LESSON);
    assert(lesson && lesson.version === 2, `${LESSON} isn't a version 2 lesson in this run`);
    lessonScript = lesson.script;
    inDocument = /\.qmd$/.test(lessonScript) || lesson.steps.some(s => s.runs.some(r => r.action === 'source'));
    const tasks = lesson.steps.flatMap(s => s.runs).length;
    return {steps: lesson.steps.length, tasks, multiLine: lesson.steps.flatMap(s => s.runs).filter(r => r.code?.includes('\n')).length};
  });

  await probe('Demonstration: every step runs to its explanation, and the script holds every statement', async () => {
    await chooseMode(page, 'demonstration');
    await coachEl(page, 'button.go').click();
    // Polled rather than awaited in the page, to time each step: when the coach finished it, from
    // the Start click (a step's time includes the reading time of the explanation before it).
    // Lesson 6's new project reloads the page, which a poll in flight doesn't survive.
    const started = Date.now();
    const doneAt = [];
    let end = null;
    for (const deadline = started + (NORMAL ? 45 : 15) * 60000; !end && Date.now() < deadline; await page.waitForTimeout(250)) {
      const d = await page.evaluate(() => {
        const demo = window.__rsCoach?.demo;
        return demo ? {state: demo.state, failure: demo.failure, index: demo.index, completed: demo.completed.length} : null;
      }).catch(() => null);
      if (!d) continue;
      while (doneAt.length < d.completed) doneAt.push(Date.now());
      if (d.state === 'failed' || (d.state === 'waiting' && d.completed === lesson.steps.length)) end = d;
    }
    assert(end, `the Demonstration didn't finish in ${(Date.now() - started) / 60000} minutes`);
    assert(end.state === 'waiting', `step ${end.index + 1} failed: ${end.failure}`);
    const stepSeconds = doneAt.map((t, i) => Math.round((t - (i ? doneAt[i - 1] : started)) / 1000));
    const script = await scriptText(page, lesson.script);
    const saves = await page.evaluate(() => window.__rsCoach.log.filter(e => e.type === 'demo_click' && e.target === 'save').length);
    assert(saves === 0, `the coach pressed Save ${saves} times`);
    for (const step of lesson.steps) {
      const block = script.split(step.heading)[1]?.split(/\n# Step \d+\. /)[0] ?? '';
      for (const run of step.runs.filter(r => r.code)) assert(block.includes(`\n${run.code}\n`), `step "${step.title}" doesn't hold ${JSON.stringify(run.code)}`);
      for (const run of step.runs.filter(r => r.action === 'type')) assert(script.includes(run.text.replace(/^\n/, '')), `${lesson.script} doesn't hold the text of step "${step.title}": ${JSON.stringify(run.text)}`);
    }
    await page.screenshot({path: path.join(OUT, 'demonstration.png')});
    const log = await page.evaluate(() => window.__rsCoach.log.filter(e => e.type === 'demo_action' && e.action === 'type' && e.lines).map(e => e.lines)); // typing, not the type action's own entry
    // Statements that teach a shortcut get each |> or <- from it, not typed.
    const tokens = lesson.steps.flatMap(s => s.runs).filter(r => r.code && r.keys).reduce((n, r) => n + r.code.split(SHORTCUTS[r.keys]).length - 1, 0);
    const pressed = await page.evaluate(() => window.__rsCoach.log.filter(e => e.type === 'demo_action' && e.action === 'shortcut').length);
    assert(pressed >= tokens, `the coach pressed a statement's shortcut ${pressed} times for ${tokens} pipes or arrows`);
    return {steps: lesson.steps.length, statementsTyped: log.length, linesTyped: log.reduce((a, b) => a + b, 0), ...(tokens ? {shortcuts: pressed} : {}),
      pace: NORMAL ? 'normal' : 'fast', seconds: Math.round((doneAt.at(-1) - started) / 1000), stepSeconds};
  });

  if (!NORMAL) await probe('Guided: the learner types each statement in the Console and does each action; one Show me; every task ticks', async () => {
    await chooseMode(page, 'guided');
    const runs = lesson.steps.flatMap((step, s) => step.runs.map((run, r) => ({s, r, run})));
    const shown = runs.find(x => x.run.code?.includes('\n')) || runs.find(x => x.run.action === 'type');
    for (const {s, r, run} of runs) {
      const k = `${s}.${r}`;
      await wait(page, s => window.__rsCoach?.guided?.step === s, s, 10000);
      if (shown && x(shown) === k) {
        await coachEl(page, 'button.show').click();
      } else {
        await learnerDoes(page, run, {step: lesson.steps[s]});
      }
      await wait(page, k => window.__rsCoach?.guided?.done[k], k, run.ide?.restarted ? 90000 : 30000)
        .catch(async () => { throw new Error(`task ${k} (${(run.code || run.action).split('\n')[0]}) never ticked; feedback: ${JSON.stringify((await coachState(page)).guided.feedback)}`); });
      if (r === lesson.steps[s].runs.length - 1 && s < lesson.steps.length - 1) await coachEl(page, 'button.next').click();
    }
    const g = (await coachState(page)).guided;
    const by = Object.entries(g.done).filter(([, who]) => who === 'coach').map(([k]) => k);
    assert(by.length === (shown ? 1 : 0) && (!shown || by[0] === x(shown)), `shown by the coach: ${by}`);
    const debrief = await coachEl(page, '.debrief').textContent();
    assert(/All \d+ steps done/.test(debrief), `no debrief: ${debrief}`);
    await page.screenshot({path: path.join(OUT, 'guided.png')});
    return {tasks: runs.length, showMe: shown && x(shown), feedbackSeen: g.feedback || null};
  });
  function x(item) { return `${item.s}.${item.r}`; }

  if (!NORMAL) await probe('Solo: the learner uses the alternatives where there are any; Check my work ticks every task', async () => {
    await chooseMode(page, 'solo');
    const runs = lesson.steps.flatMap((step, s) => step.runs.map((run, r) => ({k: `${s}.${r}`, run, step})));
    for (const {k, run, step} of runs) {
      await learnerDoes(page, run, {alternative: true, step});
      await wait(page, k => window.__rsCoach?.solo?.seen[k], k, run.ide?.restarted ? 90000 : 30000)
        .catch(() => { throw new Error(`task ${k} (${(run.alternatives?.[0] || run.code || run.action).split('\n')[0]}) was never seen`); });
    }
    await coachEl(page, 'button.check').click();
    const text = await coachEl(page, '.results').textContent();
    assert(new RegExp(`All ${runs.length} tasks done`).test(text), text.replace(/\s+/g, ' ').slice(0, 200));
    await page.screenshot({path: path.join(OUT, 'solo.png')});
    return {tasks: runs.length, alternatives: runs.filter(x => x.run.alternatives?.length).length};
  });

  await probe('no page errors', async () => {
    assert(errors.length === 0, errors.join(' | '));
  });

  await browser.close();
  const passed = results.filter(r => r.ok).length;
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({lesson: LESSON, results, warnings, errors}, null, 2));
  console.log(`\n${passed} passed, ${results.length - passed} failed; warnings: ${warnings.length}; page errors: ${errors.length}`);
  process.exit(passed === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
