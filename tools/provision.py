#!/usr/bin/env python3
"""Materialize one run of one or more scenarios from scenarios/<id>/scenario.json.

Writes:
  run/project/         the learner's RStudio project (static files, .Rproj, data/ for lessons
                       that use the Larkhaven Bikes data and, for each lesson with steps, the
                       generated script)
  run/public/          what the gateway serves to the coach: session.json and, for lessons
                       with steps, steps.json with each statement's reference results and each
                       script's starting text

Several lessons with steps can share one run and project; the learner chooses a lesson and one of
its modes (Demonstration, Guided, Solo) in the coach. The reference results come from the bake
(tools/bake.py): its committed file when the stamp matches, otherwise it bakes the lesson now, in
throwaway, network-less containers from the same runtime image. The run is not ready if the bake
fails.

Lessons with "version": 2 (the ones modelled on R for Data Science) give the coach fingerprints
rather than expected output, so their answers aren't in the page.

  python3 -I tools/provision.py <repo-root> <runtime-image> <project-name> <scenario-id>...
"""
import importlib.util
import json
import os
import re
import secrets
import shutil
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


BLANK = "___"
# R's words that are syntax, not values: they stay in a hint.
KEYWORDS = {"function", "if", "else", "for", "in", "while", "repeat", "break", "next", "return"}
TOKEN = re.compile(r"""
    (?P<string>"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')
  | (?P<number>(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?L?)
  | (?P<name>`[^`]+`|[A-Za-z][\w.]*|\.[A-Za-z_][\w.]*)
  | (?P<other>.)
""", re.VERBOSE | re.DOTALL)


def blanks(code):
    """The second hint for a statement: its code with each value left blank, so it shows which
    functions and arguments to use, and how the statement is built, without the answer:
    ggplot(week, aes(x = member_type)) + geom_bar() -> ggplot(___, aes(x = ___)) + geom_bar().
    Function names, argument names (name = …), the name a statement assigns, package names before
    ::, R's keywords, operators, brackets and empty strings stay; names, strings and numbers become
    ___ (a string keeps its quotes). None when there is nothing to blank out, as in today()."""
    text = whole(code)
    out = []
    tokens = list(TOKEN.finditer(text))
    for i, m in enumerate(tokens):
        kind, value = m.lastgroup, m.group()
        rest = text[m.end():]
        if kind == "string":
            out.append(value if len(value) == 2 else value[0] + BLANK + value[-1])  # "" stays "": nothing goes there
        elif kind == "number":
            out.append(BLANK)
        elif kind == "name":
            before = "".join(t.group() for t in tokens[:i]).rstrip()
            assigned = re.match(r"\s*(<-|=(?!=))", rest) and (not before or before.endswith("\n"))
            keep = (value in KEYWORDS or re.match(r"\s*\(", rest) or re.match(r"\s*=(?!=)", rest)
                    or rest.startswith("::") or assigned)
            out.append(value if keep else BLANK)
        else:
            out.append(value)
    hint = "".join(out)
    return None if hint == text else hint


def whole(code):
    """The statement without comments, for the last hint."""
    return "\n".join(line for line in (strip_comment(line) for line in code.split("\n")) if line.strip())


def action_hints(run):
    """Guided's two hints for an IDE action: where to look, then exactly what to do."""
    action = run["action"]
    if action == "menu":
        return f"It's in RStudio's {run['menu'][0]} menu.", f"Choose {' › '.join(run['menu'])}."
    if action == "option":
        tick = "tick" if run["value"] else "untick"
        return ("It's a setting in Tools › Global Options.",
                f"In Tools › Global Options › {run['pane']}, {tick} {run['label']}, then press OK.")
    if action == "format-document":
        return "It's in the Code menu.", "Choose Code › Reformat Document."
    if action == "new-file":
        return "It's in the File menu.", f"Choose File › New File › {run['kind']}."
    if action == "render":
        return "Look at the toolbar above the document.", "Press Render, on the toolbar above the document."
    if action == "editor-mode":
        mode = "Visual" if run["to"] == "visual" else "Source"
        return "Look at the toolbar above the document.", f"Press {mode}, at the left of the toolbar above the document."
    if action == "shortcut":
        return "It's a keyboard shortcut.", f"Press {run['keys']}."
    if action == "open-file":
        return "It's in the project folder.", f"Click {run['file']} in the Files pane."
    if action == "type":
        return f"It goes {run.get('where', 'at the end of the document')}.", ""
    if action == "source":
        return ("Look at the toolbar above the script.",
                "Press Source, on the toolbar above the script, or press Ctrl+Shift+S.")
    if action == "new-project":
        return ("It's in the File menu.",
                f"Choose File › New Project…, then New Directory, then New Project. Type {run['name']} as the "
                "directory name, and press Create Project.")
    fail(f"unknown action {action!r}")


def render_script(scenario):
    """The script starts with only the step headings. Each step's code goes below
    its heading: typed by the coach in Demonstration, by the learner otherwise."""
    about = f"Go deeper: {scenario['chapter']}" if scenario.get("chapter") else scenario["source"]
    lines = [
        f"# {scenario['title']}",
        f"# {about}",
        "#",
        "# Write each step's code under its heading.",
        "# To run it, press Ctrl+Enter (or click Run).",
        "",
    ]
    for number, step in enumerate(scenario["steps"], start=1):
        lines.append(heading(number, step))
        lines.append("")
    return "\n".join(lines)


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


def load_module(root, name):
    # provision.py runs isolated (python3 -I), so tools/ isn't on the import path.
    spec = importlib.util.spec_from_file_location(name, root / "tools" / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def collection_info(root):
    """Each collection lesson's number, part and Go deeper link."""
    path = root / "content" / "lessons" / "collection.json"
    info = {}
    if path.exists():
        number = 0
        for part in json.loads(path.read_text())["parts"]:
            for lesson in part["lessons"]:
                number += 1
                info[lesson["id"]] = {"number": number, "part": part["title"], "chapter": lesson["chapter"]}
    return info


# What the coach gets from the bake for each statement. Fingerprints, not values: lessons with
# "version": 2 keep their answers out of the page. Older lessons check what the Console printed.
EXPECTED = ("fp", "fp_any", "assigned", "library", "plot", "class", "dim", "files")


def prepare_lesson(scenario, project, root, image, bake, collection):
    """Write the lesson's script, get its baked reference results, and return what the coach needs."""
    modes = scenario["modes"]
    for step in scenario["steps"]:
        for run in step["runs"]:
            what = run.get("code") or f"action {run.get('action')}"
            if ("guided" in modes or "solo" in modes) and not run.get("task"):
                fail(f"`{what}` needs a task: Guided and Solo show it instead of the code")
            if ("demonstration" in modes or "guided" in modes) and not run.get("purpose"):
                fail(f"`{what}` needs a purpose: Demonstration and Show me say "
                     f"\"Writing code to <purpose>\" while they type it")
    if (project / scenario["script"]).exists():
        fail(f"two lessons both use {scenario['script']}")
    scenario.update(collection.get(scenario["id"], {}))
    # The coach puts the script back to this text whenever a mode starts afresh. A lesson whose
    # script is a Quarto document gives the document's starting text itself.
    if not isinstance(scenario.get("starter"), str):
        scenario["starter"] = render_script(scenario)
    (project / scenario["script"]).write_text(scenario["starter"])
    try:
        baked = bake.ensure(root, image, scenario["id"], dict(scenario), log=lambda text: print(text, file=sys.stderr))
    except bake.BakeError as error:
        fail(f"the bake of {scenario['id']} failed: {error}")
    records = baked["runs"]
    runs = [run for step in scenario["steps"] for run in step["runs"]]
    if len(records) != len(runs):
        fail(f"the bake of {scenario['id']} has {len(records)} statements, but the lesson has {len(runs)}")
    for run, record in zip(runs, records):
        run["expected_values"] = record.get("values") or {}
        if "code" not in run:
            continue
        if scenario.get("version") == 2:
            run["expected"] = {key: record.get(key) for key in EXPECTED}
            if run["evidence"] in ("console", "plot"):  # both compare the Console's printed output
                run["expected_output"] = record["output"]
        else:
            run["expected_output"] = record["output"]
    for number, step in enumerate(scenario["steps"], start=1):
        step["heading"] = heading(number, step)
        for run in step["runs"]:
            if "code" in run:
                run["hint_partial"] = blanks(run["code"])
                run["hint_line"] = whole(run["code"])
            else:
                run["hint_where"], run["hint_how"] = action_hints(run)
                if run["action"] == "type":
                    text = [line for line in run["text"].split("\n") if line.strip()]
                    run["hint_partial"] = "\n".join(text[:2]) + ("\n…" if len(text) > 2 else "")
                    run["hint_line"] = run["text"].strip("\n")
    keys = ("id", "title", "summary", "source", "script", "starter", "modes", "steps", "version", "number", "part", "chapter", "world")
    return {key: scenario[key] for key in keys if key in scenario}


def render_readme(lessons):
    lines = ["# Lessons", ""]
    for lesson in lessons:
        lines += [f"- `{lesson['script']}`: {lesson['title']}. {lesson['summary']}"]
    lines += ["", "Choose a lesson and a mode in the Coach pane on the right. Write each lesson's code",
              "under the step headings in its script. To run it, press Ctrl+Enter, or click **Run**.", ""]
    if any(lesson.get("world") for lesson in lessons):
        lines += ["The lessons' data is in `data/`. Its README says what each file holds.", ""]
    return "\n".join(lines)


def main(root, image, project_name, *scenario_ids):
    root = Path(root).resolve()
    scenarios = [load(root, scenario_id) for scenario_id in scenario_ids]
    several = len(scenarios) > 1
    if several and any("steps" not in scenario for scenario, _ in scenarios):
        fail("only lessons with steps can share a run")

    run = root / os.environ.get("LAB_RUN_DIR", "run")  # run.sh sets it; parallel audits use run-1, run-2…
    project, public = run / "project", run / "public"
    for folder in (project, public):
        folder.mkdir(parents=True)
    bake = load_module(root, "bake")
    # Lessons that share a run get one README listing them all.
    for _, source in scenarios:
        if source.is_dir():
            copy_project(source, project, skip={"README.md"} if several else ())
    if any(scenario.get("world") for scenario, _ in scenarios):
        bake.layout_world(root, project)
    (project / f"{project_name}.Rproj").write_text(RPROJ)

    session = {"run_id": secrets.token_hex(4), "project": project_name}
    first = scenarios[0][0]
    if "steps" not in first:
        # regional-revenue has no steps yet: its Guided mode is a stub with a Check work button.
        session.update(scenario=first["id"], title=first["title"], modes=first["modes"])
    else:
        collection = collection_info(root)
        lessons = [prepare_lesson(scenario, project, root, image, bake, collection) for scenario, _ in scenarios]
        if several:
            (project / "README.md").write_text(render_readme(lessons))
        (public / "steps.json").write_text(json.dumps({"lessons": lessons}, indent=2))
        session["lessons"] = [{key: lesson[key] for key in ("id", "title", "script", "modes", "number", "part") if key in lesson}
                              for lesson in lessons]
    (public / "session.json").write_text(json.dumps(session, indent=2))
    print(f"provisioned {', '.join(scenario_ids)} in {project_name} as run {session['run_id']}")


if __name__ == "__main__":
    if len(sys.argv) < 5:
        fail("usage: provision.py <repo-root> <runtime-image> <project-name> <scenario-id>...")
    main(*sys.argv[1:])
