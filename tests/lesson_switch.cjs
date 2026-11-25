// Picker and lesson-switch audit, for the lessons modelled on R for Data Science. It provisions a
// run of the two audit fixtures (engine-actions, then engine-check, in the "Audit fixtures" part),
// adds 30 notes files that sort above the scripts in the Files pane, signs in at 1366x768 and checks:
//
// - the picker opens on the lessons by part, each with its step count, none chosen and no mode
//   cards; a chosen lesson then shows on one line, with the mode cards in view, and Change opens
//   the lessons again;
// - a Demonstration that has to open its script from Files scrolls the Files list to it first;
// - finishing a lesson ticks it in the picker and on its mode card, and its last step offers
//   "Next: lesson 92", which opens the picker on that lesson;
// - starting the next lesson restarts R: the first lesson's package is no longer attached;
// - a reload returns to the mode and lesson; Back on the picker returns to it.
//
//   NODE_PATH=$(npm root -g) node tests/lesson_switch.cjs [results-dir]
const {chromium} = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const {ROOT, audit, assert, provision, warnings, signIn, waitForCoach, coachEl, waitForFreshStart} = require('./lib.cjs');

const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'results', 'lesson-switch'));
const {results, probe} = audit(OUT);
const FAST = {rsCoachTypeMs: 5, rsCoachReadMinMs: 200, rsCoachReadStepMs: 1, rsCoachPaceMs: 200, rsCoachLeadMs: 100, rsCoachDwellMs: 300};
const wait = (page, fn, arg, timeout = 30000) => page.waitForFunction(fn, arg, {timeout, polling: 100});

const pickerView = page => page.evaluate(() => {
  const root = document.getElementById('rs-coach-host').shadowRoot;
  const cards = [...root.querySelectorAll('.mode-card')];
  return {
    mode: window.__rsCoach.mode,
    lesson: window.__rsCoach.lesson,
    label: root.querySelector('.pick-label')?.textContent ?? null,
    then: root.querySelector('.then')?.textContent ?? null,
    row: root.querySelector('.lesson-row')?.innerText.replace(/\s+/g, ' ').trim() ?? null,
    listOpen: !root.querySelector('.lesson-list')?.hidden,
    parts: [...root.querySelectorAll('.lesson-list details')].map(d => ({part: d.querySelector('summary').textContent, open: d.open,
      lessons: [...d.querySelectorAll('.lesson-pick')].map(b => b.innerText.replace(/\s+/g, ' ').trim())})),
    cards: cards.map(c => c.querySelector('strong').innerText.trim()),
    cardsInView: cards.every(c => c.getBoundingClientRect().bottom <= innerHeight),
    back: root.querySelector('button.back')?.textContent ?? null,
  };
});
const evidence = page => page.evaluate(() => fetch('/coach/api/evidence', {cache: 'no-store'}).then(r => r.json()));

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const password = provision('engine-actions', 'engine-check');
  for (let n = 1; n <= 30; n += 1) fs.writeFileSync(path.join(ROOT, 'run/project', `aa-notes-${String(n).padStart(2, '0')}.txt`), `Note ${n}\n`);
  const page = await (await browser.newContext({viewport: {width: 1366, height: 768}})).newPage();
  page.on('pageerror', e => errors.push(e.message));
  let fresh = 0;

  await probe('picker: the lessons by part, none chosen and no mode cards; a lesson then shows on one line, mode cards in view; Change lists the lessons again', async () => {
    await page.goto('http://127.0.0.1:8788/auth-sign-in');
    await page.evaluate(settings => { for (const [k, v] of Object.entries(settings)) localStorage.setItem(k, String(v)); }, FAST);
    await signIn(page, password, null);
    const first = await pickerView(page);
    assert(first.mode === null && first.lesson === null && first.row === null && first.listOpen && first.cards.length === 0, JSON.stringify(first));
    assert(first.label === 'Choose a lesson' && /^Then choose how to work:/.test(first.then), JSON.stringify(first));
    assert(first.parts.length === 1 && first.parts[0].open && first.parts[0].lessons.join() === '91 Engine actions 6 steps,92 Engine check 7 steps', JSON.stringify(first.parts));
    await page.screenshot({path: path.join(OUT, 'picker-first.png')});
    await coachEl(page, '.lesson-pick[data-lesson="engine-actions"]').click();
    const view = await pickerView(page);
    assert(view.mode === null && view.lesson === 'engine-actions' && /Lesson 91 · Audit fixtures Engine actions Change/.test(view.row) && !view.listOpen, JSON.stringify(view));
    assert(view.cards.join() === 'Demonstration,Guided,Solo' && view.cardsInView, JSON.stringify(view));
    await coachEl(page, 'button.change').click();
    const open = await pickerView(page);
    assert(open.listOpen && open.parts.length === 1 && open.parts[0].part === 'Audit fixtures', JSON.stringify(open.parts));
    assert(/^91 Engine actions 6 steps$/.test(open.parts[0].lessons[0]) && /^92 Engine check 7 steps$/.test(open.parts[0].lessons[1]), JSON.stringify(open.parts));
    await page.screenshot({path: path.join(OUT, 'picker-open.png')});
    await coachEl(page, '.lesson-pick[data-lesson="engine-actions"]').click();
    const closed = await pickerView(page);
    assert(!closed.listOpen && closed.lesson === 'engine-actions', JSON.stringify(closed));
    return {first: first.label, row: view.row, lessons: open.parts[0].lessons};
  });

  await probe('Demonstration opens its script from Files, scrolling the list to it first', async () => {
    await coachEl(page, 'button.mode-card[data-mode="demonstration"]').click();
    await waitForFreshStart(page, ++fresh);
    await wait(page, () => window.__rsCoach.demo);
    // The learner closes the script, so the coach has to find it in Files, below 30 notes files.
    await page.locator('#rstudio_Source_pane [role="tab"]', {hasText: 'engine-actions.R'}).locator('img[alt="Close document tab"]').click();
    await wait(page, () => ![...document.querySelectorAll('#rstudio_Source_pane [role="tab"]')].some(t => t.offsetParent && t.textContent.includes('engine-actions.R')));
    // Opening the script at the fresh start scrolled Files to it; the learner scrolls back to the top.
    const hidden = await page.evaluate(() => {
      const link = [...document.querySelectorAll('#rstudio_workbench_panel_files *')].find(el => el.childElementCount === 0 && el.textContent.trim() === 'engine-actions.R');
      let box = link.parentElement;
      while (box && !/auto|scroll/.test(getComputedStyle(box).overflowY)) box = box.parentElement;
      box.scrollTop = 0;
      return link.getBoundingClientRect().top > box.getBoundingClientRect().bottom;
    });
    assert(hidden, 'the script was already in view in the Files pane, so this checks nothing');
    // Auto-advance starts off (since 24 November 2026); this probe runs the whole demonstration without presses.
    await coachEl(page, 'button.auto').click();
    await coachEl(page, 'button.go').click();
    const end = await wait(page, () => {
      const d = window.__rsCoach.demo;
      return d && (d.state === 'failed' || (d.state === 'waiting' && d.completed.length === 6)) ? {state: d.state, failure: d.failure} : null;
    }, null, 10 * 60000).then(h => h.jsonValue());
    assert(end.state === 'waiting', `the demonstration failed: ${end.failure}`);
    const log = await page.evaluate(() => window.__rsCoach.log.filter(e => e.type === 'demo_action' && /scroll_files|open_script/.test(e.action)).map(e => `${e.action}:${e.script || ''}`));
    assert(log.indexOf('scroll_files:') >= 0 && log.indexOf('scroll_files:') < log.indexOf('open_script:engine-actions.R'), JSON.stringify(log));
    return {actions: log};
  });

  await probe('a finished lesson offers the next one, and the picker ticks it', async () => {
    const next = await coachEl(page, 'button.next-lesson').textContent();
    assert(next === 'Next: lesson 92 · Engine check', next);
    await coachEl(page, 'button.next-lesson').click();
    const view = await pickerView(page);
    assert(view.lesson === 'engine-check' && /Lesson 92 · Audit fixtures Engine check/.test(view.row), JSON.stringify(view));
    await coachEl(page, 'button.change').click();
    const open = await pickerView(page);
    assert(/^91 Engine actions 6 steps ✓$/.test(open.parts[0].lessons[0]) && !/✓/.test(open.parts[0].lessons[1]), JSON.stringify(open.parts));
    await coachEl(page, '.lesson-pick[data-lesson="engine-actions"]').click();
    const done = await pickerView(page);
    assert(done.cards[0] === 'Demonstration ✓ done' && done.cards[1] === 'Guided', JSON.stringify(done.cards));
    await page.screenshot({path: path.join(OUT, 'picker-ticked.png')});
    await coachEl(page, 'button.change').click();
    await coachEl(page, '.lesson-pick[data-lesson="engine-check"]').click();
    return {next, lessons: open.parts[0].lessons};
  });

  await probe('starting the next lesson restarts R: the last lesson\'s package is gone', async () => {
    const before = await evidence(page);
    assert(before.state.attached.includes('dplyr'), `dplyr wasn't attached to begin with: ${before.state.attached}`);
    await coachEl(page, 'button.mode-card[data-mode="guided"]').click();
    const {last} = await waitForFreshStart(page, ++fresh);
    await wait(page, () => window.__rsCoach.guided);
    await coachEl(page, 'button.begin').click();
    const after = await wait(page, session => fetch('/coach/api/evidence', {cache: 'no-store'}).then(r => r.json())
      .then(e => (e.session !== session && e.state ? e : null)), before.session, 20000).then(h => h.jsonValue());
    assert(last.restarted && !after.state.attached.includes('dplyr'), `restarted: ${last.restarted}, attached: ${after.state.attached}`);
    return {resetMs: last.ms, attached: after.state.attached.length};
  });

  await probe('reload returns to Guided in Engine check; Back on the picker returns to it', async () => {
    await page.reload();
    await page.waitForSelector('#rstudio_console_input', {timeout: 90000});
    await waitForCoach(page, 'guided');
    assert(await page.evaluate(() => window.__rsCoach.lesson) === 'engine-check', 'the reload changed the lesson');
    await coachEl(page, 'button.switch').click();
    const view = await pickerView(page);
    assert(view.back === 'Back to Guided: Engine check', JSON.stringify(view));
    await coachEl(page, 'button.back').click();
    await wait(page, () => window.__rsCoach.guided);
    return {back: view.back};
  });

  await probe('no page errors', async () => {
    assert(errors.length === 0, errors.join(' | '));
  });

  await browser.close();
  const passed = results.filter(r => r.ok).length;
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({results, warnings, errors}, null, 2));
  console.log(`\n${passed} passed, ${results.length - passed} failed; warnings: ${warnings.length}; page errors: ${errors.length}`);
  process.exit(passed === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
