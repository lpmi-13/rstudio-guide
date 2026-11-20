// Phase 0, spikes S2 (evidence channel) and S3 (Console width).
//
// S2: types statements into the Console as a learner would and polls /coach/api/evidence from the
// page until R's record of each appears. It measures that latency and the callback's cost, checks
// that an anonymous request is refused, and checks the Console shows nothing extra. It then
// computes the same statements' fingerprints the way the build-time bake would (Rscript in a
// throwaway, network-less container from the same image) and compares them with the live ones.
// S3: prints a wide tibble in the docked layout at 1366x768 and compares it with the reference
// printout at width 200.
//
//   NODE_PATH=$(npm root -g) node spikes/phase0/s2_evidence.cjs results/spikes
const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');
const {chromium} = require('@playwright/test');
const {ROOT, GATEWAY, provision, signIn} = require('../../tests/lib.cjs');

const CSV = 'station,docks,opened\nMill Lane,12,2024-03-01\nHarbour,n/a,2023-11-05\nOld Quay,8,\nMarket Square,20,2025-06-30\n';
// [id, code]. Ids that share a prefix before "~" are expected to share a fingerprint.
const STATEMENTS = [
  ['csv', 'read_csv("spike.csv", na = c("n/a", ""), show_col_types = FALSE)'],
  ['summary~by', 'mpg |> filter(cyl == 4) |> summarize(mean_hwy = mean(hwy), n = n(), .by = class)'],
  ['summary~group_by', 'mpg |> filter(cyl == 4) |> group_by(class) |> summarize(mean_hwy = mean(hwy), n = n())'],
  ['mpg~plain', 'mpg'],
  ['mpg~grouped', 'mpg |> group_by(class)'],
  ['mpg~data.frame', 'as.data.frame(mpg)'],
  ['dates', 'tibble(d = as.Date("2026-03-08") + 0:2, t = as.POSIXct("2026-03-08 01:30", tz = "America/Chicago") + 3600 * 0:2)'],
  ['plot~positional', 'ggplot(mpg, aes(displ, hwy, colour = class)) + geom_point()'],
  ['plot~named_layer_aes', 'ggplot(data = mpg, mapping = aes(x = displ, y = hwy)) + geom_point(mapping = aes(colour = class))'],
  ['plot_loess', 'ggplot(mpg, aes(displ, hwy)) + geom_point() + geom_smooth()'],
  ['lm', 'lm(hwy ~ displ, data = mpg)'],
  ['assign', 'fast <- mpg |> filter(hwy > 30)'],
  ['seed', 'set.seed(1)'],
  ['big150k', 'big <- tibble(x = runif(150000), g = sample(letters, 150000, replace = TRUE))'],
  ['big150k_print', 'big'],
  ['flights_iah', 'nycflights13::flights |> filter(dest == "IAH")'],
  ['flights', 'nycflights13::flights'],
];

async function main(outDir) {
  fs.mkdirSync(outDir, {recursive: true});
  const password = provision('statistical-tools');
  fs.writeFileSync(path.join(ROOT, 'run/project/spike.csv'), CSV);
  const browser = await chromium.launch();
  const page = await browser.newPage({viewport: {width: 1366, height: 768}});
  await signIn(page, password, null);
  const out = {live: {}, bake: {}, compare: {}};

  // Anonymous requests are refused; the signed-in page gets JSON.
  const anon = await browser.newContext();
  const anonResponse = await anon.request.get(`${GATEWAY}/coach/api/evidence`, {maxRedirects: 0});
  out.anonymousStatus = anonResponse.status();
  out.anonymousBody = (await anonResponse.text()).slice(0, 80);
  const evidence = () => page.evaluate(() => fetch('/coach/api/evidence', {cache: 'no-store'}).then(r => (r.ok ? r.json() : {status: r.status})));
  console.log(`anonymous: ${out.anonymousStatus}  signed in: ${(await evidence()).session ? 'JSON' : 'none'}`);

  const type = async code => {
    await page.click('#rstudio_console_input');
    await page.keyboard.insertText(code);
    const before = (await evidence()).seq || 0;
    const t0 = Date.now();
    await page.keyboard.press('Enter');
    for (;;) {
      const e = await evidence();
      const c = (e.calls || []).find(x => x.seq > before);
      if (c) return {latencyMs: Date.now() - t0, ...c};
      if (Date.now() - t0 > 30000) return {latencyMs: null};
      await page.waitForTimeout(25);
    }
  };
  await type('library(tidyverse)');
  for (const [id, code] of STATEMENTS) {
    const c = await type(code);
    out.live[id] = c;
    console.log(`${id.padEnd(22)} latency ${String(c.latencyMs).padStart(5)} ms  fingerprint ${String(c.ms).padStart(4)} ms  queued ${String(c.queued_ms).padStart(4)} ms  ${c.class} ${JSON.stringify(c.dim)} ${c.fp?.slice(0, 8)} any:${c.fp_any?.slice(0, 8)}`);
  }

  // The Console shows each statement once and the loess message once: the recorder adds nothing.
  const consoleText = await page.evaluate(() => document.getElementById('rstudio_console_output').textContent);
  out.loessMessages = (consoleText.match(/geom_smooth\(\)` using method/g) || []).length;
  out.consoleErrors = (consoleText.match(/Error\b[^\n]*/g) || []);

  // S3: the Console's width and a wide tibble as RStudio prints it in the docked layout.
  await page.click('#rstudio_console_input');
  await page.keyboard.press('Control+l');
  await type('getOption("width")');
  await type('nycflights13::flights');
  out.s3 = await page.evaluate(() => {
    const text = document.getElementById('rstudio_console_output').textContent;
    const width = /\[1\] (\d+)/.exec(text)?.[1];
    const at = text.indexOf('> nycflights13::flights');
    return {width: Number(width), printed: text.slice(at).split('\n').slice(1, 6).join('\n'), more: /more variables?:?[^\n]*/.exec(text.slice(at))?.[0]};
  });
  await page.screenshot({path: path.join(outDir, 's3-docked.png')});

  // The bake's view: the same statements in Rscript, in a throwaway container with no network.
  const bakeScript = `
    lab <- new.env(); sys.source("/opt/lab/evidence.R", envir = lab)
    suppressPackageStartupMessages(library(tidyverse))
    setwd("/work")
    statements <- jsonlite::fromJSON("/work/statements.json", simplifyVector = FALSE)
    res <- list()
    for (s in statements) {
      v <- withVisible(eval(parse(text = s[[2]]), envir = globalenv()))$value
      res[[s[[1]]]] <- suppressMessages(suppressWarnings(lab$describe(v)))
    }
    options(width = 200)
    res$s3_reference <- paste(utils::head(capture.output(print(nycflights13::flights)), 5), collapse = "\\n")
    jsonlite::write_json(res, "/work/bake.json", auto_unbox = TRUE, null = "null")
  `;
  const work = fs.mkdtempSync(path.join(ROOT, 'results', 'bake-'));
  fs.writeFileSync(path.join(work, 'spike.csv'), CSV);
  fs.writeFileSync(path.join(work, 'statements.json'), JSON.stringify(STATEMENTS));
  fs.writeFileSync(path.join(work, 'bake.R'), bakeScript);
  execFileSync('docker', ['run', '--rm', '--network', 'none', '--user', `${process.getuid()}:${process.getgid()}`,
    '-v', `${work}:/work`, '--entrypoint', 'Rscript', 'rstudio-guide-runtime:local', '/work/bake.R'], {stdio: ['ignore', 'ignore', 'inherit']});
  out.bake = JSON.parse(fs.readFileSync(path.join(work, 'bake.json'), 'utf8'));
  fs.rmSync(work, {recursive: true, force: true});

  for (const [id] of STATEMENTS) {
    const live = out.live[id];
    const bake = out.bake[id];
    out.compare[id] = {same: live.fp === bake.fp && live.fp_any === bake.fp_any, live: live.fp, bake: bake.fp};
  }
  const groups = {};
  for (const [id] of STATEMENTS) {
    const g = id.split('~')[0];
    (groups[g] = groups[g] || []).push(id);
  }
  out.equivalents = Object.fromEntries(Object.entries(groups).filter(([, ids]) => ids.length > 1).map(([g, ids]) => [g, {
    fp: new Set(ids.map(id => out.live[id].fp)).size === 1,
    fp_any: new Set(ids.map(id => out.live[id].fp_any)).size === 1,
  }]));
  console.log('\nlive vs bake:', Object.entries(out.compare).map(([id, c]) => `${id}=${c.same ? 'same' : 'DIFFERENT'}`).join('  '));
  console.log('equivalent code:', JSON.stringify(out.equivalents));
  console.log(`loess message shown ${out.loessMessages} time(s); Console errors: ${out.consoleErrors.length}`);
  console.log(`\nS3 width in the docked layout: ${out.s3.width}\n${out.s3.printed}\n${out.s3.more}\n\nreference (width 200):\n${out.bake.s3_reference}`);
  fs.writeFileSync(path.join(outDir, 's2.json'), JSON.stringify(out, null, 2));
  await browser.close();
}

main(process.argv[2] || 'results/spikes').catch(e => { console.error(e); process.exit(1); });
