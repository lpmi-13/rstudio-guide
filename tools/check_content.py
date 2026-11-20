#!/usr/bin/env python3
"""Static checks of the lessons: content/lessons/collection.json and every scenarios/<id>/scenario.json.

What the bake can't check without running R: the schema, that every statement has a purpose and a
task, step and statement counts, that each kind of evidence has what it needs, and that every value
an explanation quotes is defined by then. The bake (tools/bake.py) checks the rest in R, including
that code is formatted the way Air formats it.

Lessons with "version": 2 (modelled on R for Data Science) are checked strictly: they must be in
the collection, under their collection title, and start with a Setup step of library() calls,
followed by 5-8 steps of 1-3 statements. "fixture": true marks a lesson that only the audits use.

  python3 -I tools/check_content.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MODES = ("demonstration", "guided", "solo")
EVIDENCE = ("console", "plot", "value", "assign", "ggplot", "attached", "pattern", "file", "ide", "error")
ACTIONS = {
    "menu": ("menu",),
    "option": ("pane", "label", "value"),
    "format-document": (),
    "new-file": ("kind",),
    "render": ("file",),
    "editor-mode": ("to",),
    "shortcut": ("keys",),
    "open-file": ("file",),
    "type": ("text",),
}
IDE_CHECKS = ("pref", "value", "restarted", "tab", "viewer", "help", "project", "chord", "editor_text", "editor_mode", "editor_match")
RUN_KEYS = {"code", "action", "menu", "purpose", "task", "evidence", "show", "capture", "values", "alternatives", "order",
            "warning", "error", "pattern", "path", "file", "ide", "control", "pane", "label", "value", "kind", "to", "keys",
            "text", "after", "where"}
PLACEHOLDER = re.compile(r"\{(\w+)\}")


def check_lesson(folder, collection, problems):
    def problem(text):
        problems.append(f"{folder.name}: {text}")

    try:
        lesson = json.loads((folder / "scenario.json").read_text())
    except (OSError, json.JSONDecodeError) as error:
        problem(f"scenario.json doesn't read: {error}")
        return
    if lesson.get("id") != folder.name:
        problem(f"id {lesson.get('id')!r} doesn't match the folder")
    if not isinstance(lesson.get("title"), str) or not lesson["title"].strip():
        problem("needs a title")
    modes = lesson.get("modes")
    if not modes or not isinstance(modes, list) or any(m not in MODES for m in modes):
        problem(f"modes must be a non-empty list drawn from {', '.join(MODES)}")
        modes = []
    if "steps" not in lesson:
        return  # regional-revenue: a stub without steps
    if not isinstance(lesson.get("summary"), str) or not lesson["summary"].strip():
        problem("needs a summary")
    script = lesson.get("script")
    if not isinstance(script, str) or Path(script).name != script or script in (".", ".."):
        problem("script must be a plain file name")
    strict = lesson.get("version") == 2
    fixture = lesson.get("fixture") is True
    if strict and not fixture:
        entry = collection.get(lesson.get("id"))
        if not entry:
            problem("isn't in content/lessons/collection.json")
        elif lesson.get("title") != entry["title"]:
            problem(f"title {lesson.get('title')!r} differs from the collection's {entry['title']!r}")
        if isinstance(script, str) and not script.startswith(lesson["id"][:3]):
            problem(f"script {script!r} should start with the lesson's number")
    elif not strict and not lesson.get("source"):
        problem("needs a source")

    steps = lesson["steps"]
    if not isinstance(steps, list) or not steps:
        problem("needs steps")
        return
    # A lesson whose script is a Quarto document gives the document's starting text ("starter"),
    # instead of a script of step headings. A step with code still needs its heading in it (as an R
    # comment inside a chunk), because that's where the coach types the code.
    starter = lesson.get("starter")
    if isinstance(script, str) and script.endswith(".qmd") and not isinstance(starter, str):
        problem("a lesson whose script is a .qmd needs a starter: the document's starting text")
    if isinstance(starter, str):
        for number, step in enumerate(steps, start=1):
            if any("code" in run for run in step.get("runs", [])) and f"# Step {number}. {step.get('title')}" not in starter.split("\n"):
                problem(f"step {step.get('id')!r} has code, so the starter needs its heading, # Step {number}. {step.get('title')}")
    if strict and not fixture:
        first = steps[0]
        if not first.get("id") == "setup" or not all(r.get("evidence") == "attached" for r in first.get("runs", [])):
            problem("must start with a Setup step (id \"setup\") whose statements are library() calls")
        if not 5 <= len(steps) - 1 <= 8:
            problem(f"has {len(steps) - 1} steps after Setup; lessons have 5-8")
    ids = set()
    values = set()
    for step in steps:
        sid = step.get("id")
        where = f"step {sid!r}"
        if not sid or sid in ids:
            problem(f"{where}: needs a unique id")
        ids.add(sid)
        if not step.get("title"):
            problem(f"{where}: needs a title")
        runs = step.get("runs") or []
        if not runs:
            problem(f"{where}: needs at least one statement")
        if strict and not fixture and len(runs) > 3:
            problem(f"{where}: has {len(runs)} statements; steps have 1-3")
        for k, run in enumerate(runs):
            check_run(run, f"{where}, statement {k + 1}", modes, strict, values, problem)
        for name in PLACEHOLDER.findall(step.get("explain", "")):
            if name not in values:
                problem(f"{where}: the explanation quotes {{{name}}}, which no statement up to here defines")
        if not isinstance(step.get("explain"), str) or not step["explain"].strip():
            problem(f"{where}: needs an explanation")


def check_run(run, where, modes, strict, values, problem):
    unknown = set(run) - RUN_KEYS
    if unknown:
        problem(f"{where}: unknown keys {', '.join(sorted(unknown))}")
    has_code, has_action = "code" in run, "action" in run
    if has_code == has_action:
        problem(f"{where}: needs either code or an action")
        return
    if has_code and (not isinstance(run["code"], str) or not run["code"].strip()):
        problem(f"{where}: code must be text")
    # On a statement, "keys" teaches a shortcut: the coach types each |> with Ctrl+Shift+M, and
    # Guided and Solo count the statement once the learner has pressed it too.
    if has_code and "keys" in run and (run["keys"] != "Ctrl+Shift+M" or "|>" not in str(run["code"])):
        problem(f"{where}: on a statement, keys can only be \"Ctrl+Shift+M\", for code with |>")
    if has_code and "keys" in run and not all("|>" in str(a) for a in run.get("alternatives", [])):
        problem(f"{where}: with keys, every alternative must use |> too (the task asks for the shortcut)")
    if ("guided" in modes or "solo" in modes) and not run.get("task"):
        problem(f"{where}: needs a task (Guided and Solo show it instead of the code)")
    if ("demonstration" in modes or "guided" in modes) and not run.get("purpose"):
        problem(f"{where}: needs a purpose (Demonstration says \"Writing code to <purpose>\")")
    evidence = run.get("evidence")
    if evidence not in EVIDENCE:
        problem(f"{where}: evidence must be one of {', '.join(EVIDENCE)}")
    if has_action:
        action = run["action"]
        if action not in ACTIONS:
            problem(f"{where}: unknown action {action!r}")
        else:
            for key in ACTIONS[action]:
                if key not in run:
                    problem(f"{where}: the {action} action needs {key!r}")
        if evidence not in ("ide", "file", "attached"):
            problem(f"{where}: an action's evidence must be ide or file")
    if evidence == "file" and not isinstance(run.get("path"), str):
        problem(f"{where}: file evidence needs a path")
    if evidence == "pattern":
        compiles(run.get("pattern"), f"{where}: pattern", problem)
    if has_action and run.get("action") == "type":
        if not isinstance(run.get("text"), str) or not run["text"].strip():
            problem(f"{where}: a type action needs the text to type")
        if "after" in run:
            compiles(run["after"], f"{where}: after", problem)
    if isinstance(run.get("ide"), dict) and "editor_match" in run["ide"]:
        compiles(run["ide"]["editor_match"], f"{where}: editor_match", problem)
    if evidence == "error":
        compiles(run.get("error"), f"{where}: error", problem)
    if evidence == "ide":
        checks = run.get("ide")
        if not isinstance(checks, dict) or not checks or set(checks) - set(IDE_CHECKS):
            problem(f"{where}: ide evidence needs an ide object with keys from {', '.join(IDE_CHECKS)}")
    if "warning" in run:
        compiles(run["warning"], f"{where}: warning", problem)
    if run.get("order") not in (None, "any"):
        problem(f"{where}: order can only be \"any\"")
    if run.get("order") == "any" and evidence != "value":
        problem(f"{where}: order \"any\" only applies to value evidence")
    alternatives = run.get("alternatives", [])
    if not isinstance(alternatives, list) or not all(isinstance(a, str) and a.strip() for a in alternatives):
        problem(f"{where}: alternatives must be a list of code")
    if alternatives and evidence not in ("value", "assign", "ggplot"):
        problem(f"{where}: alternatives are only compared for value, assign and ggplot evidence")
    for name, pattern in (run.get("capture") or {}).items():
        compiles(pattern, f"{where}: capture {name}", problem)
        values.add(name)
    for name, expr in (run.get("values") or {}).items():
        if not isinstance(expr, str) or not expr.strip():
            problem(f"{where}: value {name} must be an R expression")
        values.add(name)


def compiles(pattern, where, problem):
    if not isinstance(pattern, str):
        problem(f"{where} must be a regular expression")
        return
    try:
        re.compile(pattern)
    except re.error as error:
        problem(f"{where} doesn't compile: {error}")


def main():
    problems = []
    collection = {}
    path = ROOT / "content" / "lessons" / "collection.json"
    doc = json.loads(path.read_text())
    seen = set()
    for number, lesson in enumerate((lesson for part in doc["parts"] for lesson in part["lessons"]), start=1):
        if lesson["id"] in seen or not lesson["id"].startswith(f"{number:02d}-"):
            problems.append(f"collection: {lesson['id']} is out of order or listed twice")
        seen.add(lesson["id"])
        if not lesson.get("chapter", "").startswith("https://r4ds.hadley.nz/"):
            problems.append(f"collection: {lesson['id']} needs a chapter link")
        collection[lesson["id"]] = lesson
    folders = sorted(p for p in (ROOT / "scenarios").iterdir() if (p / "scenario.json").is_file())
    for folder in folders:
        check_lesson(folder, collection, problems)
    for problem in problems:
        print(f"check_content: {problem}", file=sys.stderr)
    built = sum(1 for lesson in collection if (ROOT / "scenarios" / lesson).is_dir())
    print(f"check_content: {len(folders)} lessons checked; {built} of {len(collection)} collection lessons exist; "
          f"{len(problems)} problem(s)")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
