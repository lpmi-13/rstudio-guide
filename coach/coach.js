// Coach for RStudio Server. The gateway injects this into the IDE host page,
// before RStudio's own scripts load.
//
// The coach docks into RStudio's sidebar when that pane is shown and floats
// otherwise. Guided mode shows goals and a Check work stub. Demonstration mode
// drives RStudio's own Source pane and Run button, waits until the Console or
// Plots pane shows the result, checks it against the run's reference output,
// and only then explains it, using the values RStudio displayed.
//
// The coach never decides whether learner work is correct; that belongs to a
// grader that runs saved files in a separate process.
(() => {
  // Skip frames nested inside RStudio itself (Help, Viewer, ...). RStudio being framed by
  // a cross-origin learning platform (an iximiuz Labs tab) is fine: the parent is unreadable.
  const insideRStudio = (() => {
    if (window.top === window) return false;
    try { return Boolean(window.parent.document.getElementById('rstudio_container')); } catch (_error) { return false; }
  })();
  if (insideRStudio) return;
  if (window.__rsCoach) return; // idempotent if the script is loaded twice

  const coach = (window.__rsCoach = {
    loadedAt: Date.now(),
    mounts: 0,
    session: null,
    placement: null,
    demo: null,
    log: [],
  });
  const note = (type, detail = {}) => {
    coach.log.push({type, at: Date.now(), ...detail});
    if (coach.log.length > 300) coach.log.shift();
  };

  // RStudio (GWT) handles shortcuts such as Ctrl+2 in a capture-phase listener, so
  // stopping propagation at the coach element is too late. This script runs before
  // GWT loads; a window capture listener registered now runs before GWT's and keeps
  // key events aimed at the coach away from RStudio. Default actions (typing) still happen.
  // Spike switch: localStorage.rsCoachNoKeyShield = '1' turns it off for an A/B test.
  let shield = true;
  try { shield = localStorage.getItem('rsCoachNoKeyShield') !== '1'; } catch (_error) { /* storage blocked */ }
  coach.keyShield = shield;
  coach.shieldedEvents = 0;
  if (shield) {
    for (const type of ['keydown', 'keypress', 'keyup', 'beforeinput', 'input', 'paste', 'copy', 'cut', 'compositionstart', 'compositionupdate', 'compositionend']) {
      window.addEventListener(type, event => {
        const host = document.getElementById('rs-coach-host');
        if (host && event.composedPath().includes(host)) {
          event.stopImmediatePropagation();
          coach.shieldedEvents += 1;
        }
      }, true);
    }
  }

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const shown = el => (el && el.isConnected && el.offsetParent && el.getBoundingClientRect().width > 0 ? el : null);
  const byId = id => shown(document.getElementById(id));
  let paceMs = 700; // pause between visible demo actions, so a learner can follow them
  try { paceMs = Number(localStorage.getItem('rsCoachPaceMs')) || paceMs; } catch (_error) { /* storage blocked */ }

  // RStudio Server 2026.11.0+203 anchors. Presentation and demo driving only.
  const ide = {
    sidebar: () => byId('rstudio_Sidebar_pane'),
    console: () => byId('rstudio_Console_pane') || byId('rstudio_workbench_panel_console'),
    consoleText: () => document.getElementById('rstudio_console_output')?.textContent || '',
    source: () => byId('rstudio_Source_pane'),
    files: () => byId('rstudio_workbench_panel_files'),
    filesTab: () => byId('rstudio_workbench_tab_files'),
    plots: () => byId('rstudio_workbench_panel_plots'),
    environment: () => byId('rstudio_workbench_panel_environment'),
    runButton: () => [...document.querySelectorAll('#rstudio_Source_pane button')]
      .find(b => shown(b) && /^Run\b/.test(b.getAttribute('title') || '')),
    sourceTab: name => [...document.querySelectorAll('#rstudio_Source_pane [role="tab"]')]
      .find(t => shown(t) && t.textContent.trim().replace(/\*$/, '') === name),
    fileLink: name => {
      const panel = ide.files();
      return panel && [...panel.querySelectorAll('*')].find(el => el.childElementCount === 0 && el.textContent.trim() === name && shown(el));
    },
    activeEditor: () => {
      const el = [...document.querySelectorAll('#rstudio_Source_pane .ace_editor')].find(e => shown(e) && e.env && e.env.editor);
      return el ? el.env.editor : null;
    },
    plotImage: () => {
      for (const frame of document.querySelectorAll('#rstudio_workbench_panel_plots iframe')) {
        try {
          const img = frame.contentDocument && frame.contentDocument.querySelector('img');
          if (img) return img;
        } catch (_error) { /* not same-origin */ }
      }
      return null;
    },
  };

  // GWT toolbar buttons and links act on mousedown/mouseup, so a bare .click() is ignored.
  function press(el) {
    const r = el.getBoundingClientRect();
    const init = {bubbles: true, cancelable: true, composed: true, view: window, button: 0, buttons: 1,
      clientX: r.left + Math.min(8, r.width / 2), clientY: r.top + r.height / 2, pointerId: 1, pointerType: 'mouse', isPrimary: true};
    for (const type of ['pointerover', 'mouseover', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      el.dispatchEvent(type.startsWith('pointer') ? new PointerEvent(type, init) : new MouseEvent(type, init));
    }
  }

  // ---------- highlight overlay (its own layer, above every RStudio pane) ----------
  const overlay = {host: null, box: null, target: null, until: 0, frame: 0};
  function ensureOverlay() {
    if (overlay.host && overlay.host.isConnected) return;
    overlay.host = document.createElement('div');
    overlay.host.id = 'rs-coach-overlay';
    const root = overlay.host.attachShadow({mode: 'open'});
    root.innerHTML = `<style>
      :host { all: initial; }
      .box { position: fixed; z-index: 2147482999; pointer-events: none; box-sizing: border-box;
        border: 3px solid #bf8700; border-radius: 6px; box-shadow: 0 0 0 4px rgba(191,135,0,.25); }
    </style><div class="box" hidden></div>`;
    overlay.box = root.querySelector('.box');
    document.body.appendChild(overlay.host);
  }
  function highlight(el, ms = 2500) {
    ensureOverlay();
    overlay.target = el || null;
    overlay.until = Date.now() + ms;
    cancelAnimationFrame(overlay.frame);
    const tick = () => {
      const target = overlay.target;
      if (!target || !shown(target) || Date.now() > overlay.until) {
        overlay.box.hidden = true;
        overlay.target = null;
        return;
      }
      const r = target.getBoundingClientRect();
      Object.assign(overlay.box.style, {left: `${r.left - 3}px`, top: `${r.top - 3}px`, width: `${r.width + 6}px`, height: `${r.height + 6}px`});
      overlay.box.hidden = false;
      overlay.frame = requestAnimationFrame(tick);
    };
    tick();
    return !overlay.box.hidden;
  }
  const clearHighlight = () => highlight(null, 0);

  // ---------- panel ----------
  const css = `
    :host { all: initial; }
    :host([data-placement="docked"]) { position: absolute; inset: 0; z-index: 1000; } /* above the pane's own maximize/close icons */
    .panel { position: fixed; right: 16px; bottom: 16px; z-index: 2147483000; width: 340px;
      max-height: calc(100vh - 32px); display: flex; flex-direction: column; box-sizing: border-box;
      font: 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1f2328;
      background: #fff; border: 1px solid #d0d7de; border-radius: 10px;
      box-shadow: 0 8px 24px rgba(31,35,40,.18); overflow: hidden; }
    :host([data-placement="docked"]) .panel { position: absolute; inset: 0; width: auto; max-height: none;
      border-radius: 0; box-shadow: none; border-width: 0 0 0 1px; }
    .panel.collapsed .body { display: none; }
    header { display: flex; align-items: center; gap: 8px; padding: 8px 12px;
      background: #0b5cad; color: #fff; cursor: move; user-select: none; }
    :host([data-placement="docked"]) header { cursor: default; }
    :host([data-placement="docked"]) .collapse { display: none; }
    header strong { flex: 1; font-size: 13px; }
    header .mode { font-size: 11px; background: rgba(255,255,255,.2); padding: 1px 7px; border-radius: 8px; }
    header button { all: unset; cursor: pointer; padding: 0 6px; font-size: 16px; line-height: 1; }
    .body { padding: 12px; overflow: auto; display: grid; gap: 12px; align-content: start; flex: 1; }
    .content { display: grid; gap: 12px; }
    h2 { margin: 0; font-size: 15px; }
    h3 { margin: 0; font-size: 13px; }
    p { margin: 0; }
    .muted { color: #57606a; font-size: 12px; }
    code { font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; background: #f6f8fa; padding: 0 3px; border-radius: 4px; }
    ol { margin: 0; padding-left: 20px; display: grid; gap: 4px; }
    li.done { color: #1a7f37; }
    li.done::marker { content: "✓  "; }
    li.active { font-weight: 600; color: #0b5cad; }
    li.active::marker { content: "▶  "; }
    li.failed { color: #cf222e; font-weight: 600; }
    li.failed::marker { content: "✕  "; }
    label { display: grid; gap: 4px; font-weight: 600; }
    textarea { font: inherit; font-weight: 400; min-height: 54px; resize: vertical; padding: 6px; border: 1px solid #d0d7de; border-radius: 6px; }
    .row { display: flex; flex-wrap: wrap; gap: 6px; }
    .row button { font: inherit; padding: 4px 10px; border-radius: 6px; border: 1px solid #d0d7de; background: #f6f8fa; cursor: pointer; }
    .row button.primary { background: #1a7f37; color: #fff; border-color: #1a7f37; }
    .row button:disabled { opacity: .55; cursor: default; }
    .card { border: 1px solid #d0d7de; border-radius: 8px; padding: 10px; display: grid; gap: 8px; background: #f6f8fa; }
    .card code { background: #fff; }
    .phase { font-size: 12px; color: #57606a; font-style: italic; }
    .phase:empty, .explain:empty { display: none; }
    .explain { display: grid; gap: 6px; }
    .explain strong { color: #0b5cad; }
    .error { color: #cf222e; }
    .status { font-size: 12px; color: #57606a; min-height: 1.4em; }
    .ended { font-weight: 600; }
    [hidden] { display: none !important; }
  `;

  function mount() {
    if (coach.host) return;
    coach.mounts += 1;
    const host = document.createElement('div');
    host.id = 'rs-coach-host';
    coach.host = host;
    const root = host.attachShadow({mode: 'open'});
    root.innerHTML = `
      <style>${css}</style>
      <section class="panel" role="complementary" aria-label="Coach">
        <header>
          <strong>Coach</strong><span class="mode">…</span>
          <button class="collapse" title="Collapse" aria-label="Collapse coach">–</button>
        </header>
        <div class="body">
          <div class="content"></div>
          <div class="status" aria-live="polite">Connecting to the coach service…</div>
        </div>
      </section>`;
    document.body.appendChild(host);
    place();

    const panel = root.querySelector('.panel');
    root.querySelector('.collapse').addEventListener('click', () => {
      panel.classList.toggle('collapsed');
      note('collapse', {collapsed: panel.classList.contains('collapsed')});
    });
    // Drag by the header (floating only) so the learner can move the panel off a pane.
    root.querySelector('header').addEventListener('pointerdown', event => {
      if (host.dataset.placement !== 'floating' || event.target.closest('button')) return;
      const start = {x: event.clientX, y: event.clientY, rect: panel.getBoundingClientRect()};
      const move = e => Object.assign(panel.style, {
        left: `${Math.max(0, start.rect.left + e.clientX - start.x)}px`,
        top: `${Math.max(0, start.rect.top + e.clientY - start.y)}px`,
        right: 'auto', bottom: 'auto',
      });
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });

    const status = text => { root.querySelector('.status').textContent = text; };
    loadSession()
      .then(async session => {
        root.querySelector('.mode').textContent = session.mode === 'demonstration' ? 'Demonstration' : 'Guided';
        status(`Run ${session.run_id} · ${session.title}`);
        if (session.mode === 'demonstration') {
          const res = await fetch('/coach/api/demo', {cache: 'no-store'});
          if (!res.ok) throw new Error(`demo manifest ${res.status}`);
          renderDemo(root, session, await res.json(), status);
        } else {
          renderGuided(root, session, status);
        }
      })
      .catch(error => {
        status('The coach service is unavailable. RStudio still works.');
        note('session_failed', {error: String(error)});
      });
    note('mounted');
  }

  function loadSession() {
    if (coach.session) return Promise.resolve(coach.session);
    return fetch('/coach/api/session', {cache: 'no-store'})
      .then(res => { if (!res.ok) throw new Error(`session ${res.status}`); return res.json(); })
      .then(session => { coach.session = session; note('session', session); return session; });
  }

  // Dock into RStudio's sidebar when it is shown; float otherwise. Hiding the sidebar
  // removes that pane's DOM, the coach included; re-attach the same element (not a new
  // mount) so typed text and a running demonstration survive.
  function place() {
    const host = coach.host;
    if (!host) return;
    const sidebar = ide.sidebar();
    const want = sidebar ? 'docked' : 'floating';
    const parent = sidebar || document.body;
    if (host.parentElement !== parent) parent.appendChild(host);
    if (host.dataset.placement !== want) {
      host.dataset.placement = want;
      coach.placement = want;
      if (want === 'docked') {
        // Drag position and collapse only apply while floating.
        const panel = host.shadowRoot.querySelector('.panel');
        panel.classList.remove('collapsed');
        for (const side of ['left', 'top', 'right', 'bottom']) panel.style[side] = '';
      }
      note('placement', {placement: want});
    }
  }

  // ---------- Guided (regional-revenue) ----------
  function renderGuided(root, session, status) {
    const content = root.querySelector('.content');
    content.innerHTML = `
      <ol class="goals">
        <li data-goal="project">Open the ${escapeHtml(session.title)} project</li>
        <li data-goal="script">Open <code>analysis.R</code> in the Source pane</li>
        <li data-goal="console">Read <code>data/orders.csv</code> in the Console</li>
      </ol>
      <label>Your conclusion
        <textarea class="answer" placeholder="Which region leads, and why do the exclusions matter?"></textarea>
      </label>
      <div class="row">
        <button class="primary check">Check work</button>
        <button class="show-console">Show me the Console</button>
        <button class="stop">Stop</button>
      </div>`;
    const $ = sel => content.querySelector(sel);
    $('.check').addEventListener('click', async () => {
      note('check_requested');
      status('Checking…');
      try {
        const res = await fetch('/coach/api/check', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({answer: $('.answer').value})});
        const body = await res.json();
        status(body.message);
        note('check_response', {status: body.status});
      } catch (error) {
        status('The coach service did not answer.');
        note('check_failed', {error: String(error)});
      }
    });
    $('.show-console').addEventListener('click', () => {
      // Instruction first; the highlight attaches if the pane exists.
      status('The Console is where R runs your code. Type read.csv("data/orders.csv") there.');
      const attached = highlight(ide.console(), 6000);
      note('highlight', {target: 'console', attached});
    });
    $('.stop').addEventListener('click', () => {
      note('stop');
      clearHighlight();
      content.replaceChildren(Object.assign(document.createElement('p'), {className: 'ended', textContent: 'This practice run has ended. RStudio stays open, but the coach is no longer tracking it.'}));
    });
    const observe = () => {
      const tabs = [...document.querySelectorAll('[role="tab"]')].map(el => el.textContent.trim());
      const done = {
        project: document.title.includes(session.scenario),
        script: tabs.some(t => t.startsWith('analysis.R')),
      };
      for (const li of content.querySelectorAll('li[data-goal]')) if (done[li.dataset.goal]) li.classList.add('done');
    };
    onIdeChange(observe);
    observe();
  }

  // ---------- Demonstration ----------
  class DemoStopped extends Error {}

  function renderDemo(root, session, manifest, status) {
    const content = root.querySelector('.content');
    const steps = manifest.steps;
    content.innerHTML = `
      <h2></h2>
      <p class="intro"></p>
      <p class="muted source"></p>
      <ol class="steps"></ol>
      <section class="card" hidden>
        <h3></h3>
        <p class="phase" aria-live="polite"></p>
        <div class="explain" aria-live="polite"></div>
      </section>
      <div class="row">
        <button class="primary go">Start demonstration</button>
        <button class="restart" hidden>Start over</button>
        <button class="stop">Stop</button>
      </div>
      <p class="muted watch" hidden>While the demonstration is running, watch RStudio rather than typing in it.</p>`;
    const $ = sel => content.querySelector(sel);
    $('h2').textContent = manifest.title;
    $('.intro').textContent = manifest.intro;
    $('.source').textContent = manifest.source;
    $('.steps').innerHTML = steps.map((s, i) => `<li data-step="${i}">${escapeHtml(s.title)}</li>`).join('');
    const card = $('.card');
    const phaseEl = $('.phase');
    const explainEl = $('.explain');
    const go = $('.go');
    const restart = $('.restart');

    const storeKey = `rsCoachDemo:${session.run_id}`;
    const demo = (coach.demo = {state: 'idle', index: -1, completed: [], values: {}, failure: null, stopped: false, actions: 0});
    try {
      const saved = JSON.parse(sessionStorage.getItem(storeKey) || 'null');
      if (saved && Array.isArray(saved.completed) && saved.completed.length) {
        Object.assign(demo, {completed: saved.completed, values: saved.values || {}, index: Math.max(...saved.completed), state: 'waiting'});
        note('demo_restored', {completed: demo.completed.length});
      }
    } catch (_error) { /* storage blocked */ }
    const persist = () => {
      try { sessionStorage.setItem(storeKey, JSON.stringify({completed: demo.completed, values: demo.values})); } catch (_error) { /* storage blocked */ }
    };
    const setPhase = text => { phaseEl.textContent = text; };
    const pause = async () => { await sleep(paceMs); if (demo.stopped) throw new DemoStopped(); };

    function nextIndex() {
      if (demo.state === 'failed') return demo.index;
      const i = demo.index + 1;
      return i < steps.length ? i : null;
    }
    function renderControls() {
      for (const li of content.querySelectorAll('li[data-step]')) {
        const i = Number(li.dataset.step);
        li.className = demo.state === 'failed' && i === demo.index ? 'failed'
          : demo.state === 'running' && i === demo.index ? 'active'
          : demo.completed.includes(i) ? 'done' : '';
      }
      const next = nextIndex();
      go.disabled = demo.state === 'running' || next === null;
      go.textContent = demo.state === 'idle' ? 'Start demonstration'
        : demo.state === 'running' ? 'Running…'
        : demo.state === 'failed' ? 'Try this step again'
        : next === null ? 'Demonstration complete'
        : `Next: step ${next + 1}`;
      restart.hidden = !(demo.state === 'failed' || (demo.state !== 'running' && demo.completed.length));
      $('.watch').hidden = demo.state !== 'running';
    }

    go.addEventListener('click', () => {
      const i = nextIndex();
      if (i !== null && demo.state !== 'running') runStep(i);
    });
    restart.addEventListener('click', () => {
      if (demo.state === 'running') return;
      Object.assign(demo, {completed: [], values: {}, index: -1, failure: null});
      persist();
      runStep(0);
    });
    $('.stop').addEventListener('click', () => {
      demo.stopped = true;
      demo.state = 'stopped';
      clearHighlight();
      try { sessionStorage.removeItem(storeKey); } catch (_error) { /* storage blocked */ }
      note('stop');
      content.replaceChildren(Object.assign(document.createElement('p'), {className: 'ended', textContent: 'This demonstration has ended. RStudio stays open and keeps what the demonstration ran.'}));
    });

    async function runStep(i) {
      const step = steps[i];
      Object.assign(demo, {index: i, state: 'running', failure: null, stopped: false});
      card.hidden = false;
      $('.card h3').textContent = `Step ${i + 1} of ${steps.length}: ${step.title}`;
      explainEl.replaceChildren();
      renderControls();
      note('demo_step_started', {step: step.id});
      try {
        await openScript(manifest.script);
        for (const run of step.runs) await doRun(run, manifest.script);
        // Every result this step explains is now on screen and matches the reference run.
        setPhase('');
        explainEl.innerHTML = format(step.explain, demo.values);
        demo.completed = [...new Set([...demo.completed, i])];
        demo.state = 'waiting';
        persist();
        note('demo_step_done', {step: step.id, values: {...demo.values}});
        if (i === steps.length - 1) status(`Demonstration complete · ${session.title}`);
      } catch (error) {
        if (error instanceof DemoStopped || demo.stopped) return;
        demo.state = 'failed';
        demo.failure = error.message;
        clearHighlight();
        setPhase('');
        explainEl.innerHTML = `<p class="error">The demonstration stopped at this step. ${escapeHtml(error.message)}</p>`;
        note('demo_step_failed', {step: step.id, reason: error.message});
      }
      renderControls();
    }

    async function openScript(script) {
      const isOpen = () => {
        const tab = ide.sourceTab(script);
        return tab && tab.getAttribute('aria-selected') === 'true' && ide.activeEditor() ? ide.activeEditor() : null;
      };
      if (isOpen()) return;
      // RStudio re-renders the Files list and tab strip when files change, so look the
      // target up again after each pause and retry if the click landed on a stale element.
      const target = () => ide.sourceTab(script) || ide.fileLink(script);
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        if (ide.sourceTab(script)) {
          setPhase(`Switching to ${script} in the Source pane`);
        } else {
          setPhase(`Opening ${script} from the Files pane`);
          if (!ide.files() && ide.filesTab()) { press(ide.filesTab()); await sleep(400); }
        }
        if (!(await waitFor(target, 5000))) {
          throw new Error(`${script} is not listed in the Files pane. Show the project folder in Files, then try again.`);
        }
        highlight(target(), paceMs * 2);
        await pause();
        const el = target();
        if (!el) continue;
        press(el);
        demo.actions += 1;
        note('demo_action', {action: 'open_script', script, attempt});
        if (await waitFor(isOpen, 4000)) { await pause(); return; }
      }
      throw new Error(`${script} did not open in the Source pane.`);
    }

    async function doRun(run, script) {
      const editor = ide.activeEditor();
      const row = editor ? findRow(editor, run.code) : -1;
      if (row < 0) throw new Error(`${script} no longer contains the line ${run.code}. Start a new run to restore the demonstration script.`);
      setPhase(`Selecting line ${row + 1} of ${script}`);
      editor.selection.setRange({start: {row, column: 0}, end: {row, column: editor.session.getLine(row).length}});
      editor.scrollToLine(row, true, true, () => {});
      await pause();

      if (!ide.runButton()) throw new Error('The Run button in the Source pane is not visible.');
      setPhase('Pressing Run to send the line to the Console');
      highlight(ide.runButton(), paceMs * 2);
      await pause();
      const runButton = ide.runButton(); // look it up again: the toolbar may have re-rendered
      if (!runButton) throw new Error('The Run button in the Source pane disappeared.');
      const before = {echoes: countEchoes(ide.consoleText(), run.code), plot: ide.plotImage()?.src || null};
      press(runButton);
      demo.actions += 1;
      note('demo_action', {action: 'run', line: row + 1});

      setPhase(run.evidence === 'plot' ? 'Waiting for the chart to appear in the Plots pane' : 'Waiting for R to answer in the Console');
      const output = await waitForEvidence(run, before);
      for (const [name, pattern] of Object.entries(run.capture || {})) {
        // Read the value from what the Console shows. If RStudio wrapped the printout to
        // fit a narrow pane, the tokens already match the reference, so use its reading.
        const seen = (new RegExp(pattern).exec(normalise(output)) || [])[1] ?? run.expected_values[name];
        if (seen !== run.expected_values[name]) {
          throw new Error(`RStudio showed ${name} = ${seen}, but the reference run for this scenario gave ${run.expected_values[name]}.`);
        }
        demo.values[name] = seen;
      }
      const pane = run.evidence === 'plot' ? ide.plots() : run.show === 'environment' ? ide.environment() : ide.console();
      setPhase(run.evidence === 'plot' ? 'The chart is in the Plots pane'
        : run.show === 'environment' ? 'R stored the result, so it now appears in the Environment pane'
        : 'R printed the result in the Console');
      highlight(pane, paceMs * 2);
      await pause();
    }

    // Done only when RStudio shows the line ran, with the reference output, plus a newly
    // loaded chart for a plotting line. An R error stops the demonstration visibly.
    async function waitForEvidence(run, before) {
      const deadline = Date.now() + 20000;
      let matchedAt = 0;
      let seen = {echo: false, output: '', plot: false};
      for (;;) {
        if (demo.stopped) throw new DemoStopped();
        const text = ide.consoleText();
        if (countEchoes(text, run.code) > before.echoes) {
          const at = text.lastIndexOf(`> ${run.code}`);
          const end = text.indexOf('\n', at);
          const output = end < 0 ? '' : text.slice(end + 1);
          // RStudio puts its "Show Traceback / Rerun with Debug" links on the same line as the error.
          const error = /(?:^|\n|Rerun with Debug)\s*(Error\b[^\n]*)/.exec(output);
          if (error) throw new Error(`R reported: ${error[1].trim()}`);
          const img = ide.plotImage();
          const plotOk = run.evidence !== 'plot' || Boolean(img && img.src !== before.plot && img.complete && img.naturalWidth > 0);
          const outputOk = sameTokens(output, run.expected_output);
          seen = {echo: true, output, plot: plotOk};
          if (plotOk && outputOk) {
            matchedAt = matchedAt || Date.now();
            if (Date.now() - matchedAt >= 300) return output; // stable: no late error or extra output
          } else {
            matchedAt = 0;
          }
        }
        if (Date.now() > deadline) {
          if (!seen.echo) throw new Error('The Console never showed the line, so RStudio did not run it.');
          if (!seen.plot) throw new Error('No new chart appeared in the Plots pane.');
          throw new Error(`The Console showed "${normalise(seen.output).slice(0, 120)}" instead of the reference output "${normalise(run.expected_output).slice(0, 120)}".`);
        }
        await sleep(100);
      }
    }

    renderControls();
  }

  // ---------- helpers ----------
  function findRow(editor, code) {
    return editor.session.getDocument().getAllLines().findIndex(line => line.trimEnd() === code);
  }
  function countEchoes(text, code) {
    const needle = `> ${code}`;
    let count = 0;
    for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + needle.length)) count += 1;
    return count;
  }
  function normalise(text) { return text.split(/\s+/).filter(Boolean).join(' '); }
  function sameTokens(a, b) {
    const tokens = s => s.split(/\s+/).filter(Boolean).sort().join(' ');
    return tokens(a) === tokens(b);
  }
  async function waitFor(fn, ms) {
    const deadline = Date.now() + ms;
    for (;;) {
      const value = fn();
      if (value) return value;
      if (Date.now() > deadline) return null;
      await sleep(100);
    }
  }
  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  }
  // `code` becomes <code>; {name} becomes a value RStudio displayed in this run.
  function format(text, values) {
    return `<p>${escapeHtml(text)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\{(\w+)\}/g, (_m, name) => {
        if (!(name in values)) throw new Error(`The explanation needs ${name}, which RStudio has not shown yet.`);
        return `<strong>${escapeHtml(values[name])}</strong>`;
      })}</p>`;
  }

  const ideListeners = [];
  const onIdeChange = fn => ideListeners.push(fn);
  let pending = false;
  const changed = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      place();
      for (const fn of ideListeners) fn();
    });
  };

  // RStudio (GWT) builds its layout after load and can re-render panes; re-mount and re-place as needed.
  const ensure = () => {
    if (!document.body) return;
    if (!coach.host) mount();
    place();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensure); else ensure();
  new MutationObserver(ensure).observe(document.documentElement, {childList: true});
  const startObserving = () => new MutationObserver(changed).observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'aria-selected']});
  if (document.body) startObserving(); else document.addEventListener('DOMContentLoaded', startObserving);
  setInterval(ensure, 1000);
})();
