#!/usr/bin/env python3
"""Materialize one run of one or more scenarios from scenarios/<id>/scenario.json.

Writes:
  run/project/         the learner's RStudio project (static files, .Rproj and,
                       for each lesson with steps, the generated script)
  run/public/          what the gateway serves to the coach: session.json and,
                       for lessons with steps, steps.json with the expected output
  run/private/         the reference run's working files (never mounted)

Several lessons with steps can share one run and project; the learner chooses a
lesson and one of its modes (Demonstration, Guided, Solo) in the coach. Every
line is first run in a throwaway, network-less container from the same runtime
image. The run is not ready if any line errors, draws a plot when it shouldn't
(or the reverse), or prints output that the lesson's capture patterns can't read.

  python3 -I tools/provision.py <repo-root> <runtime-image> <project-name> <scenario-id>...
"""
import json
import os
import re
import secrets
import shutil
import subprocess
import sys
from pathlib import Path

RPROJ = """Version: 1.0

RestoreWorkspace: No
SaveWorkspace: No
AlwaysSaveHistory: No

EnableCodeIndexing: Yes
UseSpacesForTab: Yes
NumSpacesForTab: 2
Encoding: UTF-8
"""


MODES = ("demonstration", "guided", "solo")


def fail(message):
    print(f"provision: {message}", file=sys.stderr)
    sys.exit(1)


def normalise(text):
    return " ".join(text.split())


def heading(number, step):
    return f"# Step {number}. {step['title']}"


def strip_comment(code):
    """The code before an R comment, ignoring # inside strings."""
    quote = None
    for i, ch in enumerate(code):
        if quote:
            if ch == quote and code[i - 1] != "\\":
                quote = None
        elif ch in "\"'":
            quote = ch
        elif ch == "#":
            return code[:i].rstrip()
    return code.rstrip()


def partial(code):
    """A hint that shows how a line starts: plot(5, 5) -> plot(…), x <- y -> x <- …"""
    line = strip_comment(code)
    if "(" in line:
        return line[: line.index("(") + 1] + "…)"
    if "<-" in line:
        return line[: line.index("<-") + 2] + " …"
    return "…"


def render_script(scenario):
    """The script starts with only the step headings. Each step's code goes below
    its heading: typed by the coach in Demonstration, by the learner otherwise."""
    lines = [
        f"# {scenario['title']}",
        f"# {scenario['source']}",
        "#",
        "# Each step's code goes below its heading. To run a line, put the cursor on",
        "# it and press Ctrl+Enter (or click Run).",
        "",
    ]
    for number, step in enumerate(scenario["steps"], start=1):
        lines.append(heading(number, step))
        lines.append("")
    return "\n".join(lines)


def reference_run(scenario, workdir, root, image):
    workdir.mkdir(parents=True)
    runs = [run for step in scenario["steps"] for run in step["runs"]]
    for index, run in enumerate(runs, start=1):
        (workdir / f"run-{index:03d}.R").write_text(run["code"] + "\n")
    command = [
        "docker", "run", "--rm", "--network", "none", "--user", f"{os.getuid()}:{os.getgid()}",
        "--memory", "512m", "--cpus", "1", "--pids-limit", "256",
        "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--read-only", "--tmpfs", "/tmp",
        "-v", f"{workdir}:/ref",
        "-v", f"{root / 'runtime' / 'reference.R'}:/opt/lab/reference.R:ro",
        image, "timeout", "60", "Rscript", "/opt/lab/reference.R", "/ref",
    ]
    result = subprocess.run(command, capture_output=True, text=True)
    for index, run in enumerate(runs, start=1):
        err = workdir / f"run-{index:03d}.err"
        if err.exists():
            fail(f"reference run failed on `{run['code']}`: {err.read_text().strip()}")
    if result.returncode != 0:
        fail(f"reference run exited {result.returncode}: {result.stderr.strip()[-400:]}")
    for index, run in enumerate(runs, start=1):
        output = (workdir / f"run-{index:03d}.out").read_text().rstrip("\n")
        plotted = (workdir / f"run-{index:03d}.plot").read_text().strip() == "1"
        if plotted != (run["evidence"] == "plot"):
            fail(f"`{run['code']}` {'drew' if plotted else 'did not draw'} a plot, "
                 f"but its evidence is {run['evidence']!r}")
        run["expected_output"] = output
        run["expected_values"] = {}
        for name, pattern in run.get("capture", {}).items():
            match = re.search(pattern, normalise(output))
            if not match:
                fail(f"capture {name!r} does not match the output of `{run['code']}`: {output!r}")
            run["expected_values"][name] = match.group(1)


def load(root, scenario_id):
    source = root / "scenarios" / scenario_id
    if not (source / "scenario.json").is_file():
        fail(f"no scenario named {scenario_id!r}")
    scenario = json.loads((source / "scenario.json").read_text())
    if scenario["id"] != scenario_id:
        fail(f"scenario.json id {scenario['id']!r} does not match its folder")
    modes = scenario.get("modes") or []
    if not modes or any(mode not in MODES for mode in modes):
        fail(f"{scenario_id}: modes must be a non-empty list drawn from {', '.join(MODES)}; got {modes!r}")
    script = scenario.get("script")
    if script is not None and (not isinstance(script, str) or Path(script).name != script or script in (".", "..")):
        fail(f"{scenario_id}: script must be a plain file name in the project; got {script!r}")
    return scenario, source / "project"


def copy_project(source, project, skip=()):
    """Copy a scenario's static files into the run's project, refusing to overwrite."""
    for path in sorted(source.rglob("*")):
        rel = path.relative_to(source)
        # A symlink would copy whatever it points to on this machine into the learner's project.
        if path.is_symlink():
            fail(f"{rel} in {source} is a symlink; lesson files must be regular files")
        if path.is_dir() or str(rel) in skip:
            continue
        target = project / rel
        if target.exists():
            fail(f"two lessons both provide {rel}")
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)


def prepare_lesson(scenario, project, workdir, root, image):
    """Write the lesson's script, run its reference, and return what the coach needs."""
    modes = scenario["modes"]
    for step in scenario["steps"]:
        for run in step["runs"]:
            if ("guided" in modes or "solo" in modes) and not run.get("task"):
                fail(f"`{run['code']}` needs a task: Guided and Solo show it instead of the code")
            if ("demonstration" in modes or "guided" in modes) and not run.get("purpose"):
                fail(f"`{run['code']}` needs a purpose: Demonstration and Show me say "
                     f"\"Writing code to <purpose>\" while they type it")
    if (project / scenario["script"]).exists():
        fail(f"two lessons both use {scenario['script']}")
    (project / scenario["script"]).write_text(render_script(scenario))
    reference_run(scenario, workdir, root, image)
    for number, step in enumerate(scenario["steps"], start=1):
        step["heading"] = heading(number, step)
        for run in step["runs"]:
            run["hint_partial"] = partial(run["code"])
            run["hint_line"] = strip_comment(run["code"])
    return {key: scenario[key] for key in ("id", "title", "summary", "source", "script", "modes", "steps")}


def render_readme(lessons):
    lines = ["# Lessons", ""]
    for lesson in lessons:
        lines += [f"- `{lesson['script']}`: {lesson['title']}. {lesson['summary']}"]
    lines += ["", "Choose a lesson and a mode in the Coach pane on the right. Each lesson's code",
              "goes below its step headings in its script. To run a line, put the cursor on it",
              "and press Ctrl+Enter, or click **Run**.", ""]
    return "\n".join(lines)


def main(root, image, project_name, *scenario_ids):
    root = Path(root).resolve()
    scenarios = [load(root, scenario_id) for scenario_id in scenario_ids]
    several = len(scenarios) > 1
    if several and any("steps" not in scenario for scenario, _ in scenarios):
        fail("only lessons with steps can share a run")

    run = root / "run"
    project, public, private = run / "project", run / "public", run / "private"
    for folder in (project, public, private):
        folder.mkdir(parents=True)
    # Lessons that share a run get one README listing them all.
    for _, source in scenarios:
        copy_project(source, project, skip={"README.md"} if several else ())
    (project / f"{project_name}.Rproj").write_text(RPROJ)

    session = {"run_id": secrets.token_hex(4), "project": project_name}
    first = scenarios[0][0]
    if "steps" not in first:
        # regional-revenue has no steps yet: its Guided mode is a stub with a Check work button.
        session.update(scenario=first["id"], title=first["title"], modes=first["modes"])
    else:
        lessons = [prepare_lesson(scenario, project, private / "reference" / scenario["id"], root, image)
                   for scenario, _ in scenarios]
        if several:
            (project / "README.md").write_text(render_readme(lessons))
        (public / "steps.json").write_text(json.dumps({"lessons": lessons}, indent=2))
        session["lessons"] = [{key: lesson[key] for key in ("id", "title", "script", "modes")} for lesson in lessons]
    (public / "session.json").write_text(json.dumps(session, indent=2))
    print(f"provisioned {', '.join(scenario_ids)} in {project_name} as run {session['run_id']}")


if __name__ == "__main__":
    if len(sys.argv) < 5:
        fail("usage: provision.py <repo-root> <runtime-image> <project-name> <scenario-id>...")
    main(*sys.argv[1:])
