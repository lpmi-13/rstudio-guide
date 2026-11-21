#!/usr/bin/env python3
"""Print the ids of the collection's lessons that have been written (scenarios/<id>/scenario.json
exists), one per line, in the collection's order: the default run of ./run.sh up.

  python3 -I tools/collection.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

collection = json.loads((ROOT / "content" / "lessons" / "collection.json").read_text())
for part in collection["parts"]:
    for lesson in part["lessons"]:
        if (ROOT / "scenarios" / lesson["id"] / "scenario.json").is_file():
            print(lesson["id"])
