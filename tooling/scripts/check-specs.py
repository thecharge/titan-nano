#!/usr/bin/env python3
"""Check specification links and writing without running product code."""

from pathlib import Path
import csv
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
CHANGE = ROOT / "openspec/changes/resilient-agent-blackboard-bun"


def check_change(change):
    errors = []
    proposal = (change / "proposal.md").read_text()
    capabilities = set(re.findall(r"^- `([a-z-]+)`: ", proposal, re.M))
    specs = {p.parent.name: p for p in (change / "specs").glob("*/spec.md")}
    if capabilities != set(specs):
        errors.append(f"capability mismatch: {sorted(capabilities ^ set(specs))}")

    scenarios = set()
    scenario_requirements = {}
    requirement_count = 0
    for name, path in specs.items():
        text = path.read_text()
        requirements = re.split(r"^### Requirement: ", text, flags=re.M)[1:]
        titles = set()
        for block in requirements:
            title = block.splitlines()[0]
            if title in titles:
                errors.append(f"{name}: duplicate requirement: {title}")
            titles.add(title)
            requirement_count += 1
            body = re.split(r"^#### Scenario:", block, flags=re.M)[0]
            if not re.search(r"\b(SHALL|MUST)\b", body):
                errors.append(f"{name}: no SHALL/MUST: {title}")
            cases = re.split(r"^#### Scenario: ", block, flags=re.M)[1:]
            if not cases:
                errors.append(f"{name}: no scenario: {title}")
            for case in cases:
                label = case.splitlines()[0]
                key = (name, label)
                if key in scenarios:
                    errors.append(f"{name}: duplicate scenario: {label}")
                scenarios.add(key)
                scenario_requirements[key] = title
                if "**WHEN**" not in case or "**THEN**" not in case:
                    errors.append(f"{name}: missing WHEN/THEN: {label}")

    tasks = (change / "tasks.md").read_text()
    ids = re.findall(r"^- \[[ x]\] (\d+\.\d+) ", tasks, re.M)
    if len(ids) != len(set(ids)):
        errors.append("duplicate task ids")
    labels = {label for _, label in scenarios}
    for line in tasks.splitlines():
        if "scenario" in line:
            for label in re.findall(r'"([^"\n]+)"', line):
                if label not in labels:
                    errors.append(f"task names an absent scenario: {label}")

    # Coverage ownership is planning evidence, never a product-test result.
    acceptance = change / "research/acceptance-map.tsv"
    if not acceptance.exists():
        errors.append("missing acceptance map")
    else:
        with acceptance.open(newline="") as source:
            rows = list(csv.DictReader(source, delimiter="\t"))
        mapped = set()
        completed = {task for state, task in re.findall(
            r"^- \[([ x])\] (\d+\.\d+) ", tasks, re.M) if state == "x"}
        for row in rows:
            key = (row.get("capability"), row.get("scenario"))
            task = row.get("task")
            if key in mapped:
                errors.append(f"duplicate acceptance mapping: {key}")
            mapped.add(key)
            if key not in scenarios:
                errors.append(f"unknown acceptance scenario: {key}")
            elif row.get("requirement") != scenario_requirements[key]:
                errors.append(f"acceptance requirement mismatch: {key}")
            if task not in ids:
                errors.append(f"acceptance map names absent task: {task}")
            if row.get("stage") not in {"foundation", "local", "adapter", "full", "release"}:
                errors.append(f"invalid acceptance stage: {key}")
            if row.get("test_level") not in {"unit", "integration", "contract", "end-to-end", "live"}:
                errors.append(f"invalid acceptance test level: {key}")
            if row.get("status") not in {"pending", "implemented"}:
                errors.append(f"invalid acceptance status: {key}")
            if task in completed and row.get("status") == "pending":
                errors.append(f"completed task has pending scenario: {task}: {key}")
        for key in sorted(scenarios - mapped):
            errors.append(f"missing acceptance mapping: {key}")

    command_block = re.search(r"^- \[[ x]\] 2\.2 .*?(?=^- \[[ x]\] 2\.3 )", tasks, re.M | re.S)
    if command_block and change == CHANGE:
        commands = set(re.findall(r"^  - `([a-z-]+)`$", command_block.group(), re.M))
        used = set()
        for path in specs.values():
            used.update(re.findall(r"`titan ([a-z][a-z-]*)(?=[ `])", path.read_text()))
        if used - commands:
            errors.append(f"commands absent from CLI task: {sorted(used - commands)}")
        count = re.search(r"its (\d+) subcommands", command_block.group())
        if not count or int(count.group(1)) != len(commands):
            errors.append("CLI task command count differs from its list")
    elif change == CHANGE:
        errors.append("missing CLI command task")

    for path in [change / "design.md", change / "proposal.md", *specs.values()]:
        for target in re.findall(r"\bspec ([a-z]+(?:-[a-z]+)+)", path.read_text()):
            if target not in specs:
                errors.append(f"{path.name}: absent spec: {target}")

    for error in errors:
        print(f"FAIL {error}")
    print(f"{len(specs)} capabilities, {requirement_count} requirements, "
          f"{len(scenarios)} scenarios, {len(ids)} tasks; {len(errors)} errors")
    return bool(errors)


def main():
    failed = False
    changes = ROOT / "openspec/changes"
    for change in sorted(changes.iterdir()):
        if change.is_dir() and (change / "proposal.md").exists():
            print(f"Checking {change.name}")
            failed = check_change(change) or failed
    writing = subprocess.run(
        [sys.executable, "-I", str(ROOT / "tooling/scripts/check-plain.py"),
         str(ROOT / "openspec")], check=False
    )
    print("Specification check only; no product tests ran.")
    return 1 if failed or writing.returncode else 0


if __name__ == "__main__":
    sys.exit(main())
