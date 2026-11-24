"""The bake cache follows executable lesson inputs, not coach copy."""

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("bake", ROOT / "tools/bake.py")
bake = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bake)


class BakeStampTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        for relative in ("runtime/packages.lock", "runtime/evidence.R", "runtime/bake.R", "runtime/Dockerfile"):
            path = self.root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(relative)
        self.scenario = self.root / "scenarios/sample/scenario.json"
        self.scenario.parent.mkdir(parents=True)
        self.lesson = {"id": "sample", "version": 2, "script": "sample.R", "summary": "Read and chart data.",
                       "steps": [{"id": "one", "title": "One", "explain": "R printed one.",
                                  "runs": [{"code": "1", "evidence": "console", "task": "Print one.", "purpose": "show one"}]}]}
        self.save()

    def save(self):
        self.scenario.write_text(json.dumps(self.lesson))

    def stamp(self):
        return bake.stamp(self.root, "sample", self.lesson)

    def test_copy_changes_do_not_invalidate_results(self):
        before = self.stamp()
        self.lesson["summary"] = "Try R."
        self.lesson["steps"][0]["explain"] = "One is the result."
        self.lesson["steps"][0]["runs"][0]["task"] = "Show one."
        self.save()
        self.assertEqual(before, self.stamp())

    def test_code_or_project_changes_invalidate_results(self):
        before = self.stamp()
        self.lesson["steps"][0]["runs"][0]["code"] = "2"
        self.save()
        self.assertNotEqual(before["lesson"], self.stamp()["lesson"])
        after_code = self.stamp()
        project = self.scenario.parent / "project"
        project.mkdir()
        (project / "input.csv").write_text("value\n2\n")
        self.assertNotEqual(after_code["project"], self.stamp()["project"])


if __name__ == "__main__":
    unittest.main()
