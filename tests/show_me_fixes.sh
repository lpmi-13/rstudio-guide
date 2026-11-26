#!/bin/bash
# Show me fixes the learner's own code, driven with the Playwright CLI (`playwright cli`) as a learner
# would: lesson 1 in Guided, with attempts written in the script under their step's heading and run
# with Ctrl+Enter, then Show me. For each, the script must end up with the task's statement once,
# where the attempt was, and the task must tick as the coach's:
#   - step 1, library(tidyvers): fixed in place (one character typed);
#   - step 4, the chart on one line with alphas = 0.3: fixed in place, into the task's three lines;
#   - step 6, a bar chart mostly unlike the task's: selected and written over.
# Runs on its own slot (gateway on 8794).
#
#   tests/show_me_fixes.sh     # needs Docker, Python 3 and @playwright/test (its CLI) installed globally
set -uo pipefail
cd "$(dirname "$0")/.."
export LAB_RUN_DIR=run-3 LAB_GATEWAY_PORT=8794 LAB_RSTUDIO_PORT=18793 LAB_COMPOSE_NAME=rstudio-guide-3
OUT=$PWD/results/show-me-fixes
mkdir -p "$OUT"
failed=0
pass() { echo "PASS  $*"; }
fail() { echo "FAIL  $*"; failed=1; }

DISABLE_AUTH=true ./run.sh up 01-data-visualization > "$OUT/up.log" 2>&1 || { echo "FAIL  run.sh up (see $OUT/up.log)"; exit 1; }
cleanup() { (cd "$OUT" && timeout 30 playwright cli -s=fixes close > /dev/null 2>&1); ./run.sh down > /dev/null 2>&1; }
trap cleanup EXIT

cli() { (cd "$OUT" && timeout 90 playwright cli -s=fixes "$@" 2>&1); }
result() { cli eval "$1" | sed -n 2p; }
press() {
  local ref before=""
  [ $# -gt 1 ] && before='[^"]*'
  ref=$(cli find "$1" | grep -o "button \"$before$1[^\"]*\" \[ref=[^]]*" | head -1 | sed 's/.*ref=//')
  [ -n "$ref" ] && cli click "$ref" > /dev/null
}
console() {
  cli eval '() => { document.querySelector("#rstudio_console_input .ace_text-input").focus(); return true; }' > /dev/null
  cli type "$1" > /dev/null
  cli press Enter > /dev/null
}
# The learner clicks at the end of step $1's heading in the script, starts a new line, types $2 and
# runs it with Ctrl+Enter. (Placing the cursor uses the editor RStudio shows, as a click would.)
in_script() {
  cli eval "() => { const ed = document.querySelector('#rstudio_Source_pane .ace_editor:not(.ace_autocomplete)').env.editor;
    const row = ed.session.getDocument().getAllLines().findIndex(l => l.startsWith('# Step $1. '));
    ed.focus(); ed.clearSelection(); ed.moveCursorTo(row, ed.session.getLine(row).length); return row; }" > /dev/null
  cli press Enter > /dev/null
  cli type "$2" > /dev/null
  cli press Control+Enter > /dev/null
}
# The script's lines under step $1's heading, up to the next heading, without blank ones (JSON).
under() {
  result "() => { const lines = document.querySelector('#rstudio_Source_pane .ace_editor:not(.ace_autocomplete)').env.editor.session.getDocument().getAllLines();
    const at = lines.findIndex(l => l.startsWith('# Step $1. ')); const end = lines.findIndex((l, r) => r > at && /^# Step /.test(l));
    return JSON.stringify(lines.slice(at + 1, end < 0 ? lines.length : end).filter(l => l.trim())); }"
}
done_by() { result "() => window.__rsCoach.guided?.done['$1'] || ''"; }
wait_done() { for _ in $(seq 1 60); do [ -n "$(done_by "$1" | tr -d '"')" ] && [ "$(result '() => window.__rsCoach.guided.showing')" = false ] && return 0; sleep 2; done; return 1; }
fixes() { result "() => JSON.stringify(window.__rsCoach.log.filter(e => e.type === 'demo_action' && /fix_attempt|replace_attempt/.test(e.action)).map(e => e.action + ':' + (e.changes ?? '') ))"; }
feedback() { for _ in $(seq 1 20); do [ -n "$(result '() => document.getElementById("rs-coach-host").shadowRoot.querySelector(".feedback")?.textContent' | tr -d '"')" ] && return 0; sleep 2; done; return 1; }

cli open "http://127.0.0.1:$LAB_GATEWAY_PORT/" > /dev/null
for _ in $(seq 1 60); do [ "$(result '() => Boolean(document.getElementById("rstudio_console_input"))')" = true ] && break; sleep 3; done
press "Guided" anywhere
for _ in $(seq 1 60); do [ "$(result '() => Boolean(document.getElementById("rs-coach-host").shadowRoot.querySelector("button.begin")?.offsetParent)')" = true ] && break; sleep 2; done
press "Start Guided"; sleep 2

# Step 1: a typo, fixed in place.
in_script 1 'library(tidyvers)'; feedback
press "Show me"; wait_done 0.0
lines=$(under 1)
if [ "$lines" = '"[\"library(tidyverse)\"]"' ] && [ "$(done_by 0.0)" = '"coach"' ] && grep -q 'fix_attempt:1' <<< "$(fixes)"; then
  pass "step 1: Show me fixed library(tidyvers) in place, with one change, and the task ticked"
else
  fail "step 1: lines $lines, done by $(done_by 0.0), fixes $(fixes)"
fi
cli screenshot --filename="$OUT/step1-fixed.png" > /dev/null

press "Next: step 2"; sleep 1
console 'week <- read_csv("data/trips-week.csv")'; console 'glimpse(week)'
sleep 4; press "Next: step 3"; sleep 1
console 'ggplot(week, aes(x = distance_km, y = duration_min)) + geom_point()'
sleep 4; press "Next: step 4"; sleep 1

# Step 4: the chart on one line, with alphas: fixed in place into the task's three lines.
in_script 4 'ggplot(week, aes(x = distance_km, y = duration_min, colour = bike_type)) + geom_point(alphas = 0.3) + geom_smooth(method = "lm")'
feedback
press "Show me"; wait_done 3.0
lines=$(under 4)
want='"[\"ggplot(week, aes(x = distance_km, y = duration_min, colour = bike_type)) +\",\"  geom_point(alpha = 0.3) +\",\"  geom_smooth(method = \\\"lm\\\")\"]"'
if [ "$lines" = "$want" ] && [ "$(done_by 3.0)" = '"coach"' ] && grep -q 'fix_attempt' <<< "$(fixes)"; then
  pass "step 4: Show me fixed the one-line chart with alphas in place, into the task's three lines"
else
  fail "step 4: lines $lines, done by $(done_by 3.0), fixes $(fixes)"
fi
LINK_SHOWN='() => { const svg = document.getElementById("rs-coach-overlay")?.shadowRoot.querySelector(".link"); return Boolean(svg && getComputedStyle(svg).display !== "none"); }'
[ "$(result "$LINK_SHOWN")" = false ] && pass "step 4: the link from the alphas warning goes once Show me has fixed the code" || fail "step 4: the link is still on screen"
cli screenshot --filename="$OUT/step4-fixed.png" > /dev/null

press "Next: step 5"; sleep 1
console 'ggplot(week, aes(x = distance_km, y = duration_min, colour = bike_type)) + geom_point(alpha = 0.3) + geom_smooth(method = "lm") + scale_colour_viridis_d(end = 0.8) + labs(title = "E-bikes cover the same distance faster", x = "Distance (km)", y = "Duration (minutes)", colour = "Bike type")'
console 'ggsave("distance-duration.png", width = 7, height = 5)'
sleep 6; press "Next: step 6"; sleep 1

# Step 6: an attempt mostly unlike the task's: selected and written over.
in_script 6 'ggplot(week, aes(y = bike_type, fill = member_type)) + geom_col(width = 1)'
feedback
press "Show me task 1"; wait_done 5.0
lines=$(under 6)
if [ "$lines" = '"[\"ggplot(week, aes(x = member_type)) +\",\"  geom_bar()\"]"' ] && [ "$(done_by 5.0)" = '"coach"' ] && grep -q 'replace_attempt' <<< "$(fixes)"; then
  pass "step 6: Show me selected a mostly different attempt and wrote the task's code over it"
else
  fail "step 6: lines $lines, done by $(done_by 5.0), fixes $(fixes)"
fi

errors=$(cli console error | grep -ci "uncaught\|pageerror" || true)
[ "${errors:-0}" -eq 0 ] && pass "no page errors" || fail "page errors: see $OUT"
echo "$([ $failed = 0 ] && echo 'all passed' || echo 'some failed'); screenshots in $OUT"
exit $failed
