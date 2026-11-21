#!/usr/bin/env python3
"""Format every statement of a lesson the way Air formats it (as the bake requires), in place.

Each statement's code and alternatives are written to files, formatted by the `air` in the
runtime image, and written back into scenarios/<lesson>/scenario.json. Alternatives are formatted
too, though the bake doesn't require it, since the audits type them.

  python3 -I tools/format_lesson.py <runtime-image> <lesson>...
"""
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def format_codes(image, codes):
    with tempfile.TemporaryDirectory(prefix="air-") as tmp:
        files = []
        for i, code in enumerate(codes):
            path = Path(tmp) / f"s{i:03d}.R"
            path.write_text(code + "\n")
            files.append(path.name)
        subprocess.run(["docker", "run", "--rm", "--network", "none", "--user", f"{os.getuid()}:{os.getgid()}",
                        "-v", f"{tmp}:/w", "-w", "/w", "--entrypoint", "air", image, "format", *files], check=True)
        return [(Path(tmp) / name).read_text().rstrip("\n") for name in files]


def main(image, *lessons):
    for lesson_id in lessons:
        path = ROOT / "scenarios" / lesson_id / "scenario.json"
        lesson = json.loads(path.read_text())
        runs = [run for step in lesson["steps"] for run in step["runs"] if "code" in run]
        formatted = iter(format_codes(image, [run["code"] for run in runs]))
        changed = 0
        for run in runs:
            code = next(formatted)
            if code != run["code"]:
                run["code"] = code
                changed += 1
        path.write_text(json.dumps(lesson, indent=2, ensure_ascii=False) + "\n")
        print(f"format_lesson: {lesson_id}: {changed} statement(s) reformatted")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    main(*sys.argv[1:])
