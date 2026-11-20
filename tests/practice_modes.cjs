// Mode picker, Guided and Solo audit. For each lesson it provisions a fresh run,
// signs in through the gateway and works as a learner would: it clicks the
// coach's visible buttons and types into RStudio's Console and Source pane with
// the keyboard. It reads the coach's state only to know when to look, never to
// complete a line.
//
// It checks that:
// - a new run opens on Demonstration, Guided and Solo, all in view, and the coach
//   does nothing in RStudio until one is chosen;
// - Guided counts a line only once RStudio shows the reference result, from the
//   Console or the script, however the line is spaced or quoted, and = for <-;
//   an R error or a different result gets feedback instead;
// - hints come one at a time, and Show me types and runs the line with the
//   pointer, is recorded as shown, and reports an R error without counting;
// - Solo discloses nothing until Check my work, counts hints, and never counts
//   lines run before Solo was chosen, even after a reload refills the Console;
// - reload keeps the chosen mode and progress, and Change mode returns to the picker;
// - the default run holds both lessons: lesson cards sit above the mode cards, all
//   in view, and each lesson keeps its own mode and progress.
//
//   NODE_PATH=$(npm root -g) node tests/practice_modes.cjs [results-dir]
const {chromium} = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const {
  ROOT, audit, assert, provision, warnings, signIn, waitForCoach, coachEl,
  now, record, editorLines, verifyPointer, verifyTyping, verifySpotlight, overlayState, plotSrc, dockedGeometry,
} = require('./lib.cjs');

const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'results'));
const {results, probe} = audit(OUT);

const pickerView = page => page.evaluate(() => {
  const root = document.getElementById('rs-coach-host').shadowRoot;
  const body = root.querySelector('.body').getBoundingClientRect();
  const cards = [...root.querySelectorAll('.mode-card')];
  const lessons = [...root.querySelectorAll('.lesson-card')];
  return {
    mode: window.__rsCoach.mode,
    lesson: window.__rsCoach.lesson,
    label: root.querySelector('.mode').textContent,
    lessons: lessons.map(c => ({id: c.dataset.lesson, checked: c.getAttribute('aria-checked') === 'true', what: c.querySelector('.what').textContent})),
    cards: cards.map(c => c.querySelector('strong').textContent),
    inView: [...lessons, ...cards].map(c => {
      const r = c.getBoundingClientRect();
      return r.top >= body.top && r.bottom <= body.bottom && r.bottom <= innerHeight && r.width >= 200;
    }),
    cardBottom: Math.round(Math.max(...cards.map(c => c.getBoundingClientRect().bottom))),
    switchLabel: root.querySelector('button.switch')?.textContent,
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

// The learner types a command at the Console prompt and presses Enter.
async function consoleRun(page, line) {
  await page.click('#rstudio_console_input');
  await page.keyboard.type(line);
  await page.keyboard.press('Enter');
}
// The learner clicks the step heading in the script, starts a new line below it, types the
// code and runs it with Ctrl+Enter.
async function scriptRun(page, after, line) {
  const box = await page.locator('#rstudio_Source_pane .ace_line', {hasText: after}).first().boundingBox();
  await page.mouse.click(box.x + 40, box.y + box.height / 2); // Ace's layers fail Playwright's click checks
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type(line);
  await page.keyboard.press('Control+Enter');
}
const waitGuided = (page, fn, arg, timeout = 20000) => page.waitForFunction(fn, arg, {timeout, polling: 100});

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  // ---------------- graphical-tools: picker, Guided, then Solo ----------------
  {
    const password = provision('graphical-tools');
    const scriptPath = path.join(ROOT, 'run/project/graphical-tools.R');
    const context = await browser.newContext({viewport: {width: 1440, height: 900}});
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(`graphical: ${e.message}`));
    let lesson;

    await probe('picker: a new run opens on Demonstration, Guided and Solo, all in view, and the coach waits', async () => {
      await signIn(page, password, null);
      lesson = await page.evaluate(() => fetch('/coach/api/steps').then(r => r.json()).then(s => s.lessons[0]));
      const view = await pickerView(page);
      assert(view.mode === null && view.label === 'Choose a mode', JSON.stringify(view));
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

    await probe('guided: step 1 only; an R error and a different chart get feedback and do not count', async () => {
      await coachEl(page, 'button.mode-card[data-mode="guided"]').click();
      await waitGuided(page, () => window.__rsCoach.guided);
      const start = await guidedView(page);
      assert(start.mode === 'guided' && start.steps.join() === 'active,pending,pending,pending' && start.tasks.join() === 'active', JSON.stringify(start));
      await consoleRun(page, 'plot(5, q)');
      await waitGuided(page, () => /R reported: Error/.test(document.getElementById('rs-coach-host').shadowRoot.querySelector('.feedback').textContent));
      const onError = await guidedView(page);
      await consoleRun(page, 'plot(4, 4)');
      await waitGuided(page, () => /ran plot\(4, 4\), but that isn't/.test(document.getElementById('rs-coach-host').shadowRoot.querySelector('.feedback').textContent));
      const onOther = await guidedView(page);
      assert(Object.keys(onOther.done).length === 0 && !onOther.explain, `a wrong line counted: ${JSON.stringify(onOther)}`);
      return {onError: onError.feedback, onOther: onOther.feedback};
    });

    await probe('guided: plot(5,5) typed in the Console counts as plot(5, 5) once a new chart shows, then explains', async () => {
      const plotBefore = await plotSrc(page);
      await consoleRun(page, 'plot(5,5)');
      await waitGuided(page, () => window.__rsCoach.guided.done['0.0']);
      const view = await guidedView(page);
      const plotAfter = await plotSrc(page);
      assert(view.done['0.0'] === 'learner' && view.tasks.join() === 'done' && view.steps[0] === 'done', JSON.stringify(view));
      assert(plotAfter && plotAfter !== plotBefore, 'no new chart when the line counted');
      assert(view.explain.startsWith('plot() drew one point') && view.next === 'Next: step 2' && !view.feedback, JSON.stringify(view));
      await page.screenshot({path: path.join(OUT, 'guided-step1.png')});
      return {next: view.next};
    });

    await probe('guided: hints come one at a time; Show me types and runs the line with the pointer and counts it as shown', async () => {
      await coachEl(page, 'button.next').click();
      const hints = [];
      for (let i = 0; i < 3; i += 1) {
        await coachEl(page, 'button.hint').click();
        hints.push((await guidedView(page)).hints.length);
      }
      const hinted = await guidedView(page);
      assert(hints.join() === '1,2,3', `hints shown after each click: ${hints}`);
      assert(hinted.hints[0].includes('# Step 2. Lines: type = "l"') && hinted.hints[1].includes('plot(…)') && hinted.hints[2].includes('plot(1:10, type="l")'), JSON.stringify(hinted.hints));
      assert(hinted.hintButton.disabled && hinted.hintButton.text === 'No more hints', JSON.stringify(hinted.hintButton));
      const since = await now(page);
      await coachEl(page, 'button.show').click();
      await waitGuided(page, () => window.__rsCoach.guided.done['1.0'] && !window.__rsCoach.guided.showing, null, 60000);
      const until = await now(page);
      const view = await guidedView(page);
      assert(view.done['1.0'] === 'coach' && view.explain.startsWith('1:10 is the whole numbers'), JSON.stringify(view));
      const rec = await record(page);
      const clicks = verifyPointer(rec, since, until);
      const code = lesson.steps[1].runs[0].code;
      const typing = verifyTyping(rec, since, until, [code]);
      const spotlit = verifySpotlight(rec, since, until);
      const shade = await overlayState(page);
      assert(!shade.dim && !shade.spot, `RStudio stayed dimmed after Show me: ${JSON.stringify(shade)}`);
      const saved = fs.readFileSync(scriptPath, 'utf8').split('\n');
      assert(saved[saved.indexOf(lesson.steps[1].heading) + 1] === code, 'Show me did not save the line under step 2\'s heading');
      await page.screenshot({path: path.join(OUT, 'guided-show-me.png')});
      return {clicks, ...typing, ...spotlit};
    });

    await probe('guided: lines typed below the heading in the script and run with Ctrl+Enter count (slices = c(...) for <-)', async () => {
      await coachEl(page, 'button.next').click();
      await scriptRun(page, '# Step 3. Pie chart: pie()', 'slices = c(50, 20, 30)');
      await waitGuided(page, () => window.__rsCoach.guided.done['2.0']);
      const first = await guidedView(page);
      assert(first.tasks.join() === 'done,active' && !first.explain, `after the first line: ${JSON.stringify(first)}`);
      await scriptRun(page, 'slices = c(50, 20, 30)', 'pie(slices)');
      await waitGuided(page, () => window.__rsCoach.guided.done['2.1']);
      const view = await guidedView(page);
      assert(view.done['2.0'] === 'learner' && view.done['2.1'] === 'learner' && view.explain.startsWith('c() combined'), JSON.stringify(view));
      return {lines: (await editorLines(page)).filter(l => /slices/.test(l))};
    });

    await probe('guided: reload keeps the mode and progress mid-step', async () => {
      await coachEl(page, 'button.next').click();
      await consoleRun(page, 'frequencies <- c(3, 6, 9)');
      await waitGuided(page, () => window.__rsCoach.guided.done['3.0']);
      await page.reload();
      await page.waitForSelector('#rstudio_console_input', {timeout: 90000});
      await waitForCoach(page, 'guided');
      const view = await guidedView(page);
      assert(view.mode === 'guided' && view.step === 3 && view.steps.join() === 'done,done,done,active' && view.tasks.join() === 'done,active,pending', JSON.stringify(view));
      return {steps: view.steps, tasks: view.tasks};
    });

    await probe('guided: finishing step 4 shows the debrief (3 of 4 steps without help, 3 hints, 1 line shown)', async () => {
      await page.waitForTimeout(1500); // the coach starts counting once the refilled Console has settled
      await consoleRun(page, 'label <- c(\'X\', \'Y\', \'Z\')');
      await consoleRun(page, 'barplot(frequencies, names.arg = label)');
      await waitGuided(page, () => !document.getElementById('rs-coach-host').shadowRoot.querySelector('.debrief').hidden);
      const view = await guidedView(page);
      assert(/Steps done without help: 3 of 4/.test(view.debrief) && /Hints read: 3/.test(view.debrief) && /Lines the coach showed you: 1/.test(view.debrief), view.debrief);
      assert(view.steps.every(s => s === 'done') && !view.next, JSON.stringify(view));
      await page.screenshot({path: path.join(OUT, 'guided-debrief.png')});
      return {debrief: view.debrief};
    });

    await probe('solo: Change mode returns to the picker; Solo lists every task and discloses nothing until checked', async () => {
      await coachEl(page, 'button.switch').click();
      const picker = await pickerView(page);
      assert(picker.mode === null && picker.cards.length === 3 && !picker.started, JSON.stringify(picker));
      await coachEl(page, 'button.mode-card[data-mode="solo"]').click();
      await waitGuided(page, () => window.__rsCoach.solo);
      const start = await soloView(page);
      const total = lesson.steps.reduce((n, s) => n + s.runs.length, 0);
      assert(Object.keys(start.lines).length === total && Object.values(start.lines).every(c => c === 'pending') && !start.results, JSON.stringify(start));
      await consoleRun(page, 'plot(5, 5)');
      await waitGuided(page, () => window.__rsCoach.solo.seen['0.0']);
      await page.waitForTimeout(500);
      const quiet = await soloView(page);
      assert(Object.values(quiet.lines).every(c => c === 'pending') && !quiet.results, `Solo disclosed a result before Check: ${JSON.stringify(quiet)}`);
      return {lines: total, seenButHidden: quiet.seen};
    });

    await probe('solo: after a reload, lines run before Solo (the Guided ones) still do not count', async () => {
      await page.reload();
      await page.waitForSelector('#rstudio_console_input', {timeout: 90000});
      await waitForCoach(page, 'solo');
      await page.waitForTimeout(3000);
      const view = await soloView(page);
      assert(view.mode === 'solo' && view.seen.join() === '0.0', `seen after reload: ${view.seen}`);
      return {seen: view.seen};
    });

    await probe('solo: Check discloses 1 of 7; a hint is counted; every line run and checked again shows all 7', async () => {
      await coachEl(page, 'button.check').click();
      const first = await soloView(page);
      assert(/^1 of 7 lines done/.test(first.results) && first.lines['0.0'] === 'done' && first.lines['2.1'] === 'missing' && /Hints used: 0/.test(first.results), JSON.stringify(first));
      await coachEl(page, 'button.hint[data-line="3.2"]').click();
      const hinted = await soloView(page);
      assert(hinted.hintTexts.join() === 'It starts like this: barplot(…)', JSON.stringify(hinted.hintTexts));
      for (const line of ['plot(1:10, type="l")', 'slices <- c(50, 20, 30)', 'pie(slices)', 'frequencies <- c(3, 6, 9)', 'label <- c("X", "Y", "Z")', 'barplot(frequencies, names.arg = label)']) {
        await consoleRun(page, line);
        await page.waitForTimeout(400);
      }
      await waitGuided(page, () => Object.keys(window.__rsCoach.solo.seen).length === 7);
      const before = await soloView(page);
      assert(before.lines['2.1'] === 'missing', 'Solo updated the result before the learner checked again');
      await coachEl(page, 'button.check').click();
      const done = await soloView(page);
      assert(/^All 7 lines done/.test(done.results) && /Hints used: 1/.test(done.results) && Object.values(done.lines).every(c => c === 'done'), JSON.stringify(done));
      await page.screenshot({path: path.join(OUT, 'solo-complete.png')});
      return {first: first.results.slice(0, 20), last: done.results.slice(0, 60)};
    });
    await context.close();
  }

  // ---------------- statistical-tools (narrower window): picker, Solo, Show me failure ----------------
  {
    const password = provision('statistical-tools');
    const context = await browser.newContext({viewport: {width: 1366, height: 768}});
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(`statistical: ${e.message}`));

    await probe('statistical (1366x768): the three modes fit the docked coach without scrolling', async () => {
      await signIn(page, password, null);
      const view = await pickerView(page);
      assert(view.inView.every(Boolean), JSON.stringify(view));
      await page.screenshot({path: path.join(OUT, 'mode-picker-1366x768.png')});
      return {lowestCardBottom: view.cardBottom, viewport: 768};
    });

    await probe('statistical solo: printed output counts however the line is written; a wrong answer does not', async () => {
      await coachEl(page, 'button.mode-card[data-mode="solo"]').click();
      await waitGuided(page, () => window.__rsCoach.solo);
      await consoleRun(page, 'max(airquality$Temp)'); // the reference uses sample_data$Temp
      await consoleRun(page, 'sample_data = airquality');
      await consoleRun(page, 'mean(sample_data$Temp, trim = 0.1)'); // a different number
      await page.waitForTimeout(2000);
      await coachEl(page, 'button.check').click();
      const view = await soloView(page);
      assert(view.seen.join() === '0.0,0.1' && /^2 of 8 lines done/.test(view.results), JSON.stringify(view));
      return {seen: view.seen};
    });

    await probe('statistical guided: Show me reports an R error without counting, then runs the line already in the script', async () => {
      await coachEl(page, 'button.switch').click();
      await coachEl(page, 'button.mode-card[data-mode="guided"]').click();
      await waitGuided(page, () => window.__rsCoach.guided);
      await consoleRun(page, 'sample_data <- airquality');
      await waitGuided(page, () => window.__rsCoach.guided.done['0.0']);
      await consoleRun(page, 'rm(sample_data)');
      await coachEl(page, 'button.show').click();
      await waitGuided(page, () => /couldn't show this line/.test(document.getElementById('rs-coach-host').shadowRoot.querySelector('.feedback').textContent), null, 60000);
      await page.waitForTimeout(1500); // the message stays while the learner runs nothing new
      const failed = await guidedView(page);
      assert(/R reported: Error.*sample_data/.test(failed.feedback) && !failed.done['0.1'] && !failed.showing, JSON.stringify(failed));
      await page.screenshot({path: path.join(OUT, 'guided-show-me-failed.png')});
      await consoleRun(page, 'sample_data <- airquality');
      await page.waitForTimeout(1000);
      const since = await now(page);
      await coachEl(page, 'button.show').click();
      await waitGuided(page, () => window.__rsCoach.guided.done['0.1'] && !window.__rsCoach.guided.showing, null, 60000);
      const until = await now(page);
      const rec = await record(page);
      verifyTyping(rec, since, until, []); // the line from the failed attempt is reused, not typed again
      const view = await guidedView(page);
      assert(view.done['0.1'] === 'coach' && view.tasks.join() === 'done,done,active', JSON.stringify(view));
      return {failed: failed.feedback, clicks: verifyPointer(rec, since, until)};
    });
    await context.close();
  }

  // ---------------- the default run: both lessons in one project (1366x768) ----------------
  {
    const password = provision();
    const context = await browser.newContext({viewport: {width: 1366, height: 768}});
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(`lessons: ${e.message}`));
    const coachText = sel => page.evaluate(sel => document.getElementById('rs-coach-host').shadowRoot.querySelector(sel)?.textContent.trim(), sel);

    await probe('two lessons (1366x768): lesson cards above the mode cards, all in view; the coach waits', async () => {
      await signIn(page, password, null);
      const view = await pickerView(page);
      assert(view.mode === null && view.label === 'Choose a lesson and mode', JSON.stringify(view));
      assert(view.lessons.map(l => `${l.id}:${l.checked}`).join() === 'graphical-tools:true,statistical-tools:false', JSON.stringify(view.lessons));
      assert(view.lessons[0].what === '4 steps: plot(), type = "l", pie(), barplot()', view.lessons[0].what);
      assert(view.cards.join() === 'Demonstration,Guided,Solo' && view.inView.every(Boolean), JSON.stringify(view));
      const files = ['graphical-tools.R', 'statistical-tools.R', 'lessons.Rproj', 'README.md'].filter(f => fs.existsSync(path.join(ROOT, 'run/project', f)));
      assert(files.length === 4 && /lessons/.test(await page.title()), `project files ${files}, title ${await page.title()}`);
      const rec = await record(page);
      assert(!view.started && rec.clicks.length === 0 && rec.edits.length === 0, 'the coach acted before a mode was chosen');
      await page.screenshot({path: path.join(OUT, 'lessons-picker.png')});
      return {lessons: view.lessons.map(l => l.what), lowestCardBottom: view.cardBottom, viewport: 768};
    });

    await probe('two lessons: Statistical, then Solo, opens that lesson and counts its lines', async () => {
      await coachEl(page, '.lesson-card[data-lesson="statistical-tools"]').click();
      const picked = await pickerView(page);
      assert(picked.lessons.map(l => l.checked).join() === 'false,true' && picked.mode === null, JSON.stringify(picked));
      await coachEl(page, 'button.mode-card[data-mode="solo"]').click();
      await waitGuided(page, () => window.__rsCoach.solo);
      const title = await coachText('h2');
      await consoleRun(page, 'max(airquality$Temp)');
      await waitGuided(page, () => window.__rsCoach.solo.seen['0.1']);
      const view = await soloView(page);
      assert(title === 'Statistical tools in base R' && Object.keys(view.lines).length === 8, `${title}: ${JSON.stringify(view)}`);
      return {title, seen: view.seen};
    });

    await probe('two lessons: Change lesson or mode, then Graphical in Demonstration opens graphical-tools.R and runs step 1', async () => {
      const label = await coachText('button.switch');
      assert(label === 'Change lesson or mode', label);
      await coachEl(page, 'button.switch').click();
      const picker = await pickerView(page);
      assert(picker.lessons.map(l => l.checked).join() === 'false,true', `the picker forgot the lesson: ${JSON.stringify(picker.lessons)}`);
      await coachEl(page, '.lesson-card[data-lesson="graphical-tools"]').click();
      await coachEl(page, 'button.mode-card[data-mode="demonstration"]').click();
      await waitGuided(page, () => window.__rsCoach.demo);
      const plotBefore = await plotSrc(page);
      const since = await now(page);
      await coachEl(page, 'button.go').click();
      await waitGuided(page, () => window.__rsCoach.demo.completed.includes(0) && window.__rsCoach.demo.state === 'waiting', null, 60000);
      const until = await now(page);
      const tab = await page.evaluate(() => [...document.querySelectorAll('#rstudio_Source_pane [role="tab"]')].find(t => t.getAttribute('aria-selected') === 'true')?.innerText.trim());
      const rec = await record(page);
      const clicks = verifyPointer(rec, since, until);
      const typing = verifyTyping(rec, since, until, ['plot(5, 5)']);
      assert(tab === 'graphical-tools.R' && (await plotSrc(page)) !== plotBefore, `active tab ${tab}`);
      await page.screenshot({path: path.join(OUT, 'lessons-demo-step1.png')});
      return {tab, clicks, ...typing};
    });

    await probe('two lessons: reload reopens Graphical Demonstration; Statistical Solo kept what it had seen', async () => {
      await page.reload();
      await page.waitForSelector('#rstudio_console_input', {timeout: 90000});
      await waitForCoach(page, 'demonstration');
      const lesson = await page.evaluate(() => window.__rsCoach.lesson);
      const go = await coachText('button.go');
      assert(lesson === 'graphical-tools' && go === 'Next: step 2', `${lesson}, ${go}`);
      await coachEl(page, 'button.switch').click();
      await coachEl(page, '.lesson-card[data-lesson="statistical-tools"]').click();
      await coachEl(page, 'button.mode-card[data-mode="solo"]').click();
      await waitGuided(page, () => window.__rsCoach.solo);
      await coachEl(page, 'button.check').click();
      const view = await soloView(page);
      assert(/^1 of 8 lines done/.test(view.results) && view.lines['0.1'] === 'done', JSON.stringify(view));
      return {graphical: go, statistical: view.results.slice(0, 18)};
    });
    await context.close();
  }

  await browser.close();
  const summary = {when: new Date().toISOString(), passed: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length, warnings, pageErrors: errors, results};
  fs.writeFileSync(path.join(OUT, 'practice-results.json'), JSON.stringify(summary, null, 2));
  console.log(`\n${summary.passed} passed, ${summary.failed} failed; warnings: ${warnings.length}; page errors: ${errors.length}`);
  process.exit(summary.failed || errors.length ? 1 : 0);
})();
