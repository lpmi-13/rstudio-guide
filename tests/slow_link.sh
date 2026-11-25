#!/bin/bash
# Slow-link check: Guided on lesson 1 over a slow connection that stalls, driven with the
# Playwright CLI (`playwright cli`), as a learner would, through the coach's own buttons.
#
#   tests/slow_link.sh            # needs Docker, Python 3 and @playwright/test (its CLI) installed globally
#
# It provisions lesson 1 on its own slot (gateway on 8798), so it can run beside the other audits,
# and reaches it through tests/slow_link_proxy.py: 20 KB/s down, 10 KB/s up, plus 1.5 s of latency
# per request from Chromium. Then, in Guided:
#   - Show me for step 1 and for both tasks of step 2: each task ticks, by the coach, and step 2
#     says which task is next;
#   - Show me for step 3's chart, with the link stalled for 60 s from while the coach types (twice
#     the 30 s after which the coach used to give up): the coach says it is waiting on a slow
#     connection, and ticks the task once the link flows again, with no error.
# Prints PASS or FAIL for each, and exits 1 if any failed. Leaves the slot's run down afterwards.
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT=$PWD
export LAB_RUN_DIR=run-5 LAB_GATEWAY_PORT=8798 LAB_RSTUDIO_PORT=18797 LAB_COMPOSE_NAME=rstudio-guide-5
PROXY_PORT=8799
OUT=$ROOT/results/slow-link
STALL=$OUT/stall
mkdir -p "$OUT"
rm -f "$STALL"
failed=0
pass() { echo "PASS  $*"; }
fail() { echo "FAIL  $*"; failed=1; }

DISABLE_AUTH=true ./run.sh up 01-data-visualization > "$OUT/up.log" 2>&1 || { echo "FAIL  run.sh up (see $OUT/up.log)"; exit 1; }
python3 -I tests/slow_link_proxy.py "$PROXY_PORT" "$LAB_GATEWAY_PORT" 20480 10240 "$STALL" > "$OUT/proxy.log" 2>&1 &
proxy=$!
cleanup() {
  rm -f "$STALL"
  (cd "$OUT" && timeout 30 playwright cli -s=slowlink close > /dev/null 2>&1)
  kill "$proxy" 2> /dev/null
  ./run.sh down > /dev/null 2>&1
}
trap cleanup EXIT
sleep 1

# The CLI writes .playwright-cli/ into the folder it runs in: results/slow-link, which git ignores.
cli() { (cd "$OUT" && timeout 90 playwright cli -s=slowlink "$@" 2>&1); }
result() { cli eval "$1" | sed -n 2p; } # the value an expression gives, as JSON
# Click the coach button whose label starts with $1, or (with a second argument) contains it. Each
# click finds the button afresh: RStudio re-renders, so references go stale.
press() {
  local ref before=""
  [ $# -gt 1 ] && before='[^"]*'
  ref=$(cli find "$1" | grep -o "button \"$before$1[^\"]*\" \[ref=[^]]*" | head -1 | sed 's/.*ref=//')
  [ -n "$ref" ] && cli click "$ref" > /dev/null
}
GUIDED='() => { const g = window.__rsCoach.guided; const root = document.getElementById("rs-coach-host").shadowRoot;
  return JSON.stringify({done: g ? g.done : {}, showing: g ? g.showing : null, count: root.querySelector(".task-count")?.textContent || "",
    phase: root.querySelector(".phase")?.textContent || "", feedback: root.querySelector(".feedback")?.textContent || ""}); }'
# Wait (up to $2 s) until task $1 ("step.task", from 0) is done and Show me has finished; the states seen go to $OUT/states.log.
wait_task() {
  local t0=$SECONDS state
  while (( SECONDS - t0 < $2 )); do
    state=$(result "$GUIDED")
    echo "$1 $((SECONDS - t0))s $state" >> "$OUT/states.log"
    if grep -q "\\\\\"$1\\\\\":\\\\\"coach\\\\\"" <<< "$state" && grep -q '\\"showing\\":false' <<< "$state"; then echo "$state"; return 0; fi
    grep -q "couldn" <<< "$state" && { echo "$state"; return 1; }
    sleep 3
  done
  echo "$state"
  return 1
}

cli open "http://127.0.0.1:$PROXY_PORT/" > /dev/null
for _ in $(seq 1 100); do [ "$(result '() => Boolean(document.getElementById("rstudio_console_input"))')" = true ] && break; sleep 3; done
cli run-code "async page => { const s = await page.context().newCDPSession(page); await s.send('Network.enable'); await s.send('Network.emulateNetworkConditions', {offline: false, latency: 1500, downloadThroughput: -1, uploadThroughput: -1}); return 'ok'; }" > /dev/null
press "Guided" anywhere
for _ in $(seq 1 60); do [ "$(result '() => Boolean(document.getElementById("rs-coach-host").shadowRoot.querySelector("button.begin")?.offsetParent)')" = true ] && break; sleep 2; done
press "Start Guided" || fail "Guided's overview has no Start Guided button"

press "Show me" && state=$(wait_task 0.0 240) && pass "step 1: Show me over the slow link ticks the task" || fail "step 1: $state"
press "Next: step 2"; sleep 2
press "Show me task 1" && state=$(wait_task 1.0 240) && grep -q "Now task 2" <<< "$state" \
  && pass "step 2: task 1 ticks, and the coach says task 2 is next" || fail "step 2, task 1: $state"
press "Show me task 2" && state=$(wait_task 1.1 240) && pass "step 2: task 2 ticks" || fail "step 2, task 2: $state"
press "Next: step 3"; sleep 2

# Step 3's chart, with the link stalled for 60 s from while the coach types.
press "Show me"
for _ in $(seq 1 40); do grep -q "Writing code" <<< "$(result "$GUIDED")" && break; sleep 1; done
touch "$STALL"
said=""
for _ in $(seq 1 15); do said+=$(result "$GUIDED"); sleep 3; done
rm -f "$STALL"
if grep -q "may be slow" <<< "$said" && ! grep -q "couldn" <<< "$said"; then
  pass "step 3: during a 60 s stall the coach says the connection may be slow, and keeps waiting"
else
  fail "step 3: during the stall: $said"
fi
state=$(wait_task 2.0 300) && pass "step 3: once the link flows again, the chart's task ticks, with no error" || fail "step 3 after the stall: $state"

errors=$(cli console error | grep -ci "uncaught\|pageerror" || true)
[ "${errors:-0}" -eq 0 ] && pass "no page errors" || fail "page errors: see $OUT"
echo "$([ $failed = 0 ] && echo 'all passed' || echo 'some failed'); states seen: $OUT/states.log"
exit $failed
