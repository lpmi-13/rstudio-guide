// Phase 0, spike S1: can the coach type multi-line statements exactly and run them with Run?
//
// Types four statements (a |> pipeline, a ggplot + chain with arguments across lines, a tribble
// and a function) into a scratch script, one key at a time, two ways:
//   A "natural": Ace's editor.insert, as the coach types today, so RStudio's auto-indent and
//     auto-pairing act as they do for a learner; the coach then corrects the indentation.
//   B "plain": session.insert, which bypasses auto-indent and auto-pairing.
// Then presses Run with the cursor on each statement's first line and no selection, and checks the
// Console echoed the whole statement ("> " then "+ " lines) with no error.
//
//   ./run.sh up statistical-tools && NODE_PATH=$(npm root -g) node spikes/phase0/s1_multiline.cjs results/spikes
const fs = require('fs');
const path = require('path');
const {chromium} = require('@playwright/test');
const {ROOT, provision, signIn} = require('../../tests/lib.cjs');

const STATEMENTS = {
  pipeline: 'mpg |>\n  filter(cyl == 4) |>\n  summarize(mean_hwy = mean(hwy), n = n(), .by = class)',
  ggplot: 'ggplot(\n  data = mpg,\n  mapping = aes(x = displ, y = hwy, colour = class)\n) +\n  geom_point() +\n  labs(title = "Engine size and highway mileage")',
  tribble: 'tribble(\n  ~station, ~docks,\n  "Mill Lane", 12,\n  "Harbour", 20\n)',
  func: 'km_to_miles <- function(km) {\n  km * 0.621371\n}',
};

async function main(outDir) {
  fs.mkdirSync(outDir, {recursive: true});
  const password = provision('statistical-tools');
  const script = path.join(ROOT, 'run/project/spike.R');
  fs.writeFileSync(script, '# Spike S1\n\n');
  const browser = await chromium.launch();
  const page = await browser.newPage({viewport: {width: 1440, height: 900}});
  await signIn(page, password, null);
  const result = {statements: {}};

  // Attach the tidyverse as a learner would, by typing in the Console.
  await page.click('#rstudio_console_input');
  await page.keyboard.type('library(tidyverse)\n');
  await page.waitForFunction(() => /tidyverse|Attaching core/.test(document.getElementById('rstudio_console_output').textContent), null, {timeout: 30000});

  // Open the scratch script from Files.
  await page.locator('#rstudio_workbench_panel_files').getByText('spike.R', {exact: true}).click();
  await page.waitForFunction(() => [...document.querySelectorAll('#rstudio_Source_pane [role="tab"]')]
    .some(t => t.getAttribute('aria-selected') === 'true' && t.textContent.trim().replace(/\*$/, '') === 'spike.R'), null, {timeout: 15000});
  await page.waitForTimeout(1000);

  for (const strategy of ['natural', 'plain']) {
    for (const [name, code] of Object.entries(STATEMENTS)) {
      const typed = await page.evaluate(async ({code, strategy}) => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const el = [...document.querySelectorAll('#rstudio_Source_pane .ace_editor')].find(e => e.offsetParent && e.env?.editor);
        const editor = el.env.editor;
        const session = editor.session;
        editor.focus();
        // Start on a new line at the end of the document, after a blank line.
        const last = session.getLength() - 1;
        editor.clearSelection();
        editor.moveCursorTo(last, session.getLine(last).length);
        editor.insert('\n');
        const startRow = editor.getCursorPosition().row;
        // Remove any indentation Ace added on the new line.
        if (session.getLine(startRow).length) session.remove({start: {row: startRow, column: 0}, end: {row: startRow, column: session.getLine(startRow).length}});
        editor.moveCursorTo(startRow, 0);
        const lines = code.split('\n');
        const events = {corrections: 0, steppedOver: 0, inserts: 0};
        for (let li = 0; li < lines.length; li += 1) {
          const want = lines[li];
          const row = startRow + li;
          if (li > 0) {
            // A new line, then the reference's indentation.
            if (strategy === 'natural') {
              editor.insert('\n');
              events.inserts += 1;
            } else {
              const at = editor.getCursorPosition();
              session.insert(at, '\n');
              editor.moveCursorTo(at.row + 1, 0);
              events.inserts += 1;
            }
            const indent = want.length - want.trimStart().length;
            const have = session.getLine(row);
            const auto = have.length - have.trimStart().length;
            if (auto !== indent || have.trim()) {
              // Ace indented differently, or pushed an auto-paired closer onto this line.
              events.corrections += 1;
            }
            // Keep anything after the cursor (an auto-paired closer Ace moved down), reset the indent.
            const rest = have.trimStart();
            session.replace({start: {row, column: 0}, end: {row, column: have.length}}, ' '.repeat(indent) + rest);
            editor.moveCursorTo(row, indent);
          }
          const body = want.trimStart();
          for (let i = 0; i < body.length; i += 1) {
            await sleep(8);
            const c = body[i];
            const at = editor.getCursorPosition();
            if (strategy === 'natural') {
              const after = session.getLine(at.row).slice(at.column);
              if (after.startsWith(c) && ')]}"\''.includes(c)) events.steppedOver += 1;
              editor.insert(c);
            } else {
              session.insert(at, c);
              editor.moveCursorTo(at.row, at.column + 1);
            }
            events.inserts += 1;
          }
          if (strategy === 'natural') {
            // An auto-paired closer may sit after the cursor; it belongs to a later line of the
            // reference, so leave it for the next line's handling unless this is the last line.
            if (li === lines.length - 1) {
              const at = editor.getCursorPosition();
              const after = session.getLine(at.row).slice(at.column);
              if (after) { events.corrections += 1; session.remove({start: at, end: {row: at.row, column: at.column + after.length}}); }
            }
          }
        }
        // Natural typing can leave auto-paired closers on lines below the statement.
        const endRow = startRow + lines.length - 1;
        const got = session.getLines(startRow, endRow).join('\n');
        const below = session.getLines(endRow + 1, session.getLength() - 1).join('\n');
        if (strategy === 'natural' && below.trim()) {
          events.corrections += 1;
          session.remove({start: {row: endRow, column: session.getLine(endRow).length}, end: {row: session.getLength() - 1, column: session.getLine(session.getLength() - 1).length}});
        }
        return {startRow, got, exact: got === code, leftoverBelow: below, ...events};
      }, {code, strategy});

      // Run with the cursor at the start of the statement's first line and no selection.
      const before = await page.evaluate(() => document.getElementById('rstudio_console_output').textContent.length);
      await page.evaluate(row => {
        const editor = [...document.querySelectorAll('#rstudio_Source_pane .ace_editor')].find(e => e.offsetParent && e.env?.editor).env.editor;
        editor.focus();
        editor.clearSelection();
        editor.moveCursorTo(row, 0);
      }, typed.startRow);
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('#rstudio_Source_pane button')].find(x => x.offsetParent && /^Run\b/.test(x.getAttribute('title') || ''));
        const r = b.getBoundingClientRect();
        const init = {bubbles: true, cancelable: true, composed: true, view: window, button: 0, buttons: 1, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2};
        for (const type of ['pointerover', 'mouseover', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
          b.dispatchEvent(type.startsWith('pointer') ? new PointerEvent(type, init) : new MouseEvent(type, init));
        }
      });
      await page.waitForTimeout(name === 'ggplot' ? 4000 : 2500);
      const ran = await page.evaluate(({before, code}) => {
        const text = document.getElementById('rstudio_console_output').textContent.slice(before);
        // The coach's own parser (consoleEntries): "> " starts a command, "+ " continues it.
        const entries = [];
        let entry = null;
        for (const line of text.split('\n')) {
          if (line.startsWith('> ')) { entry = {code: line.slice(2), output: ''}; entries.push(entry); }
          else if (entry && line.startsWith('+ ') && !entry.output) entry.code += `\n${line.slice(2)}`;
          else if (entry) entry.output += `${line}\n`;
        }
        const key = s => s.replace(/#[^\n]*/g, '').replace(/\s+/g, '');
        const match = entries.find(e => key(e.code) === key(code));
        return {entries: entries.length, echoedWhole: Boolean(match), error: /Error\b/.test(text),
          echo: match?.code, outputHead: match?.output.slice(0, 160), raw: text.slice(0, 400)};
      }, {before, code});
      result.statements[`${strategy}:${name}`] = {...typed, run: ran};
      console.log(`${strategy.padEnd(7)} ${name.padEnd(8)} exact=${typed.exact} corrections=${typed.corrections} steppedOver=${typed.steppedOver}  ran whole=${ran.echoedWhole} error=${ran.error}`);
      if (!typed.exact) console.log(`   got: ${JSON.stringify(typed.got)}\n   below: ${JSON.stringify(typed.leftoverBelow)}`);
    }
  }

  // What a learner's own keystrokes produce: real key presses (trusted), Enter at each line end,
  // no indentation typed. Shows what RStudio's auto-indent and auto-pairing leave in the script.
  result.learner = {};
  for (const [name, code] of Object.entries(STATEMENTS)) {
    const startRow = await page.evaluate(() => {
      const editor = [...document.querySelectorAll('#rstudio_Source_pane .ace_editor')].find(e => e.offsetParent && e.env?.editor).env.editor;
      const s = editor.session;
      editor.focus();
      editor.clearSelection();
      editor.moveCursorTo(s.getLength() - 1, s.getLine(s.getLength() - 1).length);
      editor.insert('\n\n');
      return editor.getCursorPosition().row;
    });
    for (const [i, line] of code.split('\n').entries()) {
      if (i > 0) await page.keyboard.press('Enter');
      await page.keyboard.type(line.trimStart(), {delay: 5});
    }
    const got = await page.evaluate(({startRow, n}) => {
      const editor = [...document.querySelectorAll('#rstudio_Source_pane .ace_editor')].find(e => e.offsetParent && e.env?.editor).env.editor;
      return editor.session.getLines(startRow, startRow + n + 2).join('\n');
    }, {startRow, n: code.split('\n').length});
    result.learner[name] = {got, sameAsReference: got.trimEnd() === code};
    console.log(`learner ${name.padEnd(8)} same=${got.trimEnd() === code}${got.trimEnd() === code ? '' : `  got ${JSON.stringify(got)}`}`);
  }

  await page.screenshot({path: path.join(outDir, 's1.png')});
  fs.writeFileSync(path.join(outDir, 's1.json'), JSON.stringify(result, null, 2));
  await browser.close();
}

main(process.argv[2] || 'results/spikes').catch(e => { console.error(e); process.exit(1); });
