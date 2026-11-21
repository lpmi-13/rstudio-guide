#!/usr/bin/env python3
"""Run tests/lesson_modes.cjs for many lessons, several at once.

Each slot is a run of its own, side by side with the others: its own folder (run-1, run-2, …),
gateway and RStudio ports, and Docker Compose project, set through run.sh's LAB_* variables. Slot 1
uses run.sh's defaults (run/, port 8788). The runtime image is built once, before any slot starts.
Each lesson's log goes to <results>/<lesson>.log and its screenshots to <results>/<lesson>/; the
summary, one line per lesson, to <results>/summary.txt and the terminal. Each slot's run is stopped
at the end.

  python3 -I tests/run_lesson_audits.py [--jobs N] [--results DIR] [lesson...]

With no lessons, it audits every lesson in the collection that exists, then the two fixtures.
Needs NODE_PATH set to the global node_modules with @playwright/test (NODE_PATH=$(npm root -g)).
"""
import argparse
import os
import queue
import re
import subprocess
import sys
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def slot_env(slot):
    env = dict(os.environ, LAB_PREBUILT="1")  # built once below; a slot must never rebuild it
    if slot > 1:
        env.update(LAB_RUN_DIR=f"run-{slot}", LAB_GATEWAY_PORT=str(8788 + 2 * slot), LAB_RSTUDIO_PORT=str(18787 + 2 * slot),
                   LAB_COMPOSE_NAME=f"rstudio-guide-{slot}")
    return env


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--jobs", type=int, default=3)
    parser.add_argument("--results", default=str(ROOT / "results" / "lessons"))
    parser.add_argument("lessons", nargs="*")
    args = parser.parse_args()
    lessons = args.lessons or subprocess.run([sys.executable, "-I", str(ROOT / "tools" / "collection.py")], check=True,
                                             capture_output=True, text=True).stdout.split() + ["engine-check", "engine-actions"]
    out = Path(args.results).resolve()
    out.mkdir(parents=True, exist_ok=True)

    # The image, once. run.sh builds it when LAB_PREBUILT isn't set; here, so slots don't race to.
    subprocess.run(["docker", "compose", "-p", "rstudio-guide-build", "build", "--quiet", "rstudio"], cwd=ROOT, check=True,
                   env=dict(os.environ, RSTUDIO_PASSWORD="build", LAB_SCENARIO="build"))

    todo = queue.Queue()
    for lesson in lessons:
        todo.put(lesson)
    lock = threading.Lock()
    lines = {}

    def work(slot):
        env = slot_env(slot)
        while True:
            try:
                lesson = todo.get_nowait()
            except queue.Empty:
                break
            started = time.time()
            log = out / f"{lesson}.log"
            with log.open("w") as handle:
                code = subprocess.run(["node", str(ROOT / "tests" / "lesson_modes.cjs"), lesson, str(out / lesson)],
                                      cwd=ROOT, env=env, stdout=handle, stderr=subprocess.STDOUT).returncode
            tail = re.findall(r"^\d+ passed, \d+ failed.*$", log.read_text(), re.M)
            line = f"{lesson}: exit {code}, {time.time() - started:.0f} s, slot {slot}, {tail[-1] if tail else 'no result'}"
            with lock:
                lines[lesson] = line
                print(line, flush=True)
        subprocess.run([str(ROOT / "run.sh"), "down"], cwd=ROOT, env=env, capture_output=True)

    threads = [threading.Thread(target=work, args=(slot,)) for slot in range(1, args.jobs + 1)]
    for thread in threads:
        thread.start()
        time.sleep(20)  # stagger the starts: Docker changing the host network at once confuses Chromium
    for thread in threads:
        thread.join()
    summary = [lines[lesson] for lesson in lessons if lesson in lines]
    (out / "summary.txt").write_text("\n".join(summary) + "\n")
    failed = [line for line in summary if not line.split(": exit ")[1].startswith("0,")]
    print(f"\n{len(summary) - len(failed)} of {len(summary)} lessons passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
