// Mode picker, Guided and Solo audit, on the lessons modelled on R for Data Science. For each run it
// provisions it fresh, signs in through the gateway and works as a learner would: it clicks the
// coach's visible buttons and types into RStudio's Console and Source pane with the keyboard. It
// reads the coach's state only to know when to look, never to complete a task.
//
// It checks that:
// - a new run opens on Demonstration, Guided and Solo, all in view, and the coach
//   does nothing in RStudio until one is chosen;
// - Guided counts a statement only once R has the reference result, from the Console or the
//   script, however it is written (quotes, = for <-, other arguments that give the same result);
//   an R error or a different result gets feedback instead;
// - hints come one at a time, and Show me types and runs the statement with the pointer, is
//   recorded as shown, and reports an R error without counting;
// - Solo discloses nothing until Check my work, counts hints, and never counts
//   statements run before Solo was chosen, even after a reload refills the Console;
// - reload keeps the chosen mode and progress, and Change mode returns to the picker;
// - choosing a mode starts the lesson afresh, whatever ran before, in any mode or lesson:
//   the script holds only its step headings (saved, with no undo history), the Console,
//   Environment and Plots are empty, and progress starts over.
//   Demonstration then Guided is the case a learner reported: step 1's code was already
//   written. Back on the picker returns to the mode just left, as it was;
// - the default run holds every lesson written so far (tools/collection.py): the picker shows the
//   first on one line, with the mode cards in view, and Change lists them by part.
//
// Runs: 01 Data visualization (picker, Guided, then Solo), 03 Data transformation at 1366x768
// (Solo, then Guided with a failing Show me), and the default run at 1366x768.
//
//   NODE_PATH=$(npm root -g) node tests/practice_modes.cjs [results-dir]
const {chromium} = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const {
  ROOT, audit, assert, provision, warnings, signIn, waitForCoach, coachEl,
  now, record, editorLines, verifyPointer, verifyTyping, verifySpotlight, overlayState, plotSrc, dockedGeometry,
  rstudioState, verifyFresh, waitForFreshStart, freshStarts,
} = require('./lib.cjs');

const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'results'));
const {results, probe} = audit(OUT);
// The default run: every lesson in the collection that has been written, in order (./run.sh up).
const DEFAULT = require('child_process').execFileSync('python3', ['-I', path.join(ROOT, 'tools/collection.py')], {encoding: 'utf8'}).trim().split('\n');
const steps = page => page.evaluate(() => fetch('/coach/api/steps').then(r => r.json()));

const pickerView = page => page.evaluate(() => {
  const root = document.getElementById('rs-coach-host').shadowRoot;
  const body = root.querySelector('.body').getBoundingClientRect();
  const cards = [...root.querySelectorAll('.mode-card')];
  return {
    mode: window.__rsCoach.mode,
    lesson: window.__rsCoach.lesson,
    label: root.querySelector('.mode').textContent,
    row: root.querySelector('.lesson-row')?.innerText.replace(/\s+/g, ' ').trim() ?? null,
    listOpen: Boolean(root.querySelector('.lesson-list')) && !root.querySelector('.lesson-list').hidden,
    // Each part's lessons, read from the markup: only the current lesson's part is expanded.
    parts: [...root.querySelectorAll('.lesson-list details')].map(d => ({part: d.querySelector('summary').textContent, open: d.open,
      lessons: [...d.querySelectorAll('.lesson-pick')].map(b => `${b.dataset.lesson}: ${b.querySelector('.what')?.textContent.trim()}`)})),
    cards: cards.map(c => c.querySelector('strong').innerText.trim()),
    inView: cards.map(c => {
      const r = c.getBoundingClientRect();
      return r.top >= body.top && r.bottom <= body.bottom && r.bottom <= innerHeight && r.width >= 200;
    }),
    cardBottom: Math.round(Math.max(...cards.map(c => c.getBoundingClientRect().bottom))),
    switchLabel: root.querySelector('button.switch')?.textContent,
    back: root.querySelector('button.back')?.textContent ?? null,
    started: Boolean(window.__rsCoach.demo || window.__rsCoach.guided || window.__rsCoach.solo),
  };
});

const guidedView = page => page.evaluate(() => {
  const root = document.getElementById('rs-coach-host').shadowRoot;
  const $ = s => root.querySelector(s);
  const g = window.__rsCoach.guided;
  return {
    mode: window.__rsCoach.mode,
    step: g?.step,
    showing: g?.showing,
    done: g ? {...g.done} : null,
    steps: [...root.querySelectorAll('li[data-step]')].map(li => li.className || 'pending'),
    tasks: [...root.querySelectorAll('.tasks li')].map(li => li.className || 'pending'),
    hints: [...root.querySelectorAll('.hint-text')].map(h => h.textContent),
    hintButton: $('button.hint') && {text: $('button.hint').textContent, disabled: $('button.hint').disabled},
    feedback: $('.feedback')?.textContent || '',
    explain: $('.explain')?.textContent || '',
    next: $('.next') && !$('.next').hidden ? $('.next').textContent : null,
    debrief: $('.debrief') && !$('.debrief').hidden ? $('.debrief').textContent.replace(/\s+/g, ' ').trim() : null,
  };
});

const soloView = page => page.evaluate(() => {
  const root = document.getElementById('rs-coach-host').shadowRoot;
  const results = root.querySelector('.results');
  return {
    mode: window.__rsCoach.mode,
    seen: Object.keys(window.__rsCoach.solo?.seen || {}).sort(),
    lines: Object.fromEntries([...root.querySelectorAll('li[data-line]')].map(li => [li.dataset.line, li.className || 'pending'])),
    hintTexts: [...root.querySelectorAll('li[data-line] .hint-text')].map(h => h.textContent).filter(Boolean),
    results: results && !results.hidden ? results.textContent.replace(/\s+/g, ' ').trim() : null,
    check: root.querySelector('button.check')?.textContent,
  };
});

// The learner at the Console prompt: the statement goes in as typed (pasted, so RStudio's
// auto-pairing doesn't add brackets), then Enter runs all its lines. A statement that teaches
// Ctrl+Shift+M (`keys`) gets each |> from the shortcut, which RStudio types as " |> ".
async function consoleRun(page, code, keys = null) {
  await page.click('#rstudio_console_input');
  const parts = keys ? code.split('|>') : [code];
  for (const [i, part] of parts.entries()) {
    if (i > 0) await page.keyboard.press(keys.replace('Ctrl', 'Control'));
    await page.keyboard.insertText(i < parts.length - 1 ? part.trimEnd() : part);
  }
  await page.keyboard.press('Enter');
}
// The learner clicks a line in the script (a step heading, say), starts a new line below it, types
// the code and runs it with Ctrl+Enter.
async function scriptRun(page, after, line) {
  const box = await page.locator('#rstudio_Source_pane .ace_line', {hasText: after}).first().boundingBox();
  await page.mouse.click(box.x + 40, box.y + box.height / 2); // Ace's layers fail Playwright's click checks
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type(line);
  await page.keyboard.press('Control+Enter');
}
const waitFor = (page, fn, arg, timeout = 30000) => page.waitForFunction(fn, arg, {timeout, polling: 100});
const feedbackMatches = (page, source) => waitFor(page, source => new RegExp(source).test(
  document.getElementById('rs-coach-host').shadowRoot.querySelector('.feedback').textContent), source);

// Guided: the learner runs each statement of step `s` at the Console, as written in the lesson,
// waiting for each to tick.
async function guidedStep(page, lesson, s, from = 0) {
  for (const [r, run] of lesson.steps[s].runs.entries()) {
    if (r < from) continue;
    await consoleRun(page, run.code, run.keys);
    await waitFor(page, k => window.__rsCoach.guided.done[k], `${s}.${r}`);
  }
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  // ---------------- 01 Data visualization: picker, Guided, then Solo ----------------
  {
    const LESSON = '01-data-visualization';
    const password = provision(LESSON);
    const scriptPath = path.join(ROOT, 'run/project', `${LESSON}.R`);
    const context = await browser.newContext({viewport: {width: 1440, height: 900}});
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(`${LESSON}: ${e.message}`));
    let lesson;

    await probe('picker: a new run opens on Demonstration, Guided and Solo, all in view, and the coach waits', async () => {
      await signIn(page, password, null);
      lesson = (await steps(page)).lessons[0];
      assert(lesson.id === LESSON, `the run's lesson is ${lesson.id}`);
      const view = await pickerView(page);
      assert(view.mode === null && view.label === 'Choose a mode' && view.back === null, JSON.stringify(view));
      assert(view.cards.join() === 'Demonstration,Guided,Solo', `cards: ${view.cards}`);
      assert(view.inView.every(Boolean), `cards not all in view without scrolling: ${JSON.stringify(view)}`);
      const g = await dockedGeometry(page);
      assert(g.parent === 'rstudio_Sidebar_pane' && Object.keys(g.overlaps).length === 0, JSON.stringify(g));
      await page.waitForTimeout(3000);
      const rec = await record(page);
      assert(!view.started && rec.clicks.length === 0 && rec.edits.length === 0, `the coach acted before a mode was chosen: ${rec.clicks.length} clicks, ${rec.edits.length} edits`);
      await page.screenshot({path: path.join(OUT, 'mode-picker.png')});
      return {cards: view.cards, lowestCardBottom: view.cardBottom, viewport: 900};
    });

    await probe('guided: step 1 only; an R error and a different result get feedback and do not count', async () => {
      await coachEl(page, 'button.mode-card[data-mode="guided"]').click();
      await waitForFreshStart(page, 1);
      await waitFor(page, () => window.__rsCoach.guided);
      const start = await guidedView(page);
      const pending = lesson.steps.slice(1).map(() => 'pending').join();
      assert(start.mode === 'guided' && start.steps.join() === `active,${pending}` && start.tasks.join() === 'active', JSON.stringify(start));
      await consoleRun(page, 'library(tidyvers)');
      await feedbackMatches(page, 'R reported: Error');
      const onError = await guidedView(page);
      await consoleRun(page, 'library(janitor)');
      await feedbackMatches(page, 'ran library\\(janitor\\), but R\'s result isn\'t');
      const onOther = await guidedView(page);
      assert(Object.keys(onOther.done).length === 0 && !onOther.explain, `a wrong statement counted: ${JSON.stringify(onOther)}`);
      return {onError: onError.feedback, onOther: onOther.feedback};
    });

    await probe('guided: library("tidyverse"), with quotes, counts once R has the tidyverse attached, then explains', async () => {
      await consoleRun(page, 'library("tidyverse")');
      await waitFor(page, () => window.__rsCoach.guided.done['0.0']);
      const view = await guidedView(page);
      assert(view.done['0.0'] === 'learner' && view.tasks.join() === 'done' && view.steps[0] === 'done', JSON.stringify(view));
      assert(view.explain.startsWith('library(tidyverse) attaches ggplot2') && view.next === 'Next: step 2' && !view.feedback, JSON.stringify(view));
      await page.screenshot({path: path.join(OUT, 'guided-step1.png')});
      return {next: view.next};
    });

    await probe('guided: a statement typed below the heading in the script and run with Ctrl+Enter counts (= for <-, single quotes)', async () => {
      await coachEl(page, 'button.next').click();
      await scriptRun(page, lesson.steps[1].heading, 'week = read_csv(\'data/trips-week.csv\')');
      await waitFor(page, () => window.__rsCoach.guided.done['1.0']);
      const view = await guidedView(page);
      assert(view.done['1.0'] === 'learner' && view.tasks.join() === 'done,active' && !view.explain, JSON.stringify(view));
      return {lines: (await editorLines(page)).filter(l => /week/.test(l))};
    });

    await probe('guided: hints come one at a time; Show me types and runs the statement with the pointer and counts it as shown', async () => {
      const hints = [];
      for (let i = 0; i < 3; i += 1) {
        await coachEl(page, 'button.hint').click();
        hints.push((await guidedView(page)).hints.length);
      }
      const hinted = await guidedView(page);
      assert(hints.join() === '1,2,3', `hints shown after each click: ${hints}`);
      assert(hinted.hints[0].includes(lesson.steps[1].heading) && /^It starts like this: glimpse\(/.test(hinted.hints[1]) && hinted.hints[2].includes('glimpse(week)'), JSON.stringify(hinted.hints));
      assert(hinted.hintButton.disabled && hinted.hintButton.text === 'No more hints', JSON.stringify(hinted.hintButton));
      const since = await now(page);
      await coachEl(page, 'button.show').click();
      await waitFor(page, () => window.__rsCoach.guided.done['1.1'] && !window.__rsCoach.guided.showing, null, 60000);
      const until = await now(page);
      const view = await guidedView(page);
      assert(view.done['1.1'] === 'coach' && view.explain.startsWith('read_csv() read'), JSON.stringify(view));
      const rec = await record(page);
      const clicks = verifyPointer(rec, since, until);
      const code = lesson.steps[1].runs[1].code;
      const typing = verifyTyping(rec, since, until, [code]);
      const spotlit = verifySpotlight(rec, since, until);
      const shade = await overlayState(page);
      assert(!shade.dim && !shade.spot, `RStudio stayed dimmed after Show me: ${JSON.stringify(shade)}`);
      const saved = fs.readFileSync(scriptPath, 'utf8').split('\n');
      const at = saved.indexOf(lesson.steps[1].heading);
      const end = saved.indexOf(lesson.steps[2].heading);
      assert(at >= 0 && saved.slice(at + 1, end).includes(code), `Show me did not save ${code} under step 2's heading: ${JSON.stringify(saved.slice(at, end))}`);
      await page.screenshot({path: path.join(OUT, 'guided-show-me.png')});
      return {clicks, ...typing, ...spotlit};
    });

    await probe('guided: a different chart gets feedback and does not count; the same chart written another way does', async () => {
      await coachEl(page, 'button.next').click();
      await consoleRun(page, 'ggplot(week, aes(x = distance_km)) + geom_histogram(binwidth = 1)');
      await feedbackMatches(page, 'but R\'s result isn\'t');
      const other = await guidedView(page);
      assert(!other.done['2.0'] && !other.explain, `a different chart counted: ${JSON.stringify(other)}`);
      const plotBefore = await plotSrc(page);
      await consoleRun(page, lesson.steps[2].runs[0].alternatives[0]);
      await waitFor(page, () => window.__rsCoach.guided.done['2.0']);
      const view = await guidedView(page);
      assert(view.done['2.0'] === 'learner' && view.explain.startsWith('A ggplot2 chart has three parts') && (await plotSrc(page)) !== plotBefore, JSON.stringify(view));
      return {feedback: other.feedback, written: lesson.steps[2].runs[0].alternatives[0]};
    });

    await probe('guided: reload keeps the mode and progress mid-step', async () => {
      await coachEl(page, 'button.next').click();
      await guidedStep(page, lesson, 3);
      await coachEl(page, 'button.next').click();
      const first = lesson.steps[4].runs[0]; // step 5: the labelled chart, then ggsave()
      await consoleRun(page, first.code);
      await waitFor(page, () => window.__rsCoach.guided.done['4.0']);
      await page.reload();
      await page.waitForSelector('#rstudio_console_input', {timeout: 90000});
      await waitForCoach(page, 'guided');
      const view = await guidedView(page);
      const want = lesson.steps.map((_s, i) => (i < 4 ? 'done' : i === 4 ? 'active' : 'pending')).join();
      assert(view.mode === 'guided' && view.step === 4 && view.steps.join() === want && view.tasks.join() === 'done,active', JSON.stringify(view));
      return {steps: view.steps, tasks: view.tasks};
    });

    await probe('guided: finishing the lesson shows the debrief (8 of 9 steps without help, 3 hints, 1 task shown)', async () => {
      await page.waitForTimeout(1500); // the coach starts counting once the refilled Console has settled
      await guidedStep(page, lesson, 4, 1);
      for (let s = 5; s < lesson.steps.length; s += 1) {
        await coachEl(page, 'button.next').click();
        await guidedStep(page, lesson, s);
      }
      await waitFor(page, () => !document.getElementById('rs-coach-host').shadowRoot.querySelector('.debrief').hidden);
      const view = await guidedView(page);
      const n = lesson.steps.length;
      assert(new RegExp(`Steps done without help: ${n - 1} of ${n}`).test(view.debrief) && /Hints read: 3/.test(view.debrief) && /Tasks the coach showed you: 1/.test(view.debrief), view.debrief);
      assert(view.steps.every(s => s === 'done') && !view.next, JSON.stringify(view));
      await page.screenshot({path: path.join(OUT, 'guided-debrief.png')});
      return {debrief: view.debrief};
    });

    await probe('solo: Change mode returns to the picker; Solo starts afresh (Guided\'s code, objects and chart are gone), lists every task and discloses nothing until checked', async () => {
      const before = await rstudioState(page);
      assert(before.chart && /week/.test(before.environment) && /facet_wrap/.test(before.console), `Guided left nothing to reset: ${JSON.stringify(before).slice(0, 300)}`);
      const fresh = await freshStarts(page);
      await coachEl(page, 'button.switch').click();
      const picker = await pickerView(page);
      assert(picker.mode === null && picker.cards.length === 3 && !picker.started && picker.back === 'Back to Guided', JSON.stringify(picker));
      await coachEl(page, 'button.mode-card[data-mode="solo"]').click();
      const {last} = await waitForFreshStart(page, fresh + 1);
      await waitFor(page, () => window.__rsCoach.solo);
      verifyFresh(await rstudioState(page), lesson, scriptPath);
      const start = await soloView(page);
      const total = lesson.steps.reduce((n, s) => n + s.runs.length, 0);
      assert(Object.keys(start.lines).length === total && Object.values(start.lines).every(c => c === 'pending') && !start.results, JSON.stringify(start));
      await consoleRun(page, lesson.steps[0].runs[0].code);
      await waitFor(page, () => window.__rsCoach.solo.seen['0.0']);
      await page.waitForTimeout(500);
      const quiet = await soloView(page);
      assert(Object.values(quiet.lines).every(c => c === 'pending') && !quiet.results, `Solo disclosed a result before Check: ${JSON.stringify(quiet)}`);
      return {resetMs: last.ms, tasks: total, seenButHidden: quiet.seen};
    });

    await probe('solo: after a reload, Solo keeps what it saw, and nothing run in Guided counts', async () => {
      await page.reload();
      await page.waitForSelector('#rstudio_console_input', {timeout: 90000});
      await waitForCoach(page, 'solo');
      await page.waitForTimeout(3000);
      const view = await soloView(page);
      assert(view.mode === 'solo' && view.seen.join() === '0.0', `seen after reload: ${view.seen}`);
      return {seen: view.seen};
    });

    await probe('solo: Check discloses 1 task done; a hint is counted; every statement run and checked again shows all done', async () => {
      const total = lesson.steps.reduce((n, s) => n + s.runs.length, 0);
      const lastKey = `${lesson.steps.length - 1}.0`;
      await coachEl(page, 'button.check').click();
      const first = await soloView(page);
      assert(new RegExp(`^1 of ${total} tasks done`).test(first.results) && first.lines['0.0'] === 'done' && first.lines[lastKey] === 'missing' && /Hints used: 0/.test(first.results), JSON.stringify(first));
      await coachEl(page, 'button.hint[data-line="5.0"]').click();
      const hinted = await soloView(page);
      assert(hinted.hintTexts.length === 1 && /^It starts like this: ggplot\(/.test(hinted.hintTexts[0]), JSON.stringify(hinted.hintTexts));
      for (const [s, step] of lesson.steps.entries()) {
        for (const [r, run] of step.runs.entries()) {
          if (s === 0) continue;
          await consoleRun(page, run.code, run.keys);
          await waitFor(page, k => window.__rsCoach.solo.seen[k], `${s}.${r}`);
        }
      }
      const before = await soloView(page);
      assert(before.seen.length === total && before.lines[lastKey] === 'missing', 'Solo updated the result before the learner checked again');
      await coachEl(page, 'button.check').click();
      const done = await soloView(page);
      assert(new RegExp(`^All ${total} tasks done`).test(done.results) && /Hints used: 1/.test(done.results) && Object.values(done.lines).every(c => c === 'done'), JSON.stringify(done));
      await page.screenshot({path: path.join(OUT, 'solo-complete.png')});
      return {first: first.results.slice(0, 24), last: done.results.slice(0, 60)};
    });
    await context.close();
  }

  // ---------------- 03 Data transformation (narrower window): picker, Solo, Show me failure ----------------
  {
    const LESSON = '03-data-transformation';
    const password = provision(LESSON);
    const scriptPath = path.join(ROOT, 'run/project', `${LESSON}.R`);
    const context = await browser.newContext({viewport: {width: 1366, height: 768}});
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(`${LESSON}: ${e.message}`));
    let lesson;

    await probe('lesson 3 (1366x768): the three modes fit the docked coach without scrolling', async () => {
      await signIn(page, password, null);
      lesson = (await steps(page)).lessons[0];
      const view = await pickerView(page);
      assert(view.inView.every(Boolean), JSON.stringify(view));
      await page.screenshot({path: path.join(OUT, 'mode-picker-1366x768.png')});
      return {lowestCardBottom: view.cardBottom, viewport: 768};
    });

    await probe('lesson 3 solo: a result counts however the statement is written; a different result does not', async () => {
      await coachEl(page, 'button.mode-card[data-mode="solo"]').click();
      await waitForFreshStart(page, 1);
      await waitFor(page, () => window.__rsCoach.solo);
      const total = lesson.steps.reduce((n, s) => n + s.runs.length, 0);
      await consoleRun(page, 'library(tidyverse)');
      await consoleRun(page, 'trips = read_csv(\'data/trips.csv\', show_col_types = FALSE)');
      await consoleRun(page, 'arrange(trips, desc(duration_min))'); // the reference is trips |> arrange(desc(duration_min))
      await consoleRun(page, 'arrange(trips, duration_min)'); // shortest first: a different result
      await waitFor(page, () => window.__rsCoach.solo.seen['3.0']);
      await page.waitForTimeout(2000);
      await coachEl(page, 'button.check').click();
      const view = await soloView(page);
      assert(view.seen.join() === '0.0,1.0,3.0' && new RegExp(`^3 of ${total} tasks done`).test(view.results), JSON.stringify(view));
      return {seen: view.seen};
    });

    await probe('lesson 3 guided: starts afresh after Solo (trips is gone); Show me reports an R error without counting, then runs the statement already in the script', async () => {
      const fresh = await freshStarts(page);
      await coachEl(page, 'button.switch').click();
      await coachEl(page, 'button.mode-card[data-mode="guided"]').click();
      await waitForFreshStart(page, fresh + 1);
      await waitFor(page, () => window.__rsCoach.guided);
      verifyFresh(await rstudioState(page), lesson, scriptPath);
      for (let s = 0; s < 3; s += 1) {
        if (s > 0) await coachEl(page, 'button.next').click();
        await guidedStep(page, lesson, s); // step 3's first |> comes from Ctrl+Shift+M
      }
      await coachEl(page, 'button.next').click(); // step 4: arrange() and distinct()
      await consoleRun(page, 'rm(trips)');
      await coachEl(page, 'button.show').click();
      await feedbackMatches(page, 'couldn\'t show this line');
      await page.waitForTimeout(1500); // the message stays while the learner runs nothing new
      const failed = await guidedView(page);
      assert(/R reported: Error.*trips/.test(failed.feedback) && !failed.done['3.0'] && !failed.showing, JSON.stringify(failed));
      await page.screenshot({path: path.join(OUT, 'guided-show-me-failed.png')});
      await consoleRun(page, lesson.steps[1].runs[0].code);
      await page.waitForTimeout(3000);
      const since = await now(page);
      await coachEl(page, 'button.show').click();
      await waitFor(page, () => window.__rsCoach.guided.done['3.0'] && !window.__rsCoach.guided.showing, null, 60000);
      const until = await now(page);
      const rec = await record(page);
      verifyTyping(rec, since, until, []); // the statement from the failed attempt is reused, not typed again
      const view = await guidedView(page);
      assert(view.done['3.0'] === 'coach' && view.tasks.join() === 'done,active', JSON.stringify(view));
      return {failed: failed.feedback, clicks: verifyPointer(rec, since, until)};
    });
    await context.close();
  }

  // ---------------- the default run: every lesson written so far, in one project (1366x768) ----------------
  {
    const password = provision();
    const context = await browser.newContext({viewport: {width: 1366, height: 768}});
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(`lessons: ${e.message}`));
    const coachText = sel => page.evaluate(sel => document.getElementById('rs-coach-host').shadowRoot.querySelector(sel)?.textContent.trim(), sel);
    let lessons;
    let fresh = 0;

    await probe(`the default run of ${DEFAULT.length} lessons (1366x768): the first on one line, the mode cards in view, the coach waits; Change lists the lessons by part`, async () => {
      await signIn(page, password, null);
      lessons = (await steps(page)).lessons;
      assert(lessons.map(l => l.id).join() === DEFAULT.join(), `the default run holds ${lessons.map(l => l.id)}`);
      const view = await pickerView(page);
      assert(view.mode === null && view.label === 'Choose a lesson and mode' && /^Lesson 1 · Whole game Data visualization/.test(view.row) && !view.listOpen, JSON.stringify(view));
      assert(view.cards.join() === 'Demonstration,Guided,Solo' && view.inView.every(Boolean), JSON.stringify(view));
      const files = [...DEFAULT.map(id => lessons.find(l => l.id === id).script), 'lessons.Rproj'].filter(f => fs.existsSync(path.join(ROOT, 'run/project', f)));
      assert(files.length === DEFAULT.length + 1 && /lessons/.test(await page.title()), `project files ${files}, title ${await page.title()}`);
      const rec = await record(page);
      assert(!view.started && rec.clicks.length === 0 && rec.edits.length === 0, 'the coach acted before a mode was chosen');
      await coachEl(page, 'button.change').click();
      const open = await pickerView(page);
      const parts = open.parts.map(p => `${p.part}${p.open ? ' (open)' : ''}: ${p.lessons.join('; ')}`);
      const entry = l => `${l.id}: ${l.steps.length} steps`;
      const byPart = [...new Set(lessons.map(l => l.part))].map(part => `${part}${part === lessons[0].part ? ' (open)' : ''}: ${lessons.filter(l => l.part === part).map(entry).join('; ')}`);
      const want = byPart;
      assert(open.listOpen && parts.join(' | ') === want.join(' | '), JSON.stringify(parts));
      await page.screenshot({path: path.join(OUT, 'lessons-picker.png')});
      return {row: view.row, parts, lowestCardBottom: view.cardBottom, viewport: 768};
    });

    const transformation = () => lessons.find(l => l.id === '03-data-transformation');
    await probe('the default run: Data transformation, then Solo, opens that lesson and counts its tasks', async () => {
      await coachEl(page, '.lesson-pick[data-lesson="03-data-transformation"]').click();
      const picked = await pickerView(page); // the coach's lesson changes once a mode is chosen
      assert(/^Lesson 3 · Whole game Data transformation/.test(picked.row) && !picked.listOpen && picked.mode === null, JSON.stringify(picked));
      await coachEl(page, 'button.mode-card[data-mode="solo"]').click();
      await waitForFreshStart(page, ++fresh);
      await waitFor(page, () => window.__rsCoach.solo);
      const title = await coachText('h2');
      await consoleRun(page, 'library(tidyverse)');
      await waitFor(page, () => window.__rsCoach.solo.seen['0.0']);
      const view = await soloView(page);
      assert(title === 'Data transformation' && Object.keys(view.lines).length === transformation().steps.reduce((n, s) => n + s.runs.length, 0), `${title}: ${JSON.stringify(view)}`);
      return {title, seen: view.seen};
    });

    await probe('the default run: Change lesson or mode, then Data visualization in Demonstration opens its script and runs step 1', async () => {
      const label = await coachText('button.switch');
      assert(label === 'Change lesson or mode', label);
      await coachEl(page, 'button.switch').click();
      const picker = await pickerView(page);
      assert(picker.lesson === '03-data-transformation' && /^Lesson 3 · Whole game Data transformation/.test(picker.row), `the picker forgot the lesson: ${JSON.stringify(picker)}`);
      await coachEl(page, 'button.change').click();
      await coachEl(page, '.lesson-pick[data-lesson="01-data-visualization"]').click();
      await coachEl(page, 'button.mode-card[data-mode="demonstration"]').click();
      await waitForFreshStart(page, ++fresh);
      await waitFor(page, () => window.__rsCoach.demo);
      const since = await now(page);
      await coachEl(page, 'button.go').click();
      await waitFor(page, () => window.__rsCoach.demo.completed.includes(0) && window.__rsCoach.demo.state === 'waiting', null, 60000);
      const until = await now(page);
      const tab = await page.evaluate(() => [...document.querySelectorAll('#rstudio_Source_pane [role="tab"]')].find(t => t.getAttribute('aria-selected') === 'true')?.innerText.trim());
      const rec = await record(page);
      const clicks = verifyPointer(rec, since, until);
      const typing = verifyTyping(rec, since, until, [lessons[0].steps[0].runs[0].code]);
      assert(tab === lessons[0].script, `active tab ${tab}`);
      await page.screenshot({path: path.join(OUT, 'lessons-demo-step1.png')});
      return {tab, clicks, ...typing};
    });

    await probe('the default run: reload reopens the Demonstration where it was; Back on the picker returns to it without a reset', async () => {
      await page.reload(); // within step 1's reading time
      await page.waitForSelector('#rstudio_console_input', {timeout: 90000});
      await waitForCoach(page, 'demonstration');
      const lesson = await page.evaluate(() => window.__rsCoach.lesson);
      const go = await coachText('button.go');
      assert(lesson === '01-data-visualization' && go === 'Next: step 2', `${lesson}, ${go}`);
      await coachEl(page, 'button.switch').click();
      const picker = await pickerView(page);
      assert(picker.back === 'Back to Demonstration: Data visualization', JSON.stringify(picker));
      await coachEl(page, 'button.back').click();
      await waitFor(page, () => window.__rsCoach.demo);
      const back = await coachText('button.go');
      const state = await rstudioState(page);
      const resets = await freshStarts(page);
      assert(back === 'Next: step 2' && state.script.includes('\nlibrary(tidyverse)\n') && resets === 0, `after Back: ${back}, ${resets} fresh starts, ${JSON.stringify(state).slice(0, 300)}`);
      fresh = 0; // the count is per page load
      return {go, back};
    });

    await probe('the default run: Demonstration then Guided starts afresh: step 1\'s code is gone from the script, and the Console, Environment and Plots are empty', async () => {
      const lesson = lessons[0];
      const scriptPath = path.join(ROOT, 'run/project', lesson.script);
      const before = await rstudioState(page);
      assert(before.script.includes('\nlibrary(tidyverse)\n') && before.console.includes('> library(tidyverse)'), `the demonstration left nothing to reset: ${JSON.stringify(before).slice(0, 300)}`);
      await coachEl(page, 'button.switch').click();
      await coachEl(page, 'button.mode-card[data-mode="guided"]').click();
      const {last} = await waitForFreshStart(page, ++fresh);
      await waitFor(page, () => window.__rsCoach.guided);
      verifyFresh(await rstudioState(page), lesson, scriptPath);
      const start = await guidedView(page);
      assert(start.step === 0 && Object.keys(start.done).length === 0 && start.tasks.join() === 'active', JSON.stringify(start));
      await page.screenshot({path: path.join(OUT, 'lessons-guided-after-demo.png')});
      // The learner writes step 1's statement themselves, and it counts as theirs.
      await scriptRun(page, lesson.steps[0].heading, 'library(tidyverse)');
      await waitFor(page, () => window.__rsCoach.guided.done['0.0']);
      const view = await guidedView(page);
      assert(view.done['0.0'] === 'learner', JSON.stringify(view));
      return {resetMs: last.ms, step1: view.done['0.0']};
    });

    await probe('the default run: Data transformation Solo starts afresh too, and what Solo saw before no longer counts', async () => {
      const lesson = transformation();
      await coachEl(page, 'button.switch').click();
      const picker = await pickerView(page);
      assert(picker.back === 'Back to Guided: Data visualization', JSON.stringify(picker));
      await coachEl(page, 'button.change').click();
      await coachEl(page, '.lesson-pick[data-lesson="03-data-transformation"]').click();
      await coachEl(page, 'button.mode-card[data-mode="solo"]').click();
      await waitForFreshStart(page, ++fresh);
      await waitFor(page, () => window.__rsCoach.solo);
      verifyFresh(await rstudioState(page), lesson, path.join(ROOT, 'run/project', lesson.script));
      await coachEl(page, 'button.check').click();
      const view = await soloView(page);
      const total = lesson.steps.reduce((n, s) => n + s.runs.length, 0);
      assert(new RegExp(`^0 of ${total} tasks done`).test(view.results) && view.seen.length === 0, JSON.stringify(view));
      return {results: view.results.slice(0, 24)};
    });
    await context.close();
  }

  await browser.close();
  const summary = {when: new Date().toISOString(), passed: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length, warnings, pageErrors: errors, results};
  fs.writeFileSync(path.join(OUT, 'practice-results.json'), JSON.stringify(summary, null, 2));
  console.log(`\n${summary.passed} passed, ${summary.failed} failed; warnings: ${warnings.length}; page errors: ${errors.length}`);
  process.exit(summary.failed || errors.length ? 1 : 0);
})();
