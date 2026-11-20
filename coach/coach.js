// Coach for RStudio Server. The gateway injects this into the IDE host page,
// before RStudio's own scripts load.
//
// The coach docks into RStudio's sidebar when that pane is shown and floats
// otherwise. A scenario with steps opens on a choice of three modes over the
// same steps and reference output:
// - Demonstration works RStudio the way a learner would: a visible pointer moves
//   to each control it clicks, and code is typed into the Source pane one key at
//   a time, then run with RStudio's Run button and saved. It waits until the
//   Console or Plots pane shows the result, checks it against the reference
//   output, and only then explains it, using the values RStudio displayed.
// - Guided gives one step at a time. The learner types and runs each line; the
//   coach ticks it once RStudio shows the reference result, and offers hints and
//   Show me (a one-line demonstration).
// - Solo lists every task; results are disclosed only when the learner checks.
// Choosing a mode, or Start over, starts the lesson afresh: its script goes back to the
// step headings, and the Console, Environment and Plots are emptied, so nothing from an
// earlier mode or lesson carries over.
// regional-revenue (no steps yet) has a Guided stub with a Check work button.
//
// Guided and Solo confirm lines from what RStudio shows, in the page, because
// these lessons hide nothing: their code and reference output are public. Work
// with a private answer belongs to a grader that runs saved files in a separate
// process.
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
    fresh: {count: 0, last: null}, // fresh starts done, and what the last one found
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
  const setting = (key, fallback) => {
    try { return Number(localStorage.getItem(key)) || fallback; } catch (_error) { return fallback; } // storage blocked
  };
  const paceMs = setting('rsCoachPaceMs', 1000); // pause after opening the script and between steps
  const leadMs = setting('rsCoachLeadMs', 700); // the spotlight arrives this long before the pointer moves
  const dwellMs = setting('rsCoachDwellMs', 2400); // how long Show me holds a result (Demonstration waits for the reader)
  const typeMs = setting('rsCoachTypeMs', 70); // average gap between keystrokes, as in ELK Guide's coach
  // How long Demonstration waits for the learner to read a text before moving on by itself: the
  // minimum for up to 60 characters, plus `readStepMs` each time the text doubles in length.
  const readMinMs = setting('rsCoachReadMinMs', 5000);
  const readStepMs = setting('rsCoachReadStepMs', 3000);
  const readMs = text => Math.round(readMinMs + readStepMs * Math.log2(Math.max(1, text.replace(/`/g, '').trim().length / 60)));

  // RStudio Server 2026.11.0+203 anchors. Presentation and demo driving only.
  const ide = {
    sidebar: () => byId('rstudio_Sidebar_pane'),
    console: () => byId('rstudio_Console_pane') || byId('rstudio_workbench_panel_console'),
    consoleText: () => document.getElementById('rstudio_console_output')?.textContent || '',
    source: () => byId('rstudio_Source_pane'),
    consoleClear: () => byId('rstudio_tb_consoleclear'),
    files: () => byId('rstudio_workbench_panel_files'),
    filesTab: () => byId('rstudio_workbench_tab_files'),
    filesHome: () => [...document.querySelectorAll('#rstudio_workbench_panel_files button[title="Go to project directory"]')].find(shown),
    plots: () => byId('rstudio_workbench_panel_plots'),
    plotsTab: () => byId('rstudio_workbench_tab_plots'),
    environment: () => byId('rstudio_workbench_panel_environment'),
    // RStudio removes this label once the global environment holds an object (shown or not).
    environmentEmpty: () => [...(document.getElementById('rstudio_workbench_panel_environment')?.querySelectorAll('*') || [])]
      .some(el => el.childElementCount === 0 && el.textContent.trim() === 'Environment is empty'),
    chartShown: () => {
      const img = ide.plotImage();
      return Boolean(img && img.naturalWidth > 0 && img.ownerDocument.defaultView.getComputedStyle(img).display !== 'none');
    },
    runButton: () => ide.sourceButton(/^Run\b/),
    saveButton: () => ide.sourceButton(/^Save current document\b/),
    sourceButton: title => [...document.querySelectorAll('#rstudio_Source_pane button')]
      .find(b => shown(b) && title.test(b.getAttribute('title') || '')),
    sourceTab: name => [...document.querySelectorAll('#rstudio_Source_pane [role="tab"]')]
      .find(t => shown(t) && t.textContent.trim().replace(/\*$/, '') === name),
    unsaved: name => (ide.sourceTab(name)?.innerText || '').includes('*'),
    // The editor for `name`, once its tab is the one shown in the Source pane.
    scriptEditor: name => (ide.sourceTab(name)?.getAttribute('aria-selected') === 'true' ? ide.activeEditor() : null),
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

  const centre = el => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {x: r.left + r.width / 2, y: r.top + r.height / 2};
  };

  // GWT toolbar buttons and links act on mousedown/mouseup, so a bare .click() is ignored.
  // The events carry the coordinates of the coach's pointer, which is where the learner sees the click.
  function press(el, at) {
    const r = el.getBoundingClientRect();
    const inside = at && at.x >= r.left && at.x <= r.right && at.y >= r.top && at.y <= r.bottom;
    const point = inside ? at : centre(el);
    const init = {bubbles: true, cancelable: true, composed: true, view: window, button: 0, buttons: 1,
      clientX: point.x, clientY: point.y, pointerId: 1, pointerType: 'mouse', isPrimary: true};
    for (const type of ['pointerover', 'mouseover', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      el.dispatchEvent(type.startsWith('pointer') ? new PointerEvent(type, init) : new MouseEvent(type, init));
    }
  }

  // ---------- overlay (its own layer, above every RStudio pane) ----------
  // While the coach works RStudio, the IDE is dimmed except for a spotlight on what it acts on,
  // and the coach panel stays bright so its narration can be read. A result the coach explains
  // keeps an evidence ring (no dimming) while the learner reads. Both rings arrive the way ELK
  // Guide's do: wide, closing in on their target, then one pulse.
  const overlay = {host: null, box: null, dim: null, spot: null, target: null, until: 0, frame: 0};
  const spot = {find: null, box: null, fresh: false, frame: 0};
  // The coach's pointer during a demonstration. Its tip is at the element's origin.
  const pointer = {el: null, x: null, y: null};
  function ensureOverlay() {
    if (overlay.host && overlay.host.isConnected) return;
    overlay.host = document.createElement('div');
    overlay.host.id = 'rs-coach-overlay';
    const root = overlay.host.attachShadow({mode: 'open'});
    root.innerHTML = `<style>
      :host { all: initial; }
      .dim { position: fixed; inset: 0; z-index: 2147482990; pointer-events: none; background: rgba(16,24,32,.5);
        opacity: 0; transition: opacity .35s ease-out; }
      .dim.on { opacity: 1; }
      .box, .spot { --ring: #ffb000; --ring-edge: #b86e00; --ring-glow: #ffb00066; position: fixed; box-sizing: border-box;
        border-radius: 7px; pointer-events: none; }
      .box { z-index: 2147482995; } /* no fill: it would tint a chart under the ring */
      .spot { z-index: 2147482998; }
      .box::before, .box::after, .spot::before, .spot::after { content: ""; position: absolute; inset: 0; box-sizing: border-box; border-radius: inherit; }
      .box::before, .spot::before { border: 3px solid var(--ring); box-shadow: 0 0 0 1px var(--ring-edge), inset 0 0 0 1px #fffc, 0 0 16px 3px var(--ring-glow); }
      .entering { animation: ring-flash .6s .34s ease-out both; }
      .entering::before { animation: ring-close .7s cubic-bezier(.34,1.4,.64,1) both; }
      .entering::after { border: 3px solid var(--ring); box-shadow: 0 0 12px var(--ring-glow); animation: ring-pulse .8s .4s cubic-bezier(.2,.6,.3,1) both; }
      @keyframes ring-close { from { inset: -28px; border-radius: 18px; opacity: 0; box-shadow: 0 0 0 1px var(--ring-edge), inset 0 0 0 1px #fffc, 0 0 30px 10px var(--ring-glow); } 18% { opacity: 1; } }
      @keyframes ring-flash { from { background-color: #ffb00000; } 30% { background-color: #ffb00059; } }
      @keyframes ring-pulse { from { inset: 0; opacity: 0; } 6% { opacity: 1; } 45% { opacity: .6; } to { inset: -20px; border-radius: 20px; opacity: 0; } }
      @keyframes ring-fade { from { opacity: 0; } }
      .pointer { position: fixed; left: 0; top: 0; z-index: 2147483647; pointer-events: none;
        opacity: 0; transition: opacity .18s; will-change: transform; }
      .pointer.visible { opacity: 1; }
      .pointer svg { position: absolute; left: -1px; top: -1px; display: block; overflow: visible;
        transform-origin: 1px 1px; transition: transform .09s; filter: drop-shadow(0 2px 2px rgba(0,0,0,.35)); }
      .pointer.down svg { transform: scale(.82); }
      .ring { position: absolute; left: -14px; top: -14px; width: 28px; height: 28px; box-sizing: border-box;
        border: 2px solid #bf8700; border-radius: 50%; opacity: 0; }
      .pointer.clicked .ring { animation: ring .5s ease-out; }
      @keyframes ring { from { opacity: 1; transform: scale(.3); } to { opacity: 0; transform: scale(1.7); } }
      @media (prefers-reduced-motion: reduce) {
        .dim, .pointer, .pointer svg { transition: none; } .pointer.clicked .ring { animation: none; }
        .entering { animation: ring-fade .25s ease-out both !important; } .entering::before { animation: none !important; }
        .entering::after { animation: none !important; border: 0; }
      }
    </style><div class="dim"></div><div class="box" hidden></div><div class="spot" hidden></div>
    <div class="pointer" aria-hidden="true"><span class="ring"></span>
      <svg width="22" height="30" viewBox="0 0 22 30"><path d="M1 1v22l5.6-5.4 4 9.4 3.7-1.6-4-9.2H18z"
        fill="#bf8700" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg></div>`;
    overlay.box = root.querySelector('.box');
    overlay.dim = root.querySelector('.dim');
    overlay.spot = root.querySelector('.spot');
    pointer.el = root.querySelector('.pointer');
    for (const ring of [overlay.box, overlay.spot]) {
      ring.addEventListener('animationend', event => {
        if (event.animationName === 'ring-pulse' || event.animationName === 'ring-fade') ring.classList.remove('entering');
      });
    }
    if (pointer.x !== null) placePointer(pointer.x, pointer.y);
    document.body.appendChild(overlay.host);
  }
  function placePointer(x, y) {
    pointer.x = x;
    pointer.y = y;
    pointer.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }
  function showPointer(on) {
    ensureOverlay();
    pointer.el.classList.toggle('visible', on);
  }
  // Put the pointer where the learner just clicked, unless it is already on screen.
  function pointerFrom(el) {
    ensureOverlay();
    const at = centre(el);
    if (at && !pointer.el.classList.contains('visible')) placePointer(at.x, at.y);
  }
  const reducedMotion = () => {
    try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_error) { return false; }
  };
  // rAF stalls in a hidden tab; the timeout keeps a glide (which is timed, not frame-counted) finishing.
  const nextFrame = () => new Promise(resolve => {
    const timer = setTimeout(() => { cancelAnimationFrame(frame); resolve(); }, 100);
    const frame = requestAnimationFrame(() => { clearTimeout(timer); resolve(); });
  });
  // Glide along a slight curve, easing in and out, the way a hand moves a mouse. `point()` is read
  // every frame, so the pointer still lands on a target that moves while it travels (a pane resizing).
  async function glide(point, check) {
    let to = point();
    if (!to) return false;
    showPointer(true);
    if (pointer.x === null) placePointer(to.x + 120, to.y + 80);
    const from = {x: pointer.x, y: pointer.y};
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const duration = reducedMotion() || distance < 2 ? 0 : Math.min(1000, 260 + distance * 0.6);
    const bend = (Math.random() < 0.5 ? -1 : 1) * Math.min(48, distance * 0.14);
    const started = performance.now();
    for (;;) {
      to = point() || to;
      const t = duration ? Math.min(1, (performance.now() - started) / duration) : 1;
      const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.hypot(dx, dy) || 1;
      const cx = from.x + dx / 2 - (dy / length) * bend;
      const cy = from.y + dy / 2 + (dx / length) * bend;
      const u = 1 - e;
      placePointer(u * u * from.x + 2 * u * e * cx + e * e * to.x, u * u * from.y + 2 * u * e * cy + e * e * to.y);
      if (t >= 1) return true;
      await nextFrame();
      check();
    }
  }
  function pointerClickEffect() {
    const el = pointer.el;
    el.classList.remove('clicked');
    void el.offsetWidth; // restart the ring animation
    el.classList.add('clicked', 'down');
    setTimeout(() => el.classList.remove('down'), 110);
  }
  // A target is an element, or a function returning one or a rectangle ({left, top, right, bottom}).
  function targetRect(target) {
    const found = typeof target === 'function' ? target() : target;
    if (!found) return null;
    if (found instanceof Element) return shown(found) ? found.getBoundingClientRect() : null;
    return found;
  }
  const sameBox = (a, b) => Boolean(a && b) && ['left', 'top', 'width', 'height'].every(side => Math.abs(a[side] - b[side]) < 2);
  function placeRing(ring, r, pad, arriving) {
    const box = {left: r.left - pad, top: r.top - pad, width: r.right - r.left + 2 * pad, height: r.bottom - r.top + 2 * pad};
    Object.assign(ring.style, {left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px`});
    ring.hidden = false;
    if (arriving) {
      ring.classList.remove('entering');
      void ring.offsetWidth; // restart the entrance
      ring.classList.add('entering');
    }
    return box;
  }

  // Dim RStudio except `target` and the coach panel, with a ring on `target`. The spotlight
  // follows its target every frame (a line growing as it is typed, a pane scrolling); a new
  // target replays the ring's entrance. null lifts the dimming.
  function spotlight(target) {
    ensureOverlay();
    cancelAnimationFrame(spot.frame);
    spot.find = target || null;
    spot.fresh = true;
    if (!target) {
      overlay.dim.classList.remove('on');
      overlay.spot.hidden = true;
      spot.box = null;
      return;
    }
    const tick = () => {
      if (!spot.find) return;
      const r = targetRect(spot.find);
      if (r) {
        const pad = 6;
        const next = {left: r.left - pad, top: r.top - pad, width: r.right - r.left + 2 * pad, height: r.bottom - r.top + 2 * pad};
        const arriving = spot.fresh && (overlay.spot.hidden || !sameBox(next, spot.box));
        spot.box = placeRing(overlay.spot, r, pad, arriving);
        spot.fresh = false;
        overlay.dim.style.clipPath = dimPath(spot.box);
        overlay.dim.classList.add('on');
      }
      spot.frame = requestAnimationFrame(tick);
    };
    tick();
  }
  // The dimming covers the window except two holes: the spotlight (rounded) and the coach panel.
  function dimPath(b) {
    const w = innerWidth;
    const h = innerHeight;
    const k = Math.min(7, b.width / 2, b.height / 2);
    const x = b.left;
    const y = b.top;
    const x2 = b.left + b.width;
    const y2 = b.top + b.height;
    let d = `M0 0H${w}V${h}H0Z M${x + k} ${y}H${x2 - k}A${k} ${k} 0 0 1 ${x2} ${y + k}V${y2 - k}A${k} ${k} 0 0 1 ${x2 - k} ${y2}H${x + k}A${k} ${k} 0 0 1 ${x} ${y2 - k}V${y + k}A${k} ${k} 0 0 1 ${x + k} ${y}Z`;
    const panel = coach.host?.shadowRoot?.querySelector('.panel')?.getBoundingClientRect();
    if (panel && panel.width) d += ` M${panel.left} ${panel.top}H${panel.right}V${panel.bottom}H${panel.left}Z`;
    return `path(evenodd, "${d.replace(/\d+\.\d+/g, n => Number(n).toFixed(1))}")`;
  }

  // An evidence ring without dimming, on `target` for `ms` (Infinity: until cleared).
  function highlight(target, ms = 2500) {
    ensureOverlay();
    const arriving = target !== overlay.target || overlay.box.hidden;
    overlay.target = target || null;
    overlay.until = Date.now() + ms;
    cancelAnimationFrame(overlay.frame);
    let first = arriving;
    const tick = () => {
      const r = overlay.target && Date.now() <= overlay.until ? targetRect(overlay.target) : null;
      if (!r) {
        overlay.box.hidden = true;
        overlay.box.classList.remove('entering');
        if (!overlay.target || Date.now() > overlay.until) { overlay.target = null; return; }
      } else {
        placeRing(overlay.box, r, 3, first);
        first = false;
      }
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
    .content, .overview { display: grid; gap: 12px; }
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
    .phase { font-size: 13px; color: #1f2328; background: #fff8e1; border-left: 3px solid #ffb000;
      padding: 6px 8px; border-radius: 4px; }
    .phase.new { animation: phase-in .35s ease-out; }
    @keyframes phase-in { from { opacity: 0; transform: translateY(3px); } }
    @media (prefers-reduced-motion: reduce) { .phase.new { animation: none; } }
    .phase:empty, .explain:empty { display: none; }
    /* ELK Guide's countdown bar: it fills while the learner reads, and sweeps while the coach acts. */
    .timer { height: 5px; border-radius: 3px; background: #d6e4f2; overflow: hidden; }
    .timer span { display: block; height: 100%; width: 0; background: #0b5cad; border-radius: 3px; }
    .timer.working { background: #f3e3b8; }
    .timer.working span { width: 34% !important; background: #d98c00; animation: timer-sweep 1.25s cubic-bezier(.55,0,.45,1) infinite; }
    @keyframes timer-sweep { from { transform: translateX(-115%); } to { transform: translateX(310%); } }
    @media (prefers-reduced-motion: reduce) {
      .timer.working span { animation: none; transform: none; width: 100% !important; opacity: .55; }
      .timer span { transition: none !important; }
    }
    .explain { display: grid; gap: 6px; }
    .explain strong { color: #0b5cad; }
    .error { color: #cf222e; }
    .status { font-size: 12px; color: #57606a; min-height: 1.4em; }
    .ended { font-weight: 600; }
    .pick { display: grid; gap: 8px; }
    .pick-label { font-weight: 600; font-size: 14px; }
    .mode-card { all: unset; box-sizing: border-box; display: grid; grid-template-columns: 26px 1fr; gap: 2px 8px;
      padding: 10px 12px; border: 1px solid #d0d7de; border-radius: 8px; background: #fff; cursor: pointer; }
    .mode-card:hover { border-color: #0b5cad; background: #f3f8fe; }
    .mode-card:focus-visible { outline: 2px solid #0b5cad; outline-offset: 2px; }
    .mode-card .icon { grid-row: span 2; align-self: center; text-align: center; font-size: 18px; color: #0b5cad; }
    .mode-card strong { font-size: 14px; color: #0b5cad; }
    .mode-card .what { color: #57606a; font-size: 12px; }
    .lesson-card { all: unset; box-sizing: border-box; display: grid; grid-template-columns: 16px 1fr; gap: 0 8px; align-items: center;
      padding: 6px 10px; border: 1px solid #d0d7de; border-radius: 8px; background: #fff; cursor: pointer; }
    .lesson-card:hover { border-color: #0b5cad; }
    .lesson-card:focus-visible { outline: 2px solid #0b5cad; outline-offset: 2px; }
    .lesson-card[aria-checked="true"] { border-color: #0b5cad; background: #f3f8fe; }
    .lesson-card .dot { grid-row: span 2; width: 12px; height: 12px; box-sizing: border-box; border: 2px solid #8c959f; border-radius: 50%; }
    .lesson-card[aria-checked="true"] .dot { border: 4px solid #0b5cad; }
    .lesson-card strong { font-size: 13px; }
    .lesson-card .what { grid-column: 2; color: #57606a; font-size: 12px; }
    .row button.switch { margin-left: auto; background: none; border-color: transparent; color: #0b5cad; }
    .tasks { padding-left: 18px; }
    .hints { display: grid; gap: 4px; }
    .hint-text { font-size: 12px; }
    .feedback { color: #9a6700; }
    .feedback:empty, .hints:empty { display: none; }
    .stats { margin: 0; padding-left: 18px; display: grid; gap: 2px; }
    .solo-steps { gap: 8px; }
    .solo-steps .tasks { margin-top: 2px; font-weight: 400; }
    li.missing { color: #9a6700; }
    li.missing::marker { content: "○  "; }
    button.link { all: unset; cursor: pointer; color: #0b5cad; font-size: 12px; text-decoration: underline; }
    details summary { cursor: pointer; font-weight: 600; }
    h4 { margin: 8px 0 2px; font-size: 12px; }
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
        if (!session.lessons) { // no steps yet: the regional-revenue Guided stub
          status(`Run ${session.run_id} · ${session.title}`);
          root.querySelector('.mode').textContent = 'Guided';
          renderGuidedStub(root, session, status);
          return;
        }
        const res = await fetch('/coach/api/steps', {cache: 'no-store'});
        if (!res.ok) throw new Error(`steps ${res.status}`);
        startLessons(root, session, (await res.json()).lessons, status);
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

  // ---------- Guided stub (regional-revenue: no steps yet, grading not built) ----------
  function renderGuidedStub(root, session, status) {
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

  // ---------- Lessons: one set of steps, three modes ----------
  // A mode changes who works RStudio and when results are disclosed, never the steps, the
  // script or the reference output. The learner picks one first and can change it at any time.
  const MODES = {
    demonstration: {label: 'Demonstration', icon: '▶', what: 'Watch the coach type each line into the script, run it and explain the result.'},
    guided: {label: 'Guided', icon: '✎', what: 'Type and run each line yourself, one step at a time. The coach checks each result, and gives hints or shows you if you ask.'},
    solo: {label: 'Solo', icon: '◎', what: 'Work through the whole task list on your own, then ask the coach to check your work.'},
  };

  // Several lessons can share a run (one RStudio project). The picker then offers the lessons
  // first, as compact cards, and the modes of the selected one below them. The chosen lesson,
  // its mode and the mode's progress are kept per run in sessionStorage, so a reload returns to
  // them as they were. Choosing a mode starts it afresh (see freshStart), and forgets every
  // other mode's progress, which no longer matches the script or R. Back on the picker returns
  // to the mode just left, as it was.
  function startLessons(root, session, lessons, status) {
    const content = root.querySelector('.content');
    const read = key => { try { return sessionStorage.getItem(key); } catch (_error) { return null; } }; // storage blocked
    const write = (key, value) => {
      try { if (value) sessionStorage.setItem(key, value); else sessionStorage.removeItem(key); } catch (_error) { /* storage blocked */ }
    };
    const lessonKey = `rsCoachLesson:${session.run_id}`;
    const modeKey = l => `rsCoachMode:${session.run_id}:${l.id}`;
    const forgetProgress = () => {
      const progress = new RegExp(`^rsCoach(?:Mode|Demo|Guided|Solo):${session.run_id}:`);
      try { for (const key of Object.keys(sessionStorage)) if (progress.test(key)) sessionStorage.removeItem(key); } catch (_error) { /* storage blocked */ }
    };
    const modesOf = l => l.modes.filter(mode => mode in MODES);
    const switchLabel = lessons.length > 1 ? 'Change lesson or mode' : 'Change mode';
    const setHeader = text => { root.querySelector('.mode').textContent = text; };
    let lesson = lessons.find(l => l.id === read(lessonKey)) || lessons[0];
    let teardown = () => {};
    let resume = null; // {lesson, mode}: what Back on the picker returns to
    const leave = () => { teardown(); teardown = () => {}; };

    // A mode as it stands: reopened after a reload or by Back, or just reset by start().
    function open(mode, {restored = false, autostart = false} = {}) {
      leave();
      Object.assign(coach, {mode, lesson: lesson.id});
      setHeader(mode ? MODES[mode].label : lessons.length > 1 ? 'Choose a lesson and mode' : 'Choose a mode');
      write(lessonKey, lesson.id);
      write(modeKey(lesson), mode);
      status(`Run ${session.run_id} · ${mode ? lesson.title : `${lessons.length} lesson${lessons.length > 1 ? 's' : ''}`}`);
      note('mode', {lesson: lesson.id, mode, restored});
      content.replaceChildren();
      if (!mode) { renderPicker(); return; }
      const render = {demonstration: renderDemo, guided: renderGuided, solo: renderSolo}[mode];
      const storeKey = name => `rsCoach${name}:${session.run_id}:${lesson.id}`;
      // Back on the picker can return to this mode, unless the learner ended it (Stop).
      const changeMode = (resumable = true) => {
        resume = resumable ? {lesson, mode} : null;
        open(null);
      };
      teardown = render({content, session, lesson, status, restored, autostart, storeKey, switchLabel, changeMode,
        startOver: () => start(mode, {autostart: true})}) || teardown;
    }

    // A mode chosen on the picker, or Start over: reset RStudio, then open the mode from scratch.
    // The panel says what is happening and offers nothing to press until RStudio is ready.
    async function start(mode, {autostart = false} = {}) {
      leave();
      resume = null;
      forgetProgress();
      Object.assign(coach, {mode, lesson: lesson.id});
      setHeader(MODES[mode].label);
      status(`Run ${session.run_id} · ${lesson.title}`);
      content.innerHTML = `
        <h2>${escapeHtml(lesson.title)}</h2>
        <section class="card starting">
          <h3>${autostart ? 'Starting over' : `Starting ${MODES[mode].label}`}</h3>
          <p class="phase">Starting afresh: ${escapeHtml(lesson.script)} goes back to its step headings, and the Console, Environment and Plots are emptied.</p>
          <div class="timer working"><span></span></div>
        </section>`;
      const problems = await freshStart(lesson);
      open(mode, {autostart});
      if (problems.length) {
        const warning = Object.assign(document.createElement('p'), {className: 'error reset-problem'});
        warning.textContent = `The coach couldn't reset everything. ${problems.join(' ')}`;
        content.prepend(warning);
      }
    }

    function renderPicker() {
      const modes = modesOf(lesson);
      const lessonCards = `
        <div class="pick" role="radiogroup" aria-labelledby="lesson-label">
          <p class="pick-label" id="lesson-label">Choose a lesson</p>
          ${lessons.map(l => `
            <button class="lesson-card" role="radio" aria-checked="${l === lesson}" data-lesson="${escapeHtml(l.id)}">
              <span class="dot" aria-hidden="true"></span>
              <strong>${escapeHtml(l.title)}</strong>
              <span class="what">${escapeHtml(covers(l))}</span>
            </button>`).join('')}
        </div>`;
      content.innerHTML = `
        ${lessons.length > 1 ? lessonCards : `<h2>${escapeHtml(lesson.title)}</h2><p>${escapeHtml(lesson.summary)}</p>`}
        <div class="pick" role="group" aria-labelledby="pick-label">
          <p class="pick-label" id="pick-label">How do you want to work through it?</p>
          ${modes.map(mode => `
            <button class="mode-card" data-mode="${mode}">
              <span class="icon" aria-hidden="true">${MODES[mode].icon}</span>
              <strong>${MODES[mode].label}</strong>
              <span class="what">${escapeHtml(MODES[mode].what)}</span>
            </button>`).join('')}
        </div>
        ${resume ? `<div class="row"><button class="back">Back to ${escapeHtml(MODES[resume.mode].label)}${lessons.length > 1 ? `: ${escapeHtml(resume.lesson.title)}` : ''}</button></div>` : ''}
        <p class="muted">You can change ${lessons.length > 1 ? 'lesson or ' : ''}mode at any time. Each choice starts afresh: the lesson's script goes back to its step headings, and the Console, Environment and Plots are emptied.</p>`;
      for (const card of content.querySelectorAll('.lesson-card')) {
        card.addEventListener('click', () => {
          lesson = lessons.find(l => l.id === card.dataset.lesson);
          write(lessonKey, lesson.id);
          note('lesson', {lesson: lesson.id});
          renderPicker();
          content.querySelector(`.lesson-card[data-lesson="${CSS.escape(lesson.id)}"]`)?.focus();
        });
      }
      for (const card of content.querySelectorAll('.mode-card')) card.addEventListener('click', () => start(card.dataset.mode));
      content.querySelector('.back')?.addEventListener('click', () => {
        const {lesson: was, mode} = resume;
        resume = null;
        lesson = was;
        open(mode, {restored: true});
      });
    }
    // What a lesson covers, from its step titles: "Plots: plot()" -> "plot()".
    function covers(l) {
      return `${l.steps.length} steps: ${l.steps.map(s => s.title.split(': ').pop()).join(', ')}`;
    }
    // A reload returns to the lesson and mode as they were; a new run (or tab) opens on the picker,
    // or straight into the only mode of a one-lesson, one-mode run, as provisioned.
    const saved = read(modeKey(lesson));
    const modes = modesOf(lesson);
    open(modes.includes(saved) ? saved : modes.length === 1 && lessons.length === 1 ? modes[0] : null, {restored: modes.includes(saved)});
  }

  // The card's "now" line: what the coach is doing in RStudio, in plain words. Each change
  // fades in, so the eye notices that the coach has moved on.
  const phaseSetter = el => text => {
    el.innerHTML = text ? inline(text) : '';
    el.classList.remove('new');
    if (text) { void el.offsetWidth; el.classList.add('new'); }
  };
  const lessonHeader = (lesson, intro) => `
    <h2>${escapeHtml(lesson.title)}</h2>
    <p class="intro">${inline(intro)}</p>
    <p class="muted source">${escapeHtml(lesson.source)}</p>`;
  const stepList = steps => `<ol class="steps">${steps.map((s, i) => `<li data-step="${i}">${escapeHtml(s.title)}</li>`).join('')}</ol>`;
  function endedView(content, text, changeMode, switchLabel) {
    content.innerHTML = `<p class="ended"></p><div class="row"><button class="switch">${switchLabel}</button></div>`;
    content.querySelector('.ended').textContent = text;
    content.querySelector('.switch').addEventListener('click', () => changeMode(false)); // nothing to go back to
  }

  // ---------- A fresh start ----------
  // Choosing a mode, or Start over, starts the lesson from scratch, whatever ran before it in
  // RStudio. Otherwise a Demonstration's code would already be under the headings when Guided asks
  // the learner to write it, and its chart and variables would already be on screen. The lesson's
  // script goes back to the step headings it was provisioned with. Then the coach empties R the
  // way a learner would, with the brooms on the Environment and Plots panes (each confirmed in
  // RStudio's own dialog, and only if there is something to clear), and clears the Console. This
  // is housekeeping rather than part of the lesson, so the coach works RStudio without its pointer.
  // Resolves to the problems it met, for the panel to report.
  //
  // Not Restart R: in a session's first half-minute RStudio holds a restart back (one asked for
  // 7 s after sign-in took 23.6 s, against 1-2 s later on), and that is when a learner picks their
  // first mode. These lessons load no packages, so clearing objects and charts loses nothing.
  async function freshStart(lesson) {
    const began = Date.now();
    const problems = [];
    const attempt = async fn => { try { await fn(); } catch (error) { problems.push(error.message); } };
    await attempt(() => resetScript(lesson.script, lesson.starter));
    const objects = !ide.environmentEmpty();
    if (objects) await attempt(clearObjects);
    const charts = ide.chartShown();
    if (charts) await attempt(clearPlots);
    const clear = ide.consoleClear();
    if (clear) press(clear);
    const cleared = Boolean(await waitFor(() => !ide.consoleText().trim(), 3000));
    const detail = {lesson: lesson.id, ms: Date.now() - began, objects, charts, cleared, problems};
    coach.fresh = {count: coach.fresh.count + 1, last: detail};
    note('fresh_start', detail);
    return problems;
  }

  // `script` back to `text` and saved, with no undo history that could bring the old code back.
  async function resetScript(script, text) {
    const editor = await openQuietly(script);
    if (editor.getValue() !== text) editor.session.getDocument().setValue(text);
    editor.session.getUndoManager().reset();
    editor.clearSelection();
    editor.moveCursorTo(0, 0);
    editor.renderer.scrollToRow(0);
    if (!ide.unsaved(script)) return;
    const save = await waitFor(ide.saveButton, 2000);
    if (save) press(save);
    if (!(await waitFor(() => !ide.unsaved(script), 5000))) throw new Error(`RStudio did not save ${script} after the coach reset it.`);
  }

  // Show `script` in the Source pane: its tab if it is open, otherwise from the project folder in
  // the Files pane. RStudio re-renders the Files list and tab strip, so retry a click that missed.
  async function openQuietly(script) {
    const listed = () => ide.sourceTab(script) || ide.fileLink(script);
    for (let attempt = 1; attempt <= 3 && !ide.scriptEditor(script); attempt += 1) {
      if (!listed()) {
        if (!ide.files() && ide.filesTab()) press(ide.filesTab());
        else if (ide.filesHome()) press(ide.filesHome()); // Files shows another folder
      }
      const target = await waitFor(listed, 5000);
      if (!target) break;
      press(target);
      await waitFor(() => ide.scriptEditor(script), 4000);
    }
    const editor = ide.scriptEditor(script);
    if (!editor) throw new Error(`${script} did not open from the project folder, so it still holds what was typed before.`);
    return editor;
  }

  // Press Yes in RStudio's confirmation dialog titled `title`. Its id differs from dialog to dialog.
  async function confirm(title) {
    const yes = await waitFor(() => {
      const dialog = [...document.querySelectorAll('[role="alertdialog"]')].find(d => shown(d) && d.textContent.includes(title));
      return dialog && [...dialog.querySelectorAll('button')].find(b => shown(b) && b.textContent.trim() === 'Yes');
    }, 3000);
    if (yes) press(yes);
    return Boolean(yes);
  }

  // The Environment pane's broom removes every object, hidden ones included (the dialog's default).
  async function clearObjects() {
    const broom = document.getElementById('rstudio_tb_clearworkspace');
    if (broom) press(broom);
    if (!broom || !(await confirm('Remove Objects')) || !(await waitFor(ide.environmentEmpty, 5000))) {
      throw new Error('The objects from before are still in the Environment pane.');
    }
  }

  // The Plots pane's broom does nothing unless the Plots tab is showing.
  async function clearPlots() {
    if (!ide.plots() && ide.plotsTab()) press(ide.plotsTab());
    const broom = await waitFor(() => byId('rstudio_tb_clearplots'), 2000);
    if (broom) press(broom);
    if (!broom || !(await confirm('Clear Plots')) || !(await waitFor(() => !ide.chartShown(), 5000))) {
      throw new Error('The chart from before is still in the Plots pane.');
    }
  }

  // ---------- Demonstration ----------
  class DemoStopped extends Error {}

  // Before the first step, the panel introduces the lesson and lists its steps. Once the learner
  // starts a step, that overview gives way to the current step alone: while the coach works, one
  // short line says what it is doing now ("Writing code to draw a line through the numbers 1 to
  // 10"), and once RStudio shows the result, the explanation replaces it. A reload shows the
  // overview again, with the steps done so far ticked, until the learner presses Next.
  //
  // Every line of narration, and every explanation but the last, waits for the learner to read
  // it (`readMs`, longer for longer text), as ELK Guide's reading beats do. The main button counts
  // the wait down ("Advance · 5s", "Next: step 3 · 12s") and a bar fills; pressing it moves on at
  // once, and otherwise the coach moves on when the countdown ends, into the next step after an
  // explanation. Advance pressed while the coach is acting ends the next wait as soon as it starts.
  //
  // Start over resets the script and R (a fresh start) and then runs step 1 by itself, so every
  // line is typed again. `autostart` is that second half.
  function renderDemo({content, session, lesson: manifest, status, autostart, storeKey: keyFor, switchLabel, changeMode, startOver}) {
    const steps = manifest.steps;
    content.innerHTML = `
      <div class="overview">
        ${lessonHeader(manifest, `${manifest.summary} For each line, the coach types it into ${manifest.script}, presses Run and explains the result once RStudio shows it.`)}
        ${stepList(steps)}
      </div>
      <section class="card" hidden>
        <h3></h3>
        <p class="phase" aria-live="polite"></p>
        <div class="explain" aria-live="polite"></div>
        <div class="timer" hidden><span></span></div>
      </section>
      <div class="row">
        <button class="primary go">Start demonstration</button>
        <button class="restart" hidden>Start over</button>
        <button class="stop">Stop</button>
        <button class="switch">${switchLabel}</button>
      </div>
      <p class="muted watch" hidden>The amber pointer is the coach's. While it works, watch RStudio rather than typing in it.</p>`;
    const $ = sel => content.querySelector(sel);
    const card = $('.card');
    const phaseEl = $('.phase');
    const explainEl = $('.explain');
    const go = $('.go');
    const restart = $('.restart');

    const storeKey = keyFor('Demo');
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
    const setPhase = phaseSetter(phaseEl);
    let started = 0; // steps the learner has started since this panel opened

    // The learner's turn to read. countdown(ms) resolves true when it runs out or the learner
    // presses Advance, and false when it is cancelled (Stop, Start over, Next pressed early).
    const timerEl = $('.timer');
    const fill = timerEl.querySelector('span');
    const wait = {end: 0, done: null, tick: 0, queued: false};
    const counting = () => Boolean(wait.done);
    function bar(mode, ms = 0) {
      timerEl.hidden = !mode;
      timerEl.classList.toggle('working', mode === 'working');
      fill.style.transition = 'none';
      fill.style.width = '0%';
      if (mode !== 'reading') return;
      void fill.offsetWidth; // restart the fill
      fill.style.transition = `width ${ms}ms linear`;
      fill.style.width = '100%';
    }
    function countdown(ms) {
      endCountdown(false);
      if (wait.queued) { // Advance was pressed while the coach was acting
        wait.queued = false;
        renderControls();
        return Promise.resolve(true);
      }
      return new Promise(resolve => {
        Object.assign(wait, {end: Date.now() + ms, done: resolve});
        bar('reading', ms);
        const tick = () => {
          if (Date.now() >= wait.end) { endCountdown(true); return; }
          renderControls();
          wait.tick = setTimeout(tick, 200);
        };
        tick();
      });
    }
    function endCountdown(moveOn) {
      clearTimeout(wait.tick);
      const done = wait.done;
      if (!done) return;
      wait.done = null;
      bar(demo.state === 'running' && !demo.stopped ? 'working' : null);
      renderControls();
      done(moveOn);
    }
    const drive = makeDriver(manifest, demo, setPhase, async text => {
      const ms = readMs(text);
      note('demo_read', {text, ms});
      if (!(await countdown(ms))) throw new DemoStopped();
    });

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
      const running = demo.state === 'running';
      const left = counting() ? Math.max(1, Math.ceil((wait.end - Date.now()) / 1000)) : 0;
      go.disabled = running ? wait.queued : next === null;
      go.textContent = demo.state === 'idle' ? 'Start demonstration'
        : running ? (wait.queued ? 'Advancing when ready…' : left ? `Advance · ${left}s` : 'Advance')
        : demo.state === 'failed' ? 'Try this step again'
        : next === null ? 'Demonstration complete'
        : left ? `Next: step ${next + 1} · ${left}s` : `Next: step ${next + 1}`;
      go.title = left ? 'Move on now. Otherwise the coach moves on when the countdown ends.' : '';
      restart.hidden = !(demo.state === 'failed' || (demo.state !== 'running' && demo.completed.length));
      $('.overview').hidden = started > 0;
      $('.watch').hidden = demo.state !== 'running' || started > 1; // the first time the pointer appears
    }

    // The coach's pointer sets off from the button the learner just pressed.
    function begin() {
      const i = nextIndex();
      if (i === null) return;
      endCountdown(false); // the explanation's countdown: the learner moved on first
      clearHighlight();
      pointerFrom(go);
      runStep(i);
    }
    go.addEventListener('click', () => {
      if (demo.state !== 'running') { begin(); return; }
      note('demo_advance', {counting: counting()}); // Advance
      if (counting()) endCountdown(true);
      else { wait.queued = true; renderControls(); }
    });
    restart.addEventListener('click', () => {
      if (demo.state === 'running') return;
      note('demo_start_over');
      startOver();
    });
    const halt = () => {
      demo.stopped = true;
      wait.queued = false;
      endCountdown(false);
      bar(null);
      spotlight(null);
      clearHighlight();
      showPointer(false);
    };
    $('.stop').addEventListener('click', () => {
      halt();
      demo.state = 'stopped';
      try { sessionStorage.removeItem(storeKey); } catch (_error) { /* storage blocked */ }
      note('stop');
      endedView(content, 'This demonstration has ended. RStudio stays open and keeps what the demonstration ran.', changeMode, switchLabel);
    });
    $('.switch').addEventListener('click', () => changeMode());

    async function runStep(i) {
      const step = steps[i];
      Object.assign(demo, {index: i, state: 'running', failure: null, stopped: false});
      wait.queued = false;
      started += 1;
      card.hidden = false;
      $('.card h3').textContent = `Step ${i + 1} of ${steps.length}: ${step.title}`;
      explainEl.replaceChildren();
      bar('working');
      renderControls();
      note('demo_step_started', {step: step.id});
      try {
        await drive.openScript();
        let firstEcho = -1;
        for (const run of step.runs) {
          await drive.doRun(run, step, i);
          if (firstEcho < 0) firstEcho = demo.echoAt;
        }
        await drive.save();
        // Every result this step explains is now on screen and matches the reference run. The
        // dimming lifts, and a ring stays on what the explanation talks about while it is read.
        setPhase('');
        showPointer(false);
        spotlight(null);
        highlight(step.runs.some(r => r.evidence === 'plot') ? ide.plots : () => consoleRangeRect(firstEcho), Infinity);
        explainEl.innerHTML = format(step.explain, demo.values);
        demo.completed = [...new Set([...demo.completed, i])];
        demo.state = 'waiting';
        wait.queued = false; // an Advance pressed during the save hurried the save, not this explanation
        bar(null);
        persist();
        note('demo_step_done', {step: step.id, values: {...demo.values}});
        if (i === steps.length - 1) status(`Demonstration complete · ${manifest.title}`);
        else continueAfterReading(i);
      } catch (error) {
        showPointer(false);
        spotlight(null);
        if (error instanceof DemoStopped || demo.stopped) return;
        bar(null);
        demo.state = 'failed';
        demo.failure = error.message;
        clearHighlight();
        setPhase('');
        explainEl.innerHTML = `<p class="error">The demonstration stopped at this step. ${escapeHtml(error.message)}</p>`;
        note('demo_step_failed', {step: step.id, reason: error.message});
      }
      renderControls();
    }

    // The next step starts by itself once the learner has had time to read the explanation,
    // unless they press Next first (or Stop, or Start over).
    async function continueAfterReading(i) {
      const ms = readMs(explainEl.textContent);
      note('demo_read', {text: 'explanation', step: steps[i].id, ms});
      if (!(await countdown(ms)) || demo.stopped || demo.state !== 'waiting' || demo.index !== i) return;
      note('demo_auto_advance', {step: steps[i + 1].id});
      clearHighlight();
      pointerFrom(go);
      runStep(i + 1);
    }

    renderControls();
    if (autostart) begin();
    return () => { halt(); coach.demo = null; };
  }

  // Works RStudio the way a learner does: the coach's pointer moves to each control it clicks,
  // and code is typed one key at a time. Demonstration uses it for every line, Guided for Show me.
  // Setting `state.stopped` halts it at the next frame or keystroke.
  //
  // Each line of narration gets one turn to be read: before a click it announces the click, and
  // after typing or a result it lets the learner take in what changed. Demonstration passes
  // `hold(text)` for that turn (its countdown). Without one (Show me), the coach keeps its own
  // pace instead: a short lead before clicks and a dwell on results.
  function makeDriver(manifest, state, setPhase, hold = null) {
    const script = manifest.script;
    const check = () => { if (state.stopped) throw new DemoStopped(); };
    const pause = async (ms = paceMs) => { await sleep(ms); check(); };
    let unread = null; // the narration on screen, until its turn to be read has passed
    const say = text => { setPhase(text); unread = text; };
    async function heed(ms = 0) {
      const text = unread;
      unread = null;
      if (text !== null && hold) await hold(text);
      else if (ms) await sleep(ms);
      check();
    }

    async function openScript() {
      const isOpen = () => ide.scriptEditor(script);
      if (isOpen()) return;
      // RStudio re-renders the Files list and tab strip when files change, so look the
      // target up again after each pause and retry if the click landed on a stale element.
      const target = () => ide.sourceTab(script) || ide.fileLink(script);
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        if (ide.sourceTab(script)) {
          say(`Switching to ${script} in the Source pane`);
        } else {
          say(`Opening ${script} from the Files pane`);
          if (!ide.files() && ide.filesTab()) { await clickOn(ide.filesTab, 'files_tab'); await pause(400); }
        }
        if (!(await waitFor(target, 5000))) {
          throw new Error(`${script} is not listed in the Files pane. Show the project folder in Files, then try again.`);
        }
        if (!(await clickOn(target, 'open_script'))) continue;
        note('demo_action', {action: 'open_script', script, attempt});
        if (await waitFor(isOpen, 4000)) { await pause(); return; }
      }
      throw new Error(`${script} did not open in the Source pane.`);
    }

    // Move the pointer to a control and click it there. `find` is called again on arrival,
    // because RStudio re-renders the Files list and toolbars when files change.
    async function clickOn(find, what) {
      spotlight(find);
      await heed(leadMs); // the spotlight arrives before the pointer sets off
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (!(await glide(() => centre(find()), check))) return null;
        await pause(150);
        const el = find();
        if (!el) return null;
        const r = el.getBoundingClientRect();
        if (pointer.x < r.left || pointer.x > r.right || pointer.y < r.top || pointer.y > r.bottom) continue; // it moved
        pointerClickEffect();
        press(el, {x: pointer.x, y: pointer.y});
        state.actions += 1;
        note('demo_click', {target: what, x: Math.round(pointer.x), y: Math.round(pointer.y)});
        return el;
      }
      return null;
    }

    // Click at a place in the Source editor, the way a learner puts the cursor there.
    async function clickInEditor(editor, row, column) {
      const renderer = editor.renderer;
      renderer.scrollCursorIntoView({row, column}, 0.5);
      const point = () => {
        const at = renderer.textToScreenCoordinates(row, column);
        const box = renderer.scroller.getBoundingClientRect();
        return {x: clamp(at.pageX + 2, box.left + 4, box.right - 6), y: clamp(at.pageY + renderer.lineHeight / 2, box.top + 4, box.bottom - 4)};
      };
      await glide(point, check);
      await pause(150);
      pointerClickEffect();
      editor.focus();
      editor.clearSelection();
      editor.moveCursorTo(row, column);
      state.actions += 1;
      note('demo_click', {target: 'editor', line: row + 1, x: Math.round(pointer.x), y: Math.round(pointer.y)});
    }

    // Press Enter at the end of `row`, then type the code one key at a time. RStudio's own
    // auto-pairing runs, as it does for a learner: "(" also adds ")", and typing ")" steps over it.
    async function typeLine(editor, row, code) {
      const line = row + 1;
      showPointer(false); // like most systems, hide the mouse pointer while typing
      editor.insert('\n', true);
      state.actions += 1;
      const started = Date.now();
      for (let i = 0; i < code.length; i += 1) {
        await pause(keyGap(code, i));
        const at = editor.getCursorPosition();
        if (at.row !== line || at.column !== i) { editor.clearSelection(); editor.moveCursorTo(line, i); }
        editor.insert(code[i]);
        editor.renderer.scrollCursorIntoView(null, 0.5);
        state.actions += 1;
      }
      note('demo_action', {action: 'type', line: line + 1, chars: code.length, ms: Date.now() - started});
      const typed = editor.session.getLine(line);
      if (typed !== code) {
        throw new Error(`Line ${line + 1} of ${script} reads ${typed} instead of ${code}. Something else edited it while the coach was typing.`);
      }
      return line;
    }

    async function save() {
      const unsaved = () => ide.unsaved(script);
      if (!unsaved()) return;
      say(`Saving ${script}`);
      if (!(await clickOn(ide.saveButton, 'save'))) throw new Error('The Save button in the Source pane is not visible.');
      if (!(await waitFor(() => !unsaved(), 5000))) throw new Error(`RStudio did not save ${script}.`);
      check();
      note('demo_action', {action: 'save', script});
    }

    // Each line is narrated by what it is for (the run's `purpose`, from scenario.json), not by
    // where it goes: "Writing code to find the highest temperature".
    async function doRun(run, step, index) {
      const heading = step.heading || `# Step ${index + 1}. ${step.title}`;
      const editor = ide.activeEditor();
      if (!editor) throw new Error(`${script} is not open in the Source pane.`);
      const lines = editor.session.getDocument().getAllLines();
      const block = stepBlock(lines, heading);
      if (!block) {
        throw new Error(`${script} no longer has the line ${heading}, so the coach can't tell where step ${index + 1} goes. Put the heading back, or start this mode again to reset the script.`);
      }
      // The spotlight takes in the step's heading and the line the code goes on.
      const headingRow = block.start - 1;
      let row = lines.findIndex((line, r) => r >= block.start && r < block.end && line.trimEnd() === run.code);
      if (row >= 0) {
        // Already there (typed earlier, or by the learner): run it as it is rather than type it twice.
        say(`The code to ${run.purpose} is already in the script, so it runs again as it is`);
        const at = row;
        spotlight(() => editorRowsRect(editor, headingRow, at));
        await pause(leadMs);
        await clickInEditor(editor, row, 0); // at its start, so a long line doesn't scroll the editor sideways
      } else {
        say(`Writing code to ${run.purpose}`);
        spotlight(() => editorRowsRect(editor, headingRow, block.last + 1));
        await pause(leadMs);
        await clickInEditor(editor, block.last, lines[block.last].length);
        row = await typeLine(editor, block.last, run.code);
      }
      await heed(400);

      // With no selection, Run sends the line the cursor is on, comment included.
      say('Pressing Run to send this line to the Console (Ctrl+Enter does the same)');
      const before = {echoes: countEchoes(ide.consoleText(), run.code), plot: ide.plotImage()?.src || null};
      if (!(await clickOn(ide.runButton, 'run'))) throw new Error('The Run button in the Source pane is not visible.');
      note('demo_action', {action: 'run', line: row + 1});

      spotlight(run.evidence === 'plot' ? ide.plots : ide.console);
      const output = await waitForEvidence(run, before);
      const echoAt = ide.consoleText().lastIndexOf(`> ${run.code}`);
      state.echoAt = echoAt;
      for (const [name, pattern] of Object.entries(run.capture || {})) {
        // Read the value from what the Console shows. If RStudio wrapped the printout to
        // fit a narrow pane, the tokens already match the reference, so use its reading.
        const seen = (new RegExp(pattern).exec(normalise(output)) || [])[1] ?? run.expected_values[name];
        if (seen !== run.expected_values[name]) {
          throw new Error(`RStudio showed ${name} = ${seen}, but the reference run for this scenario gave ${run.expected_values[name]}.`);
        }
        state.values[name] = seen;
      }
      // Hold the result in the spotlight long enough to find and read it.
      const stored = /^\s*([A-Za-z.][\w.]*)\s*(?:<-|=)/.exec(run.code)?.[1];
      const printed = normalise(output);
      if (run.evidence === 'plot') {
        spotlight(ide.plots);
        say('R drew the chart in the Plots pane');
      } else if (run.show === 'environment' && stored) {
        spotlight(() => environmentRowRect(stored) || ide.environment());
        say(`\`${stored}\` now appears in the Environment pane (an assignment prints nothing in the Console)`);
      } else {
        spotlight(() => consoleRangeRect(echoAt));
        say(printed && printed.length <= 40 ? `R printed \`${printed}\` in the Console` : 'R printed the result in the Console');
      }
      await heed(dwellMs);
      return output;
    }

    // Done only when RStudio shows the line ran, with the reference output, plus a newly
    // loaded chart for a plotting line. An R error stops the line visibly. R usually answers
    // within a second, so "Pressing Run…" stays up until then; a slower line says it is running.
    async function waitForEvidence(run, before) {
      const deadline = Date.now() + 20000;
      let slowAt = Date.now() + 1500;
      let matchedAt = 0;
      let seen = {echo: false, output: '', plot: false};
      for (;;) {
        check();
        if (slowAt && Date.now() > slowAt && !matchedAt) {
          slowAt = 0;
          setPhase(run.evidence === 'plot' ? 'R is still drawing the chart…' : 'R is still running the line…');
        }
        const text = ide.consoleText();
        if (countEchoes(text, run.code) > before.echoes) {
          const at = text.lastIndexOf(`> ${run.code}`);
          const end = text.indexOf('\n', at);
          const output = end < 0 ? '' : text.slice(end + 1);
          const error = consoleError(output);
          if (error) throw new Error(`R reported: ${error}`);
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

    return {openScript, doRun, save};
  }

  // ---------- Guided and Solo: the learner works RStudio ----------
  // These lessons have no hidden answer (their code and reference output are public), so the
  // coach can confirm a line in the page: by what RStudio shows, not by how the line was typed.
  // A line counts when, after the mode started, the Console shows it ran without an error and
  // printed the reference output. A line that prints nothing (an assignment, a chart) counts
  // when the command matches the reference, ignoring spaces, comments, quote style and = for <-,
  // and a chart line also needs a new chart in the Plots pane. The Console and Script both work.
  function consoleWatch(settle) {
    let from = null; // index of the first Console entry made in this mode
    let count = 0;
    let lastPlot = null;
    const plots = []; // each chart RStudio loaded, with how many Console entries existed then
    const watch = {
      poll() {
        const now = Date.now();
        const current = sampleConsole();
        const changedAt = consoleClock.changedAt;
        const entries = consoleEntries(current);
        if (entries.length < count) { // the learner cleared the Console (Ctrl+L)
          if (from !== null) from = 0;
          for (const p of plots) p.after = 0;
        }
        count = entries.length;
        const img = ide.plotImage();
        const src = img && img.complete && img.naturalWidth > 0 ? img.src : null;
        if (src && src !== lastPlot) { lastPlot = src; plots.push({src, after: entries.length}); }
        // A mode the learner chooses counts from that moment. A mode reopened by a reload waits
        // until RStudio has refilled the Console with earlier output, which is not new work.
        if (from === null) {
          if (settle && (!document.getElementById('rstudio_console_input') || now - changedAt < 1000)) return null;
          from = entries.length;
        }
        return {entries, from, plots, quietMs: now - changedAt};
      },
    };
    watch.poll();
    return watch;
  }
  function matchRun(run, view, from = view.from) {
    const wantOutput = Boolean(run.expected_output.trim());
    for (let k = view.entries.length - 1; k >= from; k -= 1) {
      const entry = view.entries[k];
      if (!codeKey(entry.code) || consoleError(entry.output)) continue;
      if (wantOutput ? !sameTokens(entry.output, run.expected_output) : codeKey(entry.code) !== codeKey(run.code)) continue;
      if (run.evidence === 'plot' && !view.plots.some(p => p.after > k)) continue;
      return {index: k, output: entry.output};
    }
    return null;
  }
  // Values a line printed, read the same way as in Demonstration.
  function captured(run, output) {
    const values = {};
    for (const [name, pattern] of Object.entries(run.capture || {})) {
      values[name] = (new RegExp(pattern).exec(normalise(output || '')) || [])[1] ?? run.expected_values[name];
    }
    return values;
  }
  const expectedValues = steps => Object.assign({}, ...steps.flatMap(s => s.runs.map(r => r.expected_values || {})));

  function renderGuided({content, session, lesson, status, restored, storeKey: keyFor, switchLabel, changeMode}) {
    const steps = lesson.steps;
    const script = lesson.script;
    const key = (s, r) => `${s}.${r}`;
    const storeKey = keyFor('Guided');
    // done: {"step.line": "learner" | "coach"}; hints: {"step.line": hints read}.
    // since: the first Console entry that gets feedback for this step (undefined: the mode's first).
    const g = (coach.guided = {step: 0, done: {}, hints: {}, values: {}, showing: false, show: null, feedback: '', since: undefined});
    try {
      const saved = JSON.parse(sessionStorage.getItem(storeKey) || 'null');
      if (saved) Object.assign(g, {step: Math.min(saved.step || 0, steps.length - 1), done: saved.done || {}, hints: saved.hints || {}, values: saved.values || {}});
    } catch (_error) { /* storage blocked */ }
    const persist = () => {
      try { sessionStorage.setItem(storeKey, JSON.stringify({step: g.step, done: g.done, hints: g.hints, values: g.values})); } catch (_error) { /* storage blocked */ }
    };
    const stepDone = s => steps[s].runs.every((_run, r) => g.done[key(s, r)]);
    const current = () => steps[g.step].runs.findIndex((_run, r) => !g.done[key(g.step, r)]); // -1: step done
    const finished = () => g.step === steps.length - 1 && stepDone(g.step);

    content.innerHTML = `
      ${lessonHeader(lesson, `${lesson.summary} Type each line below its step heading in ${script}, then press Ctrl+Enter to run it. The coach ticks each line once RStudio shows the right result.`)}
      ${stepList(steps)}
      <section class="card">
        <h3></h3>
        <ol class="tasks"></ol>
        <div class="hints"></div>
        <p class="feedback" aria-live="polite"></p>
        <p class="phase" aria-live="polite"></p>
        <div class="explain" aria-live="polite"></div>
      </section>
      <section class="card debrief" hidden aria-live="polite"></section>
      <div class="row">
        <button class="hint">Hint</button>
        <button class="show">Show me</button>
        <button class="primary next" hidden>Next step</button>
        <button class="switch">${switchLabel}</button>
      </div>`;
    const $ = sel => content.querySelector(sel);
    const hintBtn = $('.hint');
    const showBtn = $('.show');
    const nextBtn = $('.next');
    const setPhase = phaseSetter($('.phase'));

    function hintsFor(s, r) {
      const step = steps[s];
      const run = step.runs[r];
      return [
        `Type it on a new line below <code>${escapeHtml(step.heading)}</code> in ${escapeHtml(script)}. With the cursor on that line, press Ctrl+Enter or click Run.`,
        `It starts like this: <code>${escapeHtml(run.hint_partial)}</code>`,
        `The whole line is <code>${escapeHtml(run.hint_line)}</code>`,
      ];
    }

    function render() {
      for (const li of content.querySelectorAll('li[data-step]')) {
        const s = Number(li.dataset.step);
        li.className = stepDone(s) ? 'done' : s === g.step ? 'active' : '';
      }
      const step = steps[g.step];
      const r = current();
      $('.card h3').textContent = `Step ${g.step + 1} of ${steps.length}: ${step.title}`;
      $('.tasks').innerHTML = step.runs.map((run, k) =>
        `<li class="${g.done[key(g.step, k)] ? 'done' : k === r ? 'active' : ''}">${inline(run.task)}</li>`).join('');
      const read = r < 0 ? 0 : g.hints[key(g.step, r)] || 0;
      $('.hints').innerHTML = r < 0 ? '' : hintsFor(g.step, r).slice(0, read).map(h => `<p class="hint-text">${h}</p>`).join('');
      $('.feedback').textContent = r < 0 || g.showing ? '' : g.feedback;
      $('.explain').innerHTML = r < 0 ? format(step.explain, {...expectedValues(steps), ...g.values}) : '';
      hintBtn.hidden = showBtn.hidden = r < 0;
      hintBtn.disabled = g.showing || read >= 3;
      hintBtn.textContent = read >= 3 ? 'No more hints' : `Hint ${read + 1} of 3`;
      showBtn.textContent = g.showing ? 'Stop' : 'Show me';
      nextBtn.hidden = r >= 0 || finished();
      nextBtn.textContent = `Next: step ${g.step + 2}`;
      const debrief = $('.debrief');
      debrief.hidden = !finished();
      if (finished()) {
        const keys = steps.flatMap((s, i) => s.runs.map((_run, k) => key(i, k)));
        const own = steps.filter((s, i) => s.runs.every((_run, k) => g.done[key(i, k)] === 'learner' && !g.hints[key(i, k)])).length;
        const hints = keys.reduce((n, k) => n + (g.hints[k] || 0), 0);
        const shown = keys.filter(k => g.done[k] === 'coach').length;
        debrief.innerHTML = `<h3>All ${steps.length} steps done</h3>
          <ul class="stats">
            <li>Steps done without help: <strong>${own} of ${steps.length}</strong></li>
            <li>Hints read: <strong>${hints}</strong></li>
            <li>Lines the coach showed you: <strong>${shown}</strong></li>
          </ul>
          <p class="muted">To practise without the step-by-step checks, change mode to Solo.</p>`;
        status(`Guided lesson complete · ${lesson.title}`);
      }
    }

    function complete(s, r, by, output) {
      const k = key(s, r);
      if (g.done[k]) return;
      Object.assign(g.values, captured(steps[s].runs[r], output));
      g.done[k] = by;
      g.feedback = '';
      persist();
      note('guided_line_done', {step: steps[s].id, line: r, by});
      if (stepDone(s)) note('guided_step_done', {step: steps[s].id});
      render();
    }

    // What to tell the learner about the last thing they ran for this step, if it didn't count.
    // null: they haven't run anything since the step started, so keep what the card says.
    function feedbackFor(view) {
      const from = Math.max(view.from, g.since ?? view.from);
      for (let k = view.entries.length - 1; k >= from; k -= 1) {
        const entry = view.entries[k];
        if (!codeKey(entry.code)) continue; // a comment, such as a step heading Run sent along
        const error = consoleError(entry.output);
        if (error) return `R reported: ${error.replace(/\.$/, '')}. Fix the line, then run it again.`;
        if (steps.some(step => step.runs.some(run => matchRun(run, view, k)?.index === k))) return '';
        if (view.quietMs < 2500) return g.feedback; // a chart may still be loading
        return `RStudio ran ${entry.code.trim()}, but that isn't what this line asks for. Check the task, or ask for a hint.`;
      }
      return null;
    }

    const watch = consoleWatch(restored);
    const entriesNow = () => watch.poll()?.entries.length ?? null; // null: Console not settled yet
    const timer = setInterval(() => {
      const view = watch.poll();
      if (!view) return;
      if (g.since === null) g.since = view.entries.length;
      const s = g.step;
      for (const [r, run] of steps[s].runs.entries()) {
        if (g.done[key(s, r)]) continue;
        const match = matchRun(run, view);
        if (match && view.quietMs >= 600) complete(s, r, g.showing ? 'coach' : 'learner', match.output);
      }
      if (g.showing || current() < 0) return;
      const feedback = feedbackFor(view);
      if (feedback !== null && feedback !== g.feedback) { g.feedback = feedback; render(); }
    }, 300);

    hintBtn.addEventListener('click', () => {
      const r = current();
      if (r < 0 || g.showing) return;
      const k = key(g.step, r);
      g.hints[k] = Math.min(3, (g.hints[k] || 0) + 1);
      if (g.hints[k] === 1) highlight(ide.source(), 4000);
      persist();
      note('hint', {step: steps[g.step].id, line: r, level: g.hints[k]});
      render();
    });
    showBtn.addEventListener('click', async () => {
      if (g.showing) { g.show.stopped = true; return; }
      const r = current();
      if (r < 0) return;
      const s = g.step;
      const step = steps[s];
      g.showing = true;
      g.feedback = '';
      g.show = {stopped: false, actions: 0, values: {}};
      pointerFrom(showBtn);
      render();
      note('show_me', {step: step.id, line: r});
      const drive = makeDriver(lesson, g.show, setPhase);
      try {
        await drive.openScript();
        const output = await drive.doRun(step.runs[r], step, s);
        await drive.save();
        complete(s, r, 'coach', output);
      } catch (error) {
        if (!(error instanceof DemoStopped)) {
          g.feedback = `The coach couldn't show this line. ${error.message}`;
          g.since = entriesNow(); // keep this message until the learner runs something new
          note('show_me_failed', {step: step.id, reason: error.message});
        }
      } finally {
        g.showing = false;
        showPointer(false);
        spotlight(null);
        clearHighlight();
        setPhase('');
        render();
      }
    });
    nextBtn.addEventListener('click', () => {
      if (current() >= 0 || g.step >= steps.length - 1) return;
      g.step += 1;
      g.since = entriesNow(); // only what the learner runs from now on gets feedback for this step
      g.feedback = '';
      persist();
      note('guided_step_started', {step: steps[g.step].id});
      render();
    });
    $('.switch').addEventListener('click', () => changeMode());

    render();
    return () => {
      clearInterval(timer);
      if (g.show) g.show.stopped = true;
      showPointer(false);
      spotlight(null);
      clearHighlight();
      coach.guided = null;
    };
  }

  function renderSolo({content, session, lesson, status, restored, storeKey: keyFor, switchLabel, changeMode}) {
    const steps = lesson.steps;
    const lines = steps.flatMap((step, s) => step.runs.map((run, r) => ({k: `${s}.${r}`, run})));
    const storeKey = keyFor('Solo');
    // seen: lines RStudio showed with the reference result (kept quiet until a check);
    // checked: what the last check disclosed.
    const solo = (coach.solo = {seen: {}, hints: {}, values: {}, checked: null});
    try {
      const saved = JSON.parse(sessionStorage.getItem(storeKey) || 'null');
      if (saved) Object.assign(solo, {seen: saved.seen || {}, hints: saved.hints || {}, values: saved.values || {}, checked: saved.checked || null});
    } catch (_error) { /* storage blocked */ }
    const persist = () => {
      try { sessionStorage.setItem(storeKey, JSON.stringify(solo)); } catch (_error) { /* storage blocked */ }
    };

    content.innerHTML = `
      ${lessonHeader(lesson, `${lesson.summary} Work through the list on your own in ${lesson.script}: type each line below its step heading and run it. The coach checks nothing until you ask.`)}
      <ol class="solo-steps">${steps.map((step, s) => `
        <li><strong>${escapeHtml(step.title)}</strong>
          <ul class="tasks">${step.runs.map((run, r) => `
            <li data-line="${s}.${r}">${inline(run.task)}
              <button class="link hint" data-line="${s}.${r}" title="Hints are counted in your results">Hint</button>
              <span class="hint-text"></span></li>`).join('')}
          </ul></li>`).join('')}
      </ol>
      <div class="row">
        <button class="primary check">Check my work</button>
        <button class="switch">${switchLabel}</button>
      </div>
      <section class="card results" hidden aria-live="polite"></section>`;
    const $ = sel => content.querySelector(sel);

    function render() {
      for (const li of content.querySelectorAll('li[data-line]')) {
        const k = li.dataset.line;
        const [s, r] = k.split('.').map(Number);
        li.className = solo.checked ? (solo.checked.seen[k] ? 'done' : 'missing') : '';
        li.querySelector('.hint').hidden = Boolean(solo.hints[k]);
        li.querySelector('.hint-text').innerHTML = solo.hints[k] ? `It starts like this: <code>${escapeHtml(steps[s].runs[r].hint_partial)}</code>` : '';
      }
      const results = $('.results');
      results.hidden = !solo.checked;
      if (!solo.checked) return;
      const done = lines.filter(l => solo.checked.seen[l.k]).length;
      const hints = Object.keys(solo.hints).length;
      $('.check').textContent = 'Check again';
      if (done === lines.length) {
        const values = {...expectedValues(steps), ...solo.values};
        results.innerHTML = `<h3>All ${lines.length} lines done</h3>
          <p>Every line gave the reference result in RStudio. Hints used: <strong>${hints}</strong>.</p>
          <details><summary>What each step showed</summary>
            ${steps.map(step => `<h4>${escapeHtml(step.title)}</h4>${format(step.explain, values)}`).join('')}
          </details>`;
        status(`Solo lesson complete · ${lesson.title}`);
      } else {
        results.innerHTML = `<h3>${done} of ${lines.length} lines done</h3>
          <p>The ticked lines gave the reference result in RStudio. Run the others, then check again. Hints used: <strong>${hints}</strong>.</p>`;
      }
    }

    const watch = consoleWatch(restored);
    const timer = setInterval(() => {
      const view = watch.poll();
      if (!view || view.quietMs < 600) return;
      let changed = false;
      for (const {k, run} of lines) {
        if (solo.seen[k]) continue;
        const match = matchRun(run, view);
        if (!match) continue;
        solo.seen[k] = true;
        Object.assign(solo.values, captured(run, match.output));
        changed = true;
        note('solo_line_seen', {line: k}); // recorded, not shown until the learner checks
      }
      if (changed) persist();
    }, 300);

    for (const button of content.querySelectorAll('button.hint')) {
      button.addEventListener('click', () => {
        solo.hints[button.dataset.line] = true;
        persist();
        note('hint', {line: button.dataset.line, mode: 'solo'});
        render();
      });
    }
    $('.check').addEventListener('click', () => {
      solo.checked = {seen: {...solo.seen}, at: Date.now()};
      persist();
      note('solo_check', {done: Object.keys(solo.seen).length, of: lines.length, hints: Object.keys(solo.hints).length});
      render();
    });
    $('.switch').addEventListener('click', () => changeMode());

    render();
    return () => { clearInterval(timer); coach.solo = null; };
  }

  // ---------- helpers ----------
  // The Source editor's rows first..last, across the editor (line numbers included).
  function editorRowsRect(editor, first, last) {
    const renderer = editor.renderer;
    const box = renderer.scroller.getBoundingClientRect();
    const top = clamp(renderer.textToScreenCoordinates(first, 0).pageY, box.top, box.bottom);
    const bottom = clamp(renderer.textToScreenCoordinates(last, 0).pageY + renderer.lineHeight, box.top, box.bottom);
    return bottom > top ? {left: editor.container.getBoundingClientRect().left, top, right: box.right, bottom} : null;
  }
  // The Console lines from character `from` of its text to the end, across the pane: one command
  // and what it printed. Clipped to the visible part of the Console.
  function consoleRangeRect(from) {
    const out = document.getElementById('rstudio_console_output');
    const pane = ide.console();
    if (!out || !pane || from < 0) return null;
    const end = out.textContent.trimEnd().length;
    const walker = document.createTreeWalker(out, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let pos = 0;
    let started = false;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const len = node.nodeValue.length;
      if (!started && pos + len > from) { range.setStart(node, from - pos); started = true; }
      if (started && pos + len >= end) { range.setEnd(node, end - pos); break; }
      pos += len;
    }
    if (!started) return null;
    const r = range.getBoundingClientRect();
    let scroller = out.parentElement;
    while (scroller && scroller !== pane && !/auto|scroll/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
    const box = (scroller || pane).getBoundingClientRect();
    const p = pane.getBoundingClientRect();
    const top = Math.max(r.top, box.top, p.top);
    const bottom = Math.min(r.bottom, box.bottom, p.bottom);
    return bottom > top ? {left: p.left + 4, top, right: p.right - 4, bottom} : null;
  }
  // The Environment pane's row for a variable, across the pane.
  function environmentRowRect(name) {
    const pane = ide.environment();
    const cell = pane && [...pane.querySelectorAll('*')].find(el => el.childElementCount === 0 && el.textContent.trim() === name && shown(el));
    if (!cell) return null;
    const row = (cell.closest('tr') || cell).getBoundingClientRect();
    const p = pane.getBoundingClientRect();
    return {left: p.left + 4, top: row.top, right: p.right - 4, bottom: row.bottom};
  }
  // A step's code goes below its "# Step N." heading, up to the next heading. `last` is the
  // step's last non-blank line (the heading itself if nothing is typed yet).
  function stepBlock(lines, heading) {
    const at = lines.findIndex(line => line.trimEnd() === heading);
    if (at < 0) return null;
    let end = lines.findIndex((line, r) => r > at && /^# Step \d+\. /.test(line));
    if (end < 0) end = lines.length;
    let last = at;
    for (let r = at + 1; r < end; r += 1) if (lines[r].trim()) last = r;
    return {start: at + 1, end, last};
  }
  // Gaps between keystrokes vary the way a person's do: a little longer after a space, and a
  // short pause before starting a comment.
  function keyGap(code, i) {
    let ms = typeMs * (0.6 + Math.random() * 0.8);
    if (code[i - 1] === ' ') ms += typeMs * 0.5 * Math.random();
    if (code[i] === '#') ms += typeMs * 4;
    return ms;
  }
  const clamp = (value, low, high) => Math.min(Math.max(value, low), Math.max(low, high));
  // The Console as a list of commands and what each printed. RStudio echoes each command after
  // "> ", and continues one over several lines with "+ ".
  function consoleEntries(text) {
    const entries = [];
    let entry = null;
    for (const line of text.split('\n')) {
      if (line.startsWith('> ')) {
        entry = {code: line.slice(2), output: ''};
        entries.push(entry);
      } else if (entry && line.startsWith('+ ') && !entry.output) {
        entry.code += `\n${line.slice(2)}`;
      } else if (entry) {
        entry.output += `${line}\n`;
      }
    }
    return entries;
  }
  // RStudio puts its "Show Traceback / Rerun with Debug" links on the same line as the error,
  // and R continues a long message on an indented line.
  function consoleError(output) {
    const m = /(?:^|\n|Rerun with Debug)\s*(Error\b[^\n]*(?:\n {2}\S[^\n]*)?)/.exec(output);
    return m ? normalise(m[1]) : null;
  }
  // A command reduced to what it does: no spaces or comments, one quote style, and = read as <-
  // when it assigns a name, so `x = c(1,2)` and `x <- c(1, 2) # note` compare equal.
  function codeKey(code) {
    let out = '';
    let quote = null;
    for (let i = 0; i < code.length; i += 1) {
      const c = code[i];
      if (quote) {
        if (c === '\\') { out += c + (code[i + 1] || ''); i += 1; continue; }
        if (c === quote) { quote = null; out += '"'; continue; }
        out += c === '"' ? '\\"' : c;
        continue;
      }
      if (c === '"' || c === "'") { quote = c; out += '"'; continue; }
      if (c === '#') {
        const end = code.indexOf('\n', i);
        if (end < 0) break;
        i = end;
        continue;
      }
      if (!/\s/.test(c)) out += c;
    }
    return out.replace(/^([A-Za-z.][\w.]*)=(?!=)/, '$1<-');
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
  const inline = text => escapeHtml(text).replace(/`([^`]+)`/g, '<code>$1</code>');
  // `code` becomes <code>; {name} becomes a value RStudio displayed in this run.
  function format(text, values) {
    return `<p>${inline(text)
      .replace(/\{(\w+)\}/g, (_m, name) => {
        if (!(name in values)) throw new Error(`The explanation needs ${name}, which RStudio has not shown yet.`);
        return `<strong>${escapeHtml(values[name])}</strong>`;
      })}</p>`;
  }

  // When the Console's text last changed, sampled from page load (see consoleWatch).
  const consoleClock = {text: null, changedAt: Date.now()};
  function sampleConsole() {
    const text = ide.consoleText();
    if (text !== consoleClock.text) Object.assign(consoleClock, {text, changedAt: Date.now()});
    return text;
  }
  setInterval(sampleConsole, 250);

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
