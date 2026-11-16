#!/usr/bin/env python3
"""Exercise specification-check failures in isolated copies of the artifacts."""

import csv
import re
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
RELATIVE_CHANGE = Path("openspec/changes/resilient-agent-blackboard-bun")


class SpecificationCheckTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="titan-spec-check-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.change = self.root / RELATIVE_CHANGE
        self.change.mkdir(parents=True)
        (self.root / "tooling/scripts").mkdir(parents=True)
        for name in ("check-specs.py", "check-plain.py"):
            shutil.copy2(ROOT / "tooling/scripts" / name, self.root / "tooling/scripts" / name)
        original = ROOT / RELATIVE_CHANGE
        for name in ("proposal.md", "design.md", "tasks.md"):
            shutil.copy2(original / name, self.change / name)
        shutil.copytree(original / "specs", self.change / "specs")
        (self.change / "research").mkdir()
        self.map_path = self.change / "research/acceptance-map.tsv"
        shutil.copy2(original / "research/acceptance-map.tsv", self.map_path)
        with self.map_path.open(newline="") as source:
            reader = csv.DictReader(source, delimiter="\t")
            self.fields = reader.fieldnames
            self.rows = list(reader)

    def add_repair_change(self):
        relative = Path("openspec/changes/archive/2026-11-16-repair-harness-delivery")
        destination = self.root / relative
        shutil.copytree(ROOT / relative, destination)
        return destination / "research/acceptance-map.tsv"

    def test_repair_artifacts_pass(self):
        self.add_repair_change()
        self.check()

    def test_missing_repair_mapping_fails(self):
        path = self.add_repair_change()
        lines = path.read_text().splitlines()
        path.write_text("\n".join(lines[:-1]) + "\n")
        self.check("missing acceptance mapping")

    def test_missing_repair_map_fails(self):
        self.add_repair_change().unlink()
        self.check("missing acceptance map")

    def save_map(self):
        with self.map_path.open("w", newline="") as destination:
            writer = csv.DictWriter(destination, self.fields, delimiter="\t")
            writer.writeheader()
            writer.writerows(self.rows)

    def check(self, expected=None):
        result = subprocess.run(
            [sys.executable, "-I", str(self.root / "tooling/scripts/check-specs.py")],
            capture_output=True, text=True, check=False,
        )
        output = result.stdout + result.stderr
        if expected is None:
            self.assertEqual(result.returncode, 0, output)
        else:
            self.assertEqual(result.returncode, 1, output)
            self.assertIn(expected, output)
        self.assertIn("no product tests ran", output)

    def test_current_artifacts_pass(self):
        self.check()

    def test_missing_map_fails(self):
        self.map_path.unlink()
        self.check("missing acceptance map")

    def test_missing_scenario_mapping_fails(self):
        self.rows.pop()
        self.save_map()
        self.check("missing acceptance mapping")

    def test_duplicate_mapping_fails(self):
        self.rows.append(self.rows[0].copy())
        self.save_map()
        self.check("duplicate acceptance mapping")

    def test_unknown_scenario_fails(self):
        self.rows[0]["scenario"] = "Invented scenario"
        self.save_map()
        self.check("unknown acceptance scenario")

    def test_wrong_requirement_fails(self):
        self.rows[0]["requirement"] = "Wrong requirement"
        self.save_map()
        self.check("acceptance requirement mismatch")

    def test_absent_task_fails(self):
        self.rows[0]["task"] = "999.1"
        self.save_map()
        self.check("acceptance map names absent task")

    def test_completed_task_with_pending_scenario_fails(self):
        path = self.change / "tasks.md"
        task = self.rows[0]["task"]
        path.write_text(path.read_text().replace(f"- [ ] {task} ", f"- [x] {task} ", 1))
        self.check("completed task has pending scenario")

    def test_invalid_stage_fails(self):
        self.rows[0]["stage"] = "shipped"
        self.save_map()
        self.check("invalid acceptance stage")

    def test_invalid_test_level_fails(self):
        self.rows[0]["test_level"] = "assumed"
        self.save_map()
        self.check("invalid acceptance test level")

    def test_invalid_status_fails(self):
        self.rows[0]["status"] = "passed"
        self.save_map()
        self.check("invalid acceptance status")

    def test_missing_dashboard_command_fails(self):
        path = self.change / "tasks.md"
        path.write_text(path.read_text().replace("  - `dashboard`\n", "", 1))
        self.check("commands absent from CLI task: ['dashboard']")

    def test_wrong_command_count_fails(self):
        path = self.change / "tasks.md"
        path.write_text(re.sub(r"its \d+ subcommands", "its 0 subcommands", path.read_text(), count=1))
        self.check("CLI task command count differs from its list")


if __name__ == "__main__":
    unittest.main()
