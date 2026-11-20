// Lesson audit: one lesson in all three modes, driven as a learner would, for the lessons modelled
// on R for Data Science ("version": 2). It provisions a fresh run of the lesson, signs in through
// the gateway and:
//
// - Demonstration, at a fast pace (the coach's localStorage pacing settings): every step runs to
//   its explanation, and the script ends up holding every statement under its heading, exactly;
// - Guided: the learner types each statement at the Console prompt and does each IDE action with
//   real clicks (menus, Global Options), presses Next after each step, and asks for Show me once,
//   on the first statement that spans several lines; every task ticks, by the learner except the
//   one shown, and the debrief appears;
// - Solo: the learner types each statement's first alternative where it has one (equivalent code
//   the bake has proved gives the same value), otherwise the statement itself, and does the
//   actions; Check my work ticks every task.
//
// Each mode starts afresh from the picker, as a learner's choice would. Any page error fails it.
//
//   NODE_PATH=$(npm root -g) node tests/lesson_modes.cjs <lesson> [results-dir]
const {chromium} = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const {ROOT, audit, assert, provision, warnings, signIn, coachEl, waitForFreshStart} = require('./lib.cjs');

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
const FAST = {rsCoachTypeMs: 5, rsCoachReadMinMs: 200, rsCoachReadStepMs: 1, rsCoachPaceMs: 200, rsCoachLeadMs: 100, rsCoachDwellMs: 300};

const wait = (page, fn, arg, timeout = 30000) => page.waitForFunction(fn, arg, {timeout, polling: 100});
const escapeRe = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The learner at the Console prompt: the statement goes in as typed (pasted, so RStudio's
// auto-pairing doesn't add brackets), then Enter runs all its lines.
async function consoleRun(page, code) {
  await page.click('#rstudio_console_input');
  await page.keyboard.insertText(code);
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
  } else if (run.action === 'shortcut') {
    await page.locator('#rstudio_Source_pane .ace_content:visible').first().click(); // the cursor goes in the open document
    await page.keyboard.press(run.keys.replace('Ctrl', 'Control').replace('Cmd', 'Meta'));
  } else {
    throw new Error(`the audit can't do the action ${run.action} yet`);
  }
}
async function learnerDoes(page, run, {alternative = false} = {}) {
  if (run.action) await learnerAction(page, run);
  else await consoleRun(page, alternative && run.alternatives?.length ? run.alternatives[0] : run.code);
}
const coachState = page => page.evaluate(() => ({mode: window.__rsCoach.mode, guided: window.__rsCoach.guided, solo: window.__rsCoach.solo,
  demo: window.__rsCoach.demo && {state: window.__rsCoach.demo.state, completed: window.__rsCoach.demo.completed, failure: window.__rsCoach.demo.failure}}));
async function chooseMode(page, mode, freshCount) {
  if (await page.evaluate(() => window.__rsCoach.mode !== null)) await coachEl(page, 'button.switch').click();
  await coachEl(page, `button.mode-card[data-mode="${mode}"]`).click();
  await waitForFreshStart(page, freshCount);
  await wait(page, state => Boolean(window.__rsCoach[state]), {demonstration: 'demo', guided: 'guided', solo: 'solo'}[mode]);
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
  let fresh = 0;

  await probe('sign in: the coach loads the lesson', async () => {
    await page.goto('http://127.0.0.1:8788/auth-sign-in');
    await page.evaluate(settings => { for (const [k, v] of Object.entries(settings)) localStorage.setItem(k, String(v)); }, FAST);
    await signIn(page, password, null);
    lesson = await page.evaluate(id => fetch('/coach/api/steps').then(r => r.json()).then(s => s.lessons.find(l => l.id === id)), LESSON);
    assert(lesson && lesson.version === 2, `${LESSON} isn't a version 2 lesson in this run`);
    const tasks = lesson.steps.flatMap(s => s.runs).length;
    return {steps: lesson.steps.length, tasks, multiLine: lesson.steps.flatMap(s => s.runs).filter(r => r.code?.includes('\n')).length};
  });

  await probe('Demonstration: every step runs to its explanation, and the script holds every statement', async () => {
    await chooseMode(page, 'demonstration', ++fresh);
    await coachEl(page, 'button.go').click();
    const end = await wait(page, n => {
      const d = window.__rsCoach.demo;
      return d && (d.state === 'failed' || (d.state === 'waiting' && d.completed.length === n)) ? {state: d.state, failure: d.failure, index: d.index} : null;
    }, lesson.steps.length, 15 * 60000).then(h => h.jsonValue());
    assert(end.state === 'waiting', `step ${end.index + 1} failed: ${end.failure}`);
    const script = fs.readFileSync(path.join(ROOT, 'run/project', lesson.script), 'utf8'); // saved after each step
    for (const step of lesson.steps) {
      const block = script.split(step.heading)[1]?.split(/\n# Step \d+\. /)[0] ?? '';
      for (const run of step.runs.filter(r => r.code)) assert(block.includes(`\n${run.code}\n`), `step "${step.title}" doesn't hold ${JSON.stringify(run.code)}`);
    }
    await page.screenshot({path: path.join(OUT, 'demonstration.png')});
    const log = await page.evaluate(() => window.__rsCoach.log.filter(e => e.type === 'demo_action' && e.action === 'type').map(e => e.lines));
    return {steps: lesson.steps.length, statementsTyped: log.length, linesTyped: log.reduce((a, b) => a + b, 0)};
  });

  await probe('Guided: the learner types each statement in the Console and does each action; one Show me; every task ticks', async () => {
    await chooseMode(page, 'guided', ++fresh);
    const runs = lesson.steps.flatMap((step, s) => step.runs.map((run, r) => ({s, r, run})));
    const shown = runs.find(x => x.run.code?.includes('\n'));
    for (const {s, r, run} of runs) {
      const k = `${s}.${r}`;
      await wait(page, s => window.__rsCoach.guided.step === s, s, 10000);
      if (shown && x(shown) === k) {
        await coachEl(page, 'button.show').click();
      } else {
        await learnerDoes(page, run);
      }
      await wait(page, k => window.__rsCoach.guided.done[k], k, run.ide?.restarted ? 90000 : 30000)
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

  await probe('Solo: the learner uses the alternatives where there are any; Check my work ticks every task', async () => {
    await chooseMode(page, 'solo', ++fresh);
    const runs = lesson.steps.flatMap((step, s) => step.runs.map((run, r) => ({k: `${s}.${r}`, run})));
    for (const {k, run} of runs) {
      await learnerDoes(page, run, {alternative: true});
      await wait(page, k => window.__rsCoach.solo.seen[k], k, run.ide?.restarted ? 90000 : 30000)
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
