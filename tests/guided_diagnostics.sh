#!/bin/bash
# Guided's diagnoses, driven with the Playwright CLI (`playwright cli`) as a learner would: lesson 1
# in Guided, with the slips a learner makes typed at the Console prompt. For each, the coach's
# feedback must say what is wrong in the learner's terms, and for a wrong name, link that name in R's
# message to the same name in the code (two boxes and a line in the coach's overlay):
#   - library(tidyvers): no package called tidyvers, did you mean tidyverse;
#   - read_csv("data/trips-wek.csv"): no such file, did you mean data/trips-week.csv;
#   - aes(x = distance_dm): R can't find distance_dm, did you mean distance_km;
#   - geom_point(alphas = 0.3): ggplot2 ignored alphas, did you mean alpha (a chart drawn wrong, no error);
#   - step 4 without geom_smooth(): the code doesn't use geom_smooth() yet.
# Each slip is then put right, and the task must tick. Runs on its own slot (gateway on 8796).
#
#   tests/guided_diagnostics.sh     # needs Docker, Python 3 and @playwright/test (its CLI) installed globally
set -uo pipefail
cd "$(dirname "$0")/.."
export LAB_RUN_DIR=run-4 LAB_GATEWAY_PORT=8796 LAB_RSTUDIO_PORT=18795 LAB_COMPOSE_NAME=rstudio-guide-4
OUT=$PWD/results/guided-diagnostics
mkdir -p "$OUT"
failed=0
pass() { echo "PASS  $*"; }
fail() { echo "FAIL  $*"; failed=1; }

DISABLE_AUTH=true ./run.sh up 01-data-visualization > "$OUT/up.log" 2>&1 || { echo "FAIL  run.sh up (see $OUT/up.log)"; exit 1; }
cleanup() { (cd "$OUT" && timeout 30 playwright cli -s=diagnose close > /dev/null 2>&1); ./run.sh down > /dev/null 2>&1; }
trap cleanup EXIT

cli() { (cd "$OUT" && timeout 90 playwright cli -s=diagnose "$@" 2>&1); }
result() { cli eval "$1" | sed -n 2p; }
press() {
  local ref before=""
  [ $# -gt 1 ] && before='[^"]*'
  ref=$(cli find "$1" | grep -o "button \"$before$1[^\"]*\" \[ref=[^]]*" | head -1 | sed 's/.*ref=//')
  [ -n "$ref" ] && cli click "$ref" > /dev/null
}
# Type a statement at the Console prompt and run it, as a learner would.
console() {
  cli eval '() => { document.querySelector("#rstudio_console_input .ace_text-input").focus(); return true; }' > /dev/null
  cli type "$1" > /dev/null
  cli press Enter > /dev/null
}
FEEDBACK='() => document.getElementById("rs-coach-host").shadowRoot.querySelector(".feedback")?.textContent || ""'
# Whether the link shows both boxes (R's message and the code) and the line between them.
LINKED='() => { const svg = document.getElementById("rs-coach-overlay")?.shadowRoot.querySelector(".link");
  return Boolean(svg && !svg.hidden && [".said", ".wrote", "path"].every(s => svg.querySelector(s).style.display !== "none")); }'
# Wait (up to 40 s) for feedback matching $1; prints it.
feedback() {
  local text=""
  for _ in $(seq 1 20); do text=$(result "$FEEDBACK"); grep -qE "$1" <<< "$text" && { echo "$text"; return 0; }; sleep 2; done
  echo "$text"; return 1
}
# Wait (up to 60 s) for task $1 ("step.task") to be done by the learner.
ticked() {
  for _ in $(seq 1 30); do [ "$(result "() => window.__rsCoach.guided?.done['$1'] || ''")" = '"learner"' ] && return 0; sleep 2; done
  return 1
}
# One slip: run $2, expect feedback matching $3 (and the link, if $4 is "link"), shot to $OUT/$1.png.
slip() {
  local text
  console "$2"
  if text=$(feedback "$3"); then
    if [ "${4:-}" = link ]; then
      sleep 1
      if [ "$(result "$LINKED")" = true ]; then pass "$1: $text (linked)"; else fail "$1: no link between R's message and the code: $text"; fi
    else
      pass "$1: $text"
    fi
  else
    fail "$1: the feedback was: $text"
  fi
  cli screenshot --filename="$OUT/$1.png" > /dev/null
}

cli open "http://127.0.0.1:$LAB_GATEWAY_PORT/" > /dev/null
for _ in $(seq 1 60); do [ "$(result '() => Boolean(document.getElementById("rstudio_console_input"))')" = true ] && break; sleep 3; done
press "Guided" anywhere
for _ in $(seq 1 60); do [ "$(result '() => Boolean(document.getElementById("rs-coach-host").shadowRoot.querySelector("button.begin")?.offsetParent)')" = true ] && break; sleep 2; done
press "Start Guided"
sleep 2

slip package 'library(tidyvers)' 'no package called `?tidyvers`?\. Did you mean `?tidyverse`?' link
console 'library(tidyverse)'; ticked 0.0 && pass "step 1 ticks once put right" || fail "step 1 didn't tick"
press "Next: step 2"; sleep 2
slip file 'week <- read_csv("data/trips-wek.csv")' "no file .*trips-wek.csv.*Did you mean .*data/trips-week.csv" link
console 'week <- read_csv("data/trips-week.csv")'; ticked 1.0 && pass "step 2's first task ticks once put right" || fail "step 2, task 1 didn't tick"
console 'glimpse(week)'; ticked 1.1 || fail "step 2, task 2 didn't tick"
press "Next: step 3"; sleep 2
slip column 'ggplot(week, aes(x = distance_dm, y = duration_min)) + geom_point()' "can't find .?distance_dm.?\. Did you mean .?distance_km" link
console 'ggplot(week, aes(x = distance_km, y = duration_min)) + geom_point()'; ticked 2.0 && pass "step 3 ticks once put right" || fail "step 3 didn't tick"
press "Next: step 4"; sleep 2
slip setting 'ggplot(week, aes(x = distance_km, y = duration_min, colour = bike_type)) + geom_point(alphas = 0.3) + geom_smooth(method = "lm")' \
  "ggplot2 ignored .?alphas.*Did you mean .?alpha" link
slip layer 'ggplot(week, aes(x = distance_km, y = duration_min, colour = bike_type)) + geom_point(alpha = 0.3)' "doesn't use .?geom_smooth\(\).? yet"
console 'ggplot(week, aes(x = distance_km, y = duration_min, colour = bike_type)) + geom_point(alpha = 0.3) + geom_smooth(method = "lm")'
ticked 3.0 && pass "step 4 ticks once put right" || fail "step 4 didn't tick"

errors=$(cli console error | grep -ci "uncaught\|pageerror" || true)
[ "${errors:-0}" -eq 0 ] && pass "no page errors" || fail "page errors: see $OUT"
echo "$([ $failed = 0 ] && echo 'all passed' || echo 'some failed'); screenshots in $OUT"
exit $failed
