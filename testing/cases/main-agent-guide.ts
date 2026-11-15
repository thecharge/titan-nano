import { resolve } from "node:path";
import { homePath } from "@titan/config";
import {
  ErrorCode,
  ExitCode,
  FileErrorCode,
  Harness,
  HarnessPlugin,
  InstallPart,
} from "@titan/constants";
import { CliDiagnostic } from "@titan/messages";
import { negative, positive, rejected } from "@titan/test-factories";

const steps = [
  "`titan lessons`",
  "`titan plans`",
  "`titan kb search`",
  "`titan check`",
  "`titan run`",
  "`titan requests`",
  "`titan answer`",
  "`titan resume`",
];
const person = "does not write personas or the workflow file";
const wrongPerson = "the person writes the workflow file";
const unknownStep = ["`titan lessons`", "`titan nothing`"];
const four = ["code-fix", "science-claim", "business-plan", "everyday-problem"];
const workflowSchema = ["schema", "workflow"];
const configSchema = ["schema", "config"];
const outside = ["mixed-graph"];
const unknownHarness = "gemini";
const executable = `${process.execPath} ${resolve(import.meta.dir, "../../apps/cli/src/main.ts")}`;
const exists = { code: ErrorCode.Exists, exitCode: ExitCode.Input };

export const guideStepsCases = {
  positive: [
    positive("all eight commands appear in the stated order", [steps, person], true),
    positive("two neighbouring commands keep their order", [steps.slice(3, 5), person], true),
  ],
  negative: [
    rejected("commands in reverse order are refused", [[...steps].reverse(), person], false),
    rejected("a command that is not in the guide is refused", [unknownStep, person], false),
    rejected("a false statement about the workflow file is refused", [steps, wrongPerson], false),
  ],
};

const sequentialRule =
  "steps that need the one before them, or that change the same file, run in a sequence with one agent";

export const guideSequentialCases = {
  positive: [
    positive(
      "guide explains scoped script approval",
      ["Script workers, script falsifiers and step checks run through scoped action approval."],
      true,
    ),
    positive(
      "guide exposes native worker knowledge tools",
      [
        "Native workers receive execution-bound private knowledge reads, search, add, update and delete.",
      ],
      true,
    ),
    positive("guide warns about sequential work", [sequentialRule], true),
    positive(
      "guide names parallel groups and split for independent parts",
      ["Use parallel groups and `split` only for independent parts"],
      true,
    ),
    positive("guide points to the plans check", ["check this with `titan plans KIND`"], true),
  ],
  negative: [
    rejected(
      "stale blanket script refusal is absent",
      ["Script execution and external operations are blocked."],
      false,
    ),
    rejected(
      "stale native binding refusal is absent",
      ["Private attempt changes and native worker tool bindings are still pending."],
      false,
    ),
    rejected(
      "a rule the guide does not hold is refused",
      ["steps that change the same file run in parallel"],
      false,
    ),
    rejected("the rule with another agent count is refused", [`${sequentialRule}s`], false),
  ],
};

export const guideRulesCases = {
  positive: [
    positive(
      "backend rule has its own sentence",
      ["Run only on a backend the person named."],
      true,
    ),
    positive("hubs rule has its own sentence", ["Search both hubs first."], true),
    positive("requests rule has its own sentence", ["Check `titan requests`."], true),
    positive("resume rule has its own sentence", ["Resume after a limit."], true),
    positive(
      "cost rule has its own sentence",
      ["Read the cost and the cache share in `titan status` before a large batch."],
      true,
    ),
    positive("write rule has its own sentence", ["Let runs write to the project."], true),
    positive("commit rule has its own sentence", ["List hand changes in the commit."], true),
  ],
  negative: [
    rejected("a rule the skill does not hold is refused", ["Switch backend after a limit."], false),
    rejected("half of a rule is not a sentence of the skill", ["Search both hubs"], false),
  ],
};

export const guideSchemaCases = {
  positive: [
    positive("guide holds the titan schema text and the four examples", [["schema"], four], true),
    positive("guide schema equals titan schema workflow", [workflowSchema, ["code-fix"]], true),
  ],
  negative: [
    rejected("the config schema is not the schema in the guide", [configSchema, four], false),
    rejected("an example outside the four is not in the guide", [["schema"], outside], false),
  ],
};

export const installProjectCases = {
  positive: [
    positive(
      "Claude skill has name titan and the guide as body",
      [Harness.Claude, InstallPart.Skill],
      "titan true",
    ),
    positive(
      "Claude plug-in tool server starts titan mcp",
      [Harness.Claude, InstallPart.Mcp],
      `${executable} mcp --home ${homePath()}`,
    ),
    positive(
      "Claude plug-in manifest is named titan",
      [Harness.Claude, InstallPart.Manifest],
      "titan",
    ),
  ],
  negative: [
    negative("an unknown harness is refused", [unknownHarness, InstallPart.Skill], {
      code: ErrorCode.Harness,
    }),
    negative("Codex writes no plug-in tool server file", [Harness.Codex, InstallPart.Mcp], {
      code: FileErrorCode.Missing,
    }),
  ],
};

export const installCodexCases = {
  positive: [
    positive("Codex skill has the same body as Claude", [InstallPart.Skill, 0, true], true),
    positive("codex mcp list in the test folder lists titan", [InstallPart.List, 0, true], "titan"),
    positive(
      "codex mcp add received the titan mcp command",
      [InstallPart.Calls, 0, true],
      `mcp add titan -- ${executable} mcp --home ${homePath()}`,
    ),
  ],
  negative: [
    rejected("a failed codex mcp add leaves the list empty", [InstallPart.List, 1, true], ""),
    rejected(
      "a failed codex mcp add is reported",
      [InstallPart.Status, 1, true],
      CliDiagnostic.McpFailed,
    ),
    rejected(
      "a missing codex program is reported",
      [InstallPart.Status, 0, false],
      CliDiagnostic.McpSkipped,
    ),
  ],
};

export const installForeignCases = {
  positive: [
    positive("an unrelated file survives a Claude install", [null, Harness.Claude], true),
    positive("an unrelated file survives a Codex install", [null, Harness.Codex], true),
  ],
  negative: [
    negative("Claude refuses a foreign skill file", [InstallPart.Skill, Harness.Claude], exists),
    negative(
      "Claude refuses a foreign plugin skill file",
      [InstallPart.PluginSkill, Harness.Claude],
      exists,
    ),
    negative("Codex refuses a foreign skill file", [InstallPart.Skill, Harness.Codex], exists),
    negative(
      "Claude refuses a foreign plug-in manifest",
      [InstallPart.Manifest, Harness.Claude],
      exists,
    ),
    negative("Claude refuses a foreign mcp file", [InstallPart.Mcp, Harness.Claude], exists),
  ],
};

export const installAntigravityCases = {
  positive: [
    positive(
      "agy plugin import receives the plug-in folder",
      [InstallPart.Calls, 0, true],
      "agy plugin import true 1",
    ),
    positive(
      "the import is reported as titan",
      [InstallPart.Status, 0, true],
      HarnessPlugin.Server,
    ),
    positive(
      "the Antigravity skill has name titan and the guide",
      [InstallPart.Skill, 0, false],
      "titan true",
    ),
  ],
  negative: [
    rejected(
      "a failed agy import is reported",
      [InstallPart.Status, 1, true],
      CliDiagnostic.ImportFailed,
    ),
    rejected(
      "a missing agy program is reported",
      [InstallPart.Status, 0, false],
      CliDiagnostic.ImportSkipped,
    ),
    rejected("a missing agy program is never launched", [InstallPart.Calls, 0, false], " false 0"),
  ],
};

export const installForceCases = {
  positive: [
    positive("force replaces a foreign Claude skill", [Harness.Claude, true], "titan"),
    positive("force replaces a foreign Codex skill", [Harness.Codex, true], "titan"),
    positive("force replaces a foreign Antigravity skill", [Harness.Antigravity, true], "titan"),
  ],
  negative: [
    negative("Claude refuses a foreign skill without force", [Harness.Claude, false], exists),
    negative(
      "Antigravity refuses a foreign skill without force",
      [Harness.Antigravity, false],
      exists,
    ),
  ],
};

export const skillHeaderCases = {
  positive: [
    positive("Claude skill names titan_run", [Harness.Claude, "titan_run"], true),
    positive("Claude skill names titan_requests", [Harness.Claude, "titan_requests"], true),
  ],
  negative: [
    rejected("a tool the skill does not name is refused", [Harness.Claude, "titan_deploy"], false),
    negative("an unknown harness writes no skill", [unknownHarness, "titan_run"], {
      code: ErrorCode.Harness,
    }),
  ],
};

export const launchCases = {
  positive: [
    positive("a program that succeeds returns zero", [0], 0),
    positive("a program succeeds in its selected folder", [0, true], 0),
  ],
  negative: [
    rejected("a program that fails returns its status", [1], 1),
    rejected("a stalled harness registration returns failure", [0, false, true], 1),
    rejected("a stalled selected harness returns failure", [0, true, true], 1),
    rejected("a failing program in the selected folder returns its status", [3, true], 3),
  ],
};

export const installExecutableCases = {
  positive: [
    positive("Claude registration launches without PATH", [Harness.Claude, true], true),
    positive("Codex registration launches without PATH", [Harness.Codex, true], true),
  ],
  negative: [
    rejected("legacy Claude services retain their PATH command", [Harness.Claude, false], false),
    rejected("legacy Codex services retain their PATH command", [Harness.Codex, false], false),
  ],
};

export const installClaudeConnectionCases = {
  positive: [
    positive(
      "Claude MCP registration uses the selected project and pinned installation",
      [0, true, true],
      HarnessPlugin.Server,
    ),
    positive(
      "legacy services register Claude with the PATH command",
      [0, true, false],
      HarnessPlugin.Server,
    ),
  ],
  negative: [
    rejected(
      "Claude MCP registration failure is reported",
      [1, true, true],
      CliDiagnostic.ClaudeMcpFailed,
    ),
    rejected(
      "missing Claude leaves discoverable skills and reports registration skipped",
      [0, false, true],
      CliDiagnostic.ClaudeMcpSkipped,
    ),
  ],
};

export const installReleaseLauncherCases = {
  positive: [
    positive(
      "Claude registration follows a managed release switch",
      [Harness.Claude, "managed"],
      true,
    ),
    positive(
      "Codex registration follows a managed release switch",
      [Harness.Codex, "managed"],
      true,
    ),
  ],
  negative: [
    rejected(
      "Claude registration preserves its pin for a looped launcher",
      [Harness.Claude, "loop"],
      true,
    ),
    rejected(
      "Codex registration preserves its pin for a looped launcher",
      [Harness.Codex, "loop"],
      true,
    ),
    rejected(
      "Claude registration preserves its pin for an outside launcher",
      [Harness.Claude, "outside"],
      true,
    ),
    rejected(
      "Codex registration preserves its pin for an outside launcher",
      [Harness.Codex, "outside"],
      true,
    ),
    rejected(
      "Claude registration preserves an unrelated launcher file",
      [Harness.Claude, "file"],
      true,
    ),
    rejected(
      "Codex registration preserves an unrelated launcher file",
      [Harness.Codex, "file"],
      true,
    ),
    rejected(
      "Claude registration tolerates an absent managed launcher",
      [Harness.Claude, "missing"],
      true,
    ),
    rejected(
      "Codex registration tolerates an absent managed launcher",
      [Harness.Codex, "missing"],
      true,
    ),
  ],
};
