import { ErrorCode, Harness } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

export const workflowSkillPreflightCases = {
  positive: [
    positive("checks a linked Codex skill and its reference", [Harness.Codex, true], true),
    positive("checks a linked Claude skill and its reference", [Harness.Claude, true], true),
  ],
  negative: [
    rejected("refuses a missing Codex skill before dispatch", [Harness.Codex, false], true),
    rejected("refuses a missing Claude skill before dispatch", [Harness.Claude, false], true),
  ],
};

export const projectSkillCases = {
  positive: [
    positive(
      "Codex force replaces a skill link and preserves its target",
      [Harness.Codex, true, true, true],
      true,
    ),
    positive(
      "Claude force replaces a skill link and preserves its target",
      [Harness.Claude, true, true, true],
      true,
    ),
    positive(
      "Codex installs valid frontmatter, checked workflow and current commands",
      [Harness.Codex, false],
      true,
    ),
    positive(
      "Claude installs the same canonical body and usable workflow",
      [Harness.Claude, false],
      true,
    ),
  ],
  negative: [
    negative(
      "Codex preserves a linked skill even with identical text",
      [Harness.Codex, true, true],
      {
        code: ErrorCode.Exists,
      },
    ),
    negative(
      "Claude preserves a linked skill even with identical text",
      [Harness.Claude, true, true],
      {
        code: ErrorCode.Exists,
      },
    ),
    negative("Codex refuses replacement and preserves existing bytes", [Harness.Codex, true], {
      code: ErrorCode.Exists,
    }),
    negative("Claude refuses replacement and preserves existing bytes", [Harness.Claude, true], {
      code: ErrorCode.Exists,
    }),
  ],
};

export const installChecksCases = {
  positive: [
    positive("optional Lean missing: install finishes and names Lean", [Harness.Claude, ["lean"]], {
      code: 0,
      written: true,
      named: true,
    }),
    positive("agent command missing: install finishes and names it", [Harness.Codex, ["codex"]], {
      code: 0,
      written: true,
      named: true,
    }),
    positive(
      "optional Python and Z3 missing: install finishes and names both",
      [Harness.Codex, ["python3", "z3"]],
      { code: 0, written: true, named: true },
    ),
  ],
  negative: [
    rejected(
      "failed Codex registration reports an unsuccessful install",
      [Harness.Codex, [], true],
      { code: 1, written: true, named: true },
    ),
    rejected(
      "failed Claude registration reports an unsuccessful install",
      [Harness.Claude, [], true],
      { code: 1, written: true, named: true },
    ),
    rejected(
      "failed plugin import reports an unsuccessful install",
      [Harness.Antigravity, [], true],
      { code: 1, written: true, named: true },
    ),
    negative("Bun older than 1.3.10: install stops and writes nothing", [Harness.Claude, ["bun"]], {
      code: ErrorCode.Harness,
    }),
    negative("required Git missing: install stops and writes nothing", [Harness.Claude, ["git"]], {
      code: ErrorCode.Harness,
    }),
  ],
};

export const claudeRegistrationCases = {
  positive: [
    positive(
      "relative native configuration uses the selected project directory",
      ["titan", false, false, true, false, false, 0, true],
      true,
    ),
    positive(
      "same native Claude command can be registered repeatedly",
      ["titan", false, false, false],
      true,
    ),
    positive(
      "nested project uses its native Claude repository registration",
      ["titan", false, false, true],
      true,
    ),
  ],
  negative: [
    rejected(
      "relative native configuration retains command conflict refusal",
      ["other", false, false, true, false, false, 0, true],
      false,
    ),
    rejected(
      "excessive project ancestry remains a registration failure",
      ["titan", false, false, false, false, false, 130],
      false,
    ),
    rejected(
      "different native command remains a registration failure",
      ["other", false, false, false],
      false,
    ),
    rejected(
      "disabled native Claude server remains a failure",
      ["titan", true, false, false],
      false,
    ),
    rejected("native environment overrides remain a failure", ["titan", false, true, false], false),
    rejected(
      "malformed native configuration remains a failure",
      ["titan", false, false, false, true],
      false,
    ),
    rejected(
      "missing native configuration remains a failure",
      ["titan", false, false, false, false, true],
      false,
    ),
  ],
};
