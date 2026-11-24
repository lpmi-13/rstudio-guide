// Audit of a run with RStudio's sign-in off (DISABLE_AUTH=true), the way the iximiuz playground runs,
// and of the gateway's starting page. It provisions a one-lesson run with sign-in off and iximiuz's
// frame origin, and checks that:
//
// - run.sh says there is no sign-in and prints no password, and the account still gets the run's
//   password rather than keeping Rocker's default one;
// - / opens the IDE with no sign-in form, through RStudio's own redirects, and the coach opens;
// - RStudio still lets iximiuz frame it (runtime/04_lab_frame_origin runs after Rocker swaps in its
//   no-sign-in rserver.conf);
// - the evidence is served to that browser, and still not to a client that never opened RStudio;
// - while RStudio isn't listening, / answers with the starting page (503, never cached) and every
//   other path with nginx's 502, and a browser left on the starting page opens RStudio by itself
//   once RStudio is back.
//
//   NODE_PATH=$(npm root -g) node tests/no_sign_in.cjs [results-dir]
const {chromium} = require('@playwright/test');
const {execFileSync} = require('child_process');
const fs = require('fs');
const path = require('path');
const {ROOT, RUN_DIR, GATEWAY, audit, assert, warnings, waitForCoach} = require('./lib.cjs');

const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'results', 'no-sign-in'));
const {results, probe} = audit(OUT);
const LESSON = 'engine-actions';
const FRAME_ORIGIN = 'https://labs.iximiuz.com';
const COMPOSE = ['compose', '-p', process.env.LAB_COMPOSE_NAME || 'rstudio-guide', '--env-file', path.join(RUN_DIR, '.env')];
const inRStudio = (...cmd) => execFileSync('docker', [...COMPOSE, 'exec', '-T', 'rstudio', ...cmd], {cwd: ROOT, encoding: 'utf8'});
// RStudio Server runs as an s6 service in Rocker's image; -d stops it and -u starts it, leaving the
// container (and so the gateway's route to it) up, as in the moment before RStudio first listens.
const RSERVER = '/var/run/s6/services/rstudio';

(async () => {
  const up = execFileSync(path.join(ROOT, 'run.sh'), ['up', LESSON], {
    cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'],
    env: {...process.env, DISABLE_AUTH: 'true', FRAME_ORIGIN},
  });
  const browser = await chromium.launch();
  const errors = [];
  const context = await browser.newContext({viewport: {width: 1366, height: 768}});
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));

  await probe("run.sh: no sign-in and no password shown; the account has the run's password, not Rocker's", async () => {
    const env = fs.readFileSync(path.join(RUN_DIR, '.env'), 'utf8');
    const password = env.match(/^RSTUDIO_PASSWORD=(\S+)$/m)[1];
    assert(/^DISABLE_AUTH=true$/m.test(env), 'DISABLE_AUTH=true is not in the run\'s .env');
    assert(/\(no sign-in\)/.test(up) && /^Then choose /m.test(up) && !up.includes(password), up);
    const matches = pw => inRStudio('perl', '-e',
      'my $h = (split /:/, `getent shadow rstudio`)[1]; print crypt($ARGV[0], $h) eq $h ? "yes" : "no"', pw);
    const rockerDefault = matches('rstudio');
    const runPassword = matches(password);
    assert(rockerDefault === 'no' && runPassword === 'yes', JSON.stringify({rockerDefault, runPassword}));
    return {output: up.trim().split('\n'), rockerDefault, runPassword};
  });

  await probe('/ opens the IDE with no sign-in form; the session runs as rstudio; the coach opens its picker', async () => {
    const navigations = [];
    page.on('response', r => {
      if (r.request().isNavigationRequest() && r.frame() === page.mainFrame()) navigations.push(`${r.status()} ${new URL(r.url()).pathname}`);
    });
    await page.goto(`${GATEWAY}/`);
    await page.waitForSelector('#rstudio_console_input', {timeout: 90000});
    await waitForCoach(page, null);
    const ui = await page.evaluate(() => ({signInForm: Boolean(document.querySelector('#signinbutton, #password')), mode: window.__rsCoach.mode}));
    const sessionUser = inRStudio('ps', '-o', 'user=', '-C', 'rsession').trim();
    // RStudio signs the browser in on its own sign-in URL, which never shows a form with sign-in off.
    assert(JSON.stringify(navigations) === '["302 /","302 /auth-sign-in","200 /"]', JSON.stringify(navigations));
    assert(!ui.signInForm && ui.mode === null && sessionUser === 'rstudio', JSON.stringify({ui, sessionUser}));
    await page.screenshot({path: path.join(OUT, 'ide-no-sign-in.png')});
    return {navigations, sessionUser};
  });

  await probe('iximiuz can still frame RStudio: auth-none and the frame origin are both in rserver.conf', async () => {
    const conf = inRStudio('cat', '/etc/rstudio/rserver.conf').split('\n');
    const res = await page.request.get(`${GATEWAY}/`, {headers: {'User-Agent': await page.evaluate(() => navigator.userAgent)}});
    const csp = res.headers()['content-security-policy'] || '';
    // RStudio also sends the older X-Frame-Options: ALLOW-FROM <origin>, which browsers ignore in
    // favour of the CSP; DENY or SAMEORIGIN would mean the frame origin had been lost.
    const xfo = res.headers()['x-frame-options'] || '';
    assert(conf.includes('auth-none=1') && conf.includes(`www-frame-origin=${FRAME_ORIGIN}`), conf.join(' | '));
    assert(res.status() === 200 && csp.includes(`frame-ancestors ${FRAME_ORIGIN}`) && !/deny|sameorigin/i.test(xfo),
      JSON.stringify({status: res.status(), csp, xfo}));
    return {csp, xfo};
  });

  await probe('evidence: served to the browser that opened RStudio; 401 for a client that never did', async () => {
    const mine = await page.evaluate(() => fetch('/coach/api/evidence', {cache: 'no-store'}).then(r => r.status));
    const anonymous = await browser.newContext();
    const stranger = (await anonymous.request.get(`${GATEWAY}/coach/api/evidence`, {maxRedirects: 0})).status();
    await anonymous.close();
    assert(mine === 200 && stranger === 401, JSON.stringify({mine, stranger}));
    return {mine, stranger};
  });

  await context.close(); // RStudio stops below, and this IDE would only report the lost connection

  await probe('starting page: while RStudio is down, / shows it and other paths get 502; left open, it opens RStudio once RStudio is back', async () => {
    const viewer = await browser.newContext({viewport: {width: 1366, height: 768}});
    const startPage = await viewer.newPage();
    startPage.on('pageerror', e => errors.push(e.message));
    inRStudio('s6-svc', '-d', RSERVER);
    let res;
    for (let i = 0; i < 50; i += 1) {
      res = await viewer.request.get(`${GATEWAY}/`, {maxRedirects: 0});
      if (res.status() === 503) break;
      await startPage.waitForTimeout(200);
    }
    const headers = res.headers();
    const body = await res.text();
    assert(res.status() === 503 && /RStudio is starting/.test(body) && /^text\/html/.test(headers['content-type'] || '')
      && headers['cache-control'] === 'no-store' && headers['retry-after'] === '2',
      JSON.stringify({status: res.status(), headers}));
    const others = {};
    for (const p of ['/auth-sign-in', '/rpc/client_init', '/coach/__starting']) {
      others[p] = (await viewer.request.get(`${GATEWAY}${p}`, {maxRedirects: 0})).status();
    }
    assert(JSON.stringify(others) === '{"/auth-sign-in":502,"/rpc/client_init":502,"/coach/__starting":404}', JSON.stringify(others));
    await startPage.goto(`${GATEWAY}/`);
    await startPage.getByText('RStudio is starting').waitFor();
    await startPage.screenshot({path: path.join(OUT, 'starting-page.png')});
    let reloads = 0;
    startPage.on('framenavigated', f => { if (f === startPage.mainFrame()) reloads += 1; });
    await startPage.waitForTimeout(4500); // it keeps reloading while RStudio is down
    const reloadsWhileDown = reloads;
    inRStudio('s6-svc', '-u', RSERVER);
    const backAt = Date.now();
    await startPage.waitForSelector('#rstudio_console_input', {timeout: 90000});
    const openedAfterMs = Date.now() - backAt;
    await waitForCoach(startPage, null);
    await viewer.close();
    assert(reloadsWhileDown >= 1, `the starting page did not reload itself (${reloadsWhileDown} reloads in 4.5 s)`);
    return {others, reloadsWhileDown, openedAfterMs};
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
