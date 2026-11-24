#!/usr/bin/env python3
"""Bake each lesson's reference results: what every statement prints, its fingerprint, the chart
it draws, the files it writes and the values its explanation quotes.

Each lesson runs twice, in two throwaway containers from the runtime image with no network
(runtime/bake.R does the work). The bake fails on an error, an undeclared warning, a chart where
none is expected or the reverse, missing evidence, an alternative that gives a different value,
code Air would format differently (lessons with "version": 2), or any difference between the two
runs (a statement that needs set.seed() or "pattern" evidence).

Results go to content/lessons/baked/<lesson>.json with a stamp: hashes of the executable
lesson plan, project files, world's data, package lock, evidence.R, bake.R and Dockerfile.
Changes to a summary, task or explanation do not re-run R during playground startup.
They are committed, so a package upgrade shows up as a reviewable diff. provision.py uses a baked
file whose stamp matches and bakes again otherwise, so a run's start-up runs nothing.

  python3 -I tools/bake.py <runtime-image> [--force] [--jobs N] <lesson-id>...
"""
import concurrent.futures
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BAKE_FORMAT = 1  # bump when the baked file's shape changes
WORLD_IMAGE_PATH = "/opt/lab/world"
WORLD_LINKS = ("trips.csv", "archive", "larkhaven.duckdb")  # big files that exist only in the image
EVIDENCE = ("console", "plot", "value", "assign", "ggplot", "attached", "pattern", "file", "ide", "error")


class BakeError(Exception):
    pass


def sha_file(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def sha_tree(path):
    """One hash for a file or folder: every file's path and contents."""
    h = hashlib.sha256()
    files = [path] if path.is_file() else sorted(p for p in path.rglob("*") if p.is_file())
    for f in files:
        h.update(str(f.relative_to(path.parent if path.is_file() else path)).encode())
        h.update(b"\0")
        h.update(sha_file(f).encode())
    return h.hexdigest()


def stamp(root, scenario_id, scenario):
    # Provision adds generated scripts and expected values to `scenario` in memory. Hash the
    # source file's bake inputs so the same stamp works in both provision and a standalone bake.
    source = json.loads((root / "scenarios" / scenario_id / "scenario.json").read_text())
    plan = {"runs": statements(source), "version": source.get("version"), "script": source.get("script"),
            "starter": source.get("starter"), "world": source.get("world"), "bake": source.get("bake")}
    project = root / "scenarios" / scenario_id / "project"
    parts = {
        "format": str(BAKE_FORMAT),
        "lesson": hashlib.sha256(json.dumps(plan, sort_keys=True, ensure_ascii=False).encode()).hexdigest(),
        "project": sha_tree(project) if project.is_dir() else "",
        "packages": sha_file(root / "runtime" / "packages.lock"),
        "evidence": sha_file(root / "runtime" / "evidence.R"),
        "runner": sha_file(root / "runtime" / "bake.R"),
        "image": sha_file(root / "runtime" / "Dockerfile"),
    }
    if scenario.get("world"):
        parts["world"] = sha_tree(root / "content" / "world")
    return parts


def layout_world(root, project):
    """The lessons' data in a project: a copy of the small files and links to the big ones, which
    exist only in the runtime image."""
    data = project / "data"
    shutil.copytree(root / "content" / "world" / "data", data)
    for name in WORLD_LINKS:
        (data / name).symlink_to(f"{WORLD_IMAGE_PATH}/{name}")


def statements(scenario):
    """The lesson's statements in order, as bake.R reads them."""
    runs = []
    for number, step in enumerate(scenario["steps"], start=1):
        for run in step["runs"]:
            item = {key: run[key] for key in ("code", "action", "menu", "path", "file", "evidence", "warning", "error",
                                              "pattern", "order", "values", "capture", "alternatives", "text", "after") if key in run}
            item.update(index=len(runs), step=step["id"], heading=f"# Step {number}. {step['title']}")
            runs.append(item)
    return runs


def run_container(image, workdir, limits):
    cmd = [
        "docker", "run", "--rm", "--network", "none", "--user", f"{os.getuid()}:{os.getgid()}",
        "--memory", limits.get("memory", "2g"), "--cpus", str(limits.get("cpus", 2)), "--pids-limit", "512",
        "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--read-only",
        "--tmpfs", "/tmp:rw,exec,size=2g", "-e", "HOME=/tmp",
        "-v", f"{workdir}:/work", "-w", "/work/project",
        image, "timeout", str(limits.get("timeout", 600)), "Rscript", "/opt/lab/bake.R", "/work/plan.json", "/work/out.json",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    out = workdir / "out.json"
    if not out.exists():
        raise BakeError(f"bake.R exited {result.returncode} without a result: {result.stderr.strip()[-800:]}")
    baked = json.loads(out.read_text())
    if baked["failures"]:
        raise BakeError("\n  ".join(baked["failures"]))
    if result.returncode != 0:
        raise BakeError(f"bake.R exited {result.returncode}: {result.stderr.strip()[-800:]}")
    return baked


# What must be the same in both runs. Output, value and fingerprint are allowed to differ only for
# "pattern" evidence (today(), timings), which is matched by a regular expression.
COMPARED = ("output", "fp", "fp_any", "assigned", "library", "plot", "files", "values", "error", "warnings", "alternatives")


def differences(a, b, plan):
    found = []
    for x, y, item in zip(a["runs"], b["runs"], plan):
        for key in COMPARED:
            if item.get("evidence") == "pattern" and key in ("output", "fp", "fp_any", "values", "alternatives"):
                continue
            # Row order is allowed to differ where the check ignores it: a database returns the groups
            # of a GROUP BY, and tied rows, in any order.
            if item.get("order") == "any" and key in ("output", "fp"):
                continue
            if item.get("order") == "any" and key == "alternatives":
                strip = lambda alts: [{k: v for k, v in alt.items() if k != "fp"} for alt in alts or []]
                if strip(x.get(key)) != strip(y.get(key)):
                    found.append(f"step {item['step']}, alternatives differ between two runs")
                continue
            if x.get(key) != y.get(key):
                code = (item.get("code") or f"action {item.get('action')}").split("\n")[0][:60]
                found.append(f"step {item['step']}, `{code}`: {key} differs between two runs")
    if len(a["runs"]) != len(b["runs"]):
        found.append(f"one run baked {len(a['runs'])} statements and the other {len(b['runs'])}")
    return found


def bake(root, image, scenario_id, scenario):
    plan = statements(scenario)
    limits = scenario.get("bake", {})
    with tempfile.TemporaryDirectory(prefix=f"bake-{scenario_id}-") as tmp:
        workdirs = []
        for n in (1, 2):
            work = Path(tmp) / f"run{n}"
            project = work / "project"
            source = root / "scenarios" / scenario_id / "project"
            if source.is_dir():
                shutil.copytree(source, project, symlinks=False)
            else:
                project.mkdir(parents=True)
            if scenario.get("world"):
                layout_world(root, project)
            if isinstance(scenario.get("starter"), str):  # a Quarto lesson's document, which its steps edit and render
                (project / scenario["script"]).write_text(scenario["starter"])
            (work / "plan.json").write_text(json.dumps({"lesson": scenario_id, "strict": scenario.get("version") == 2,
                                                        "script": scenario.get("script"), "runs": plan}))
            workdirs.append(work)
        with concurrent.futures.ThreadPoolExecutor(2) as pool:
            first, second = pool.map(lambda w: run_container(image, w, limits), workdirs)
    diff = differences(first, second, plan)
    if diff:
        raise BakeError("the two runs differ:\n  " + "\n  ".join(diff))
    return {"lesson": scenario_id, "r": first["r"], "runs": first["runs"]}


def load_scenario(root, scenario_id):
    path = root / "scenarios" / scenario_id / "scenario.json"
    if not path.is_file():
        raise BakeError(f"no scenario named {scenario_id!r}")
    return json.loads(path.read_text())


def baked_path(root, scenario_id):
    return root / "content" / "lessons" / "baked" / f"{scenario_id}.json"


def ensure(root, image, scenario_id, scenario=None, force=False, log=print):
    """The lesson's baked results: from its file when the stamp matches, otherwise baked now."""
    scenario = scenario or load_scenario(root, scenario_id)
    want = stamp(root, scenario_id, scenario)
    path = baked_path(root, scenario_id)
    if path.exists() and not force:
        baked = json.loads(path.read_text())
        if baked.get("stamp") == want:
            return baked
        changed = sorted(k for k in want if baked.get("stamp", {}).get(k) != want[k])
        log(f"bake: {scenario_id}: re-baking ({', '.join(changed)} changed)")
    else:
        log(f"bake: {scenario_id}: baking")
    baked = {"stamp": want, **bake(root, image, scenario_id, scenario)}
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(baked, indent=1, sort_keys=True, ensure_ascii=False) + "\n")
    tmp.replace(path)
    return baked


def main(argv):
    force = "--force" in argv
    argv = [a for a in argv if a != "--force"]
    jobs = max(1, (os.cpu_count() or 2) // 2)
    if "--jobs" in argv:
        i = argv.index("--jobs")
        jobs = int(argv[i + 1])
        del argv[i:i + 2]
    if len(argv) < 2:
        print(__doc__.strip().splitlines()[-1], file=sys.stderr)
        return 2
    image, ids = argv[0], argv[1:]
    failed = []

    def one(scenario_id):
        try:
            ensure(ROOT, image, scenario_id, force=force)
            return None
        except BakeError as error:
            return f"{scenario_id}: {error}"

    with concurrent.futures.ThreadPoolExecutor(jobs) as pool:
        for result in pool.map(one, ids):
            if result:
                failed.append(result)
                print(f"bake: {result}", file=sys.stderr)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
