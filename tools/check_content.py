#!/usr/bin/env python3
"""Static checks of the lessons: content/lessons/collection.json and every scenarios/<id>/scenario.json.

What the bake can't check without running R: the schema, that every statement has a purpose and a
task, step and statement counts, that each kind of evidence has what it needs, and that every value
an explanation quotes is defined by then. The bake (tools/bake.py) checks the rest in R, including
that code is formatted the way Air formats it.

Lessons with "version": 2 (modelled on R for Data Science) are checked strictly: they must be in
the collection, under their collection title, and start with a Setup step of library() calls,
followed by 5-8 steps of 1-3 statements. "fixture": true marks a lesson that only the audits use.

Plain language (content/plain-language.json, after ELK Guide's): every lesson has a short summary
(35 words), short task and purpose sentences (20 words), and short explanation paragraphs (55
words). Lessons listed under "checked" also keep explanation sentences to 25 words and avoid
formal words there. The coach's own strings avoid those words too. Code in backticks and {values}
count as one word each.

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
    "source": (),
    "new-project": ("name",),
}
IDE_CHECKS = ("pref", "value", "restarted", "tab", "viewer", "help", "project", "chord", "editor_text", "editor_mode", "editor_match")
RUN_KEYS = {"code", "action", "menu", "purpose", "task", "evidence", "show", "capture", "values", "alternatives", "order",
            "warning", "error", "pattern", "path", "file", "ide", "control", "pane", "label", "value", "kind", "to", "keys",
            "text", "after", "where", "name"}
PLACEHOLDER = re.compile(r"(?<!\{)\{(\w+)\}(?!\})")  # {name}; {{text}} is a literal {text}, as in a regex quantifier
STATEMENT_KEYS = {"Ctrl+Shift+M": "|>", "Alt+-": "<-"}  # a shortcut a statement can teach, and what it types


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
    # A new project reloads RStudio into it, so nothing in the lesson can come after it.
    runs = [run for step in steps for run in step.get("runs", [])]
    if any(run.get("action") == "new-project" for run in runs[:-1]):
        problem("a new project must be the lesson's last statement: RStudio reloads into it")
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
    # On a statement, "keys" teaches a shortcut: the coach types each |> with Ctrl+Shift+M (or each <-
    # with Alt+-), and Guided and Solo count the statement once the learner has pressed it too.
    token = STATEMENT_KEYS.get(run.get("keys"))
    if has_code and "keys" in run and (not token or token not in str(run["code"])):
        problem(f"{where}: on a statement, keys can only be " + " or ".join(f'"{k}", for code with {t}' for k, t in STATEMENT_KEYS.items()))
    if has_code and token and not all(token in str(a) for a in run.get("alternatives", [])):
        problem(f"{where}: with keys, every alternative must use {token} too (the task asks for the shortcut)")
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
    if has_action and run.get("action") == "new-project":
        if not re.fullmatch(r"[A-Za-z][\w.-]*", str(run.get("name", ""))):
            problem(f"{where}: a new project's name must be a plain folder name")
        if not (isinstance(run.get("ide"), dict) and re.search(run["ide"].get("project") or "(?!)", str(run.get("name")))):
            problem(f"{where}: a new project needs ide evidence whose project pattern matches its name")
    if isinstance(run.get("ide"), dict) and "project" in run["ide"]:
        compiles(run["ide"]["project"], f"{where}: project", problem)
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


PLAIN = json.loads((ROOT / "content" / "plain-language.json").read_text())
CODE_SPAN = re.compile(r"`[^`]*`")


def word_forms(word):
    """The word and the base forms its common English endings could come from."""
    found = {word}
    for ending, base in (("ies", "y"), ("ied", "y"), ("es", ""), ("s", ""), ("ed", ""), ("ed", "e"), ("d", ""),
                         ("ing", ""), ("ing", "e"), ("ly", ""), ("ily", "y")):
        if word.endswith(ending) and len(word) - len(ending) >= 3:
            found.add(word[: -len(ending)] + base)
    return found


def hard_words(text):
    """Words from the avoid list, outside code, each with the plainer word to use."""
    words = re.findall(r"[a-z]+(?:'[a-z]+)?", CODE_SPAN.sub(" ", text).casefold())
    avoid = PLAIN["avoid"]
    return sorted({f"{word} (try: {avoid[base]})" for word in words for base in word_forms(word.removesuffix("'s")) if base in avoid})


def prose_words(text):
    """Words as a reader counts them: a code span or a {value} is one word; markup isn't one."""
    text = PLACEHOLDER.sub("N", CODE_SPAN.sub("X", text)).replace("**", "").replace("*", "")
    return re.findall(r"[^\s—–]+", text)


def long_sentences(text, limit):
    found = []
    for block in re.split(r"\n\s*\n|\n(?=\s*- )", text.strip()):
        for sentence in re.split(r"(?:(?<=[.!?])|(?<=[.!?][)\"”’]))\s+(?=[A-Z`*{(“\"])", block.strip()):
            n = len(prose_words(sentence))
            if n > limit:
                found.append(f"{n} words: {sentence[:120]}")
    return found


def check_plain(lesson, problem):
    """A lesson listed as rewritten in plain language stays that way."""
    limits = PLAIN["limits"]

    def plain(text, where, sentence_limit):
        for word in hard_words(text):
            problem(f"{where}: use a plainer word than {word}")
        for sentence in long_sentences(text, sentence_limit):
            problem(f"{where}: a sentence is too long ({sentence})")

    check_summary(lesson, problem)
    for number, step in enumerate(lesson.get("steps", []), start=1):
        explain = step.get("explain", "")
        plain(explain, f"step {number} explain", limits["sentence_words"])
    check_paragraphs(lesson, problem)
    check_instructions(lesson, problem)


def check_summary(lesson, problem):
    """Every lesson shows its summary in the start overview, in all three modes."""
    summary = lesson.get("summary", "")
    for word in hard_words(summary):
        problem(f"summary: use a plainer word than {word}")
    for sentence in long_sentences(summary, PLAIN["limits"]["sentence_words"]):
        problem(f"summary: a sentence is too long ({sentence})")
    if len(prose_words(summary)) > PLAIN["limits"]["summary_words"]:
        problem(f"summary: {len(prose_words(summary))} words, more than {PLAIN['limits']['summary_words']}")


def check_instructions(lesson, problem):
    """Tasks appear in Guided and Solo; purposes narrate Demonstration and Show me."""
    for number, step in enumerate(lesson.get("steps", []), start=1):
        for k, run in enumerate(step.get("runs", []), start=1):
            for field in ("task", "purpose"):
                text = run.get(field)
                if not text:
                    continue
                for word in hard_words(text):
                    problem(f"step {number} {field} {k}: use a plainer word than {word}")
                for sentence in long_sentences(text, PLAIN["limits"]["task_sentence_words"]):
                    problem(f"step {number} {field} {k}: a sentence is too long ({sentence})")


def check_paragraphs(lesson, problem):
    """Every mode shows step explanations, so keep them scannable throughout the collection."""
    limit = PLAIN["limits"]["paragraph_words"]
    for number, step in enumerate(lesson.get("steps", []), start=1):
        for paragraph in re.split(r"\n\s*\n", step.get("explain", "").strip()):
            for part in re.split(r"\n(?=\s*- )", paragraph):  # a list item counts on its own
                if len(prose_words(part)) > limit:
                    problem(f"step {number} explain: a paragraph of {len(prose_words(part))} words, more than "
                            f"{limit}: {part.strip()[:80]}")


def check_coach_strings(problems):
    """The coach's own text uses none of the avoid list's words. Its strings are often fragments, so
    only words are checked, as ELK Guide does."""
    source = (ROOT / "coach" / "coach.js").read_text()
    source = re.sub(r"/\*.*?\*/", lambda m: "\n" * m.group().count("\n"), source, flags=re.S)
    source = re.sub(r"(?m)(^|[\s;{}(),])//.*$", r"\1", source)
    for match in re.finditer(r"'(?:[^'\\\n]|\\.)*'|\"(?:[^\"\\\n]|\\.)*\"|`(?:[^`\\]|\\.)*`", source):
        text = re.sub(r"<[^>]+>|\$\{[^}]*\}", " ", match.group()[1:-1])
        for word in hard_words(text):
            line = source[: match.start()].count("\n") + 1
            problems.append(f"coach/coach.js:{line}: use a plainer word than {word}")


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
        if folder.name not in PLAIN["checked"]:
            lesson = json.loads((folder / "scenario.json").read_text())
            if "summary" in lesson:
                check_summary(lesson, lambda text, folder=folder: problems.append(f"{folder.name} (plain language): {text}"))
            check_instructions(lesson, lambda text, folder=folder: problems.append(f"{folder.name} (plain language): {text}"))
            check_paragraphs(lesson, lambda text, folder=folder: problems.append(f"{folder.name} (plain language): {text}"))
    for lesson_id in PLAIN["checked"]:
        lesson = json.loads((ROOT / "scenarios" / lesson_id / "scenario.json").read_text())
        check_plain(lesson, lambda text, lesson_id=lesson_id: problems.append(f"{lesson_id} (plain language): {text}"))
    check_coach_strings(problems)
    for problem in problems:
        print(f"check_content: {problem}", file=sys.stderr)
    built = sum(1 for lesson in collection if (ROOT / "scenarios" / lesson).is_dir())
    print(f"check_content: {len(folders)} lessons checked; {built} of {len(collection)} collection lessons exist; "
          f"{len(problems)} problem(s)")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
