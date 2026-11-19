#!/usr/bin/env python3
"""Materialize one run of a scenario from scenarios/<id>/scenario.json.

Writes:
  run/project/         the learner's RStudio project (static files, .Rproj and,
                       for a demonstration, the generated demo script)
  run/public/          what the gateway serves to the coach: session.json and,
                       for a demonstration, demo.json with the expected output
  run/private/         the reference run's working files (never mounted)

For a demonstration, every line is first run in a throwaway, network-less
container from the same runtime image. The run is not ready if any line errors,
draws a plot when it shouldn't (or the reverse), or prints output that the
scenario's capture patterns can't read.

  python3 -I tools/provision.py <repo-root> <scenario-id> <runtime-image>
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


def fail(message):
    print(f"provision: {message}", file=sys.stderr)
    sys.exit(1)


def normalise(text):
    return " ".join(text.split())


def render_script(scenario):
    lines = [
        f"# {scenario['title']}",
        f"# {scenario['source']}",
        "#",
        "# The coach runs these lines one at a time. To run a line yourself, put",
        "# the cursor on it and press Ctrl+Enter.",
        "",
    ]
    for number, step in enumerate(scenario["steps"], start=1):
        lines.append(f"# Step {number}. {step['title']}")
        lines.extend(run["code"] for run in step["runs"])
        lines.append("")
    return "\n".join(lines)


def reference_run(scenario, workdir, root, image):
    workdir.mkdir(parents=True)
    runs = [run for step in scenario["steps"] for run in step["runs"]]
    for index, run in enumerate(runs, start=1):
        (workdir / f"run-{index:03d}.R").write_text(run["code"] + "\n")
    command = [
        "docker", "run", "--rm", "--network", "none", "--user", f"{os.getuid()}:{os.getgid()}",
        "--memory", "512m", "--cpus", "1",
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


def main(root, scenario_id, image):
    root = Path(root).resolve()
    source = root / "scenarios" / scenario_id
    if not (source / "scenario.json").is_file():
        fail(f"no scenario named {scenario_id!r}")
    scenario = json.loads((source / "scenario.json").read_text())
    if scenario["id"] != scenario_id:
        fail(f"scenario.json id {scenario['id']!r} does not match its folder")

    run = root / "run"
    project, public, private = run / "project", run / "public", run / "private"
    shutil.copytree(source / "project", project)
    (project / f"{scenario_id}.Rproj").write_text(RPROJ)
    public.mkdir()
    private.mkdir()

    session = {
        "run_id": secrets.token_hex(4),
        "scenario": scenario_id,
        "title": scenario["title"],
        "mode": scenario["mode"],
    }
    if scenario["mode"] == "demonstration":
        (project / scenario["script"]).write_text(render_script(scenario))
        reference_run(scenario, private / "reference", root, image)
        demo = {key: scenario[key] for key in ("title", "intro", "source", "script", "steps")}
        (public / "demo.json").write_text(json.dumps(demo, indent=2))
        session["script"] = scenario["script"]
    (public / "session.json").write_text(json.dumps(session, indent=2))
    print(f"provisioned {scenario_id} ({scenario['mode']}) as run {session['run_id']}")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        fail("usage: provision.py <repo-root> <scenario-id> <runtime-image>")
    main(*sys.argv[1:])
