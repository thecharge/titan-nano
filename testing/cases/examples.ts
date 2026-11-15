import { ExampleCheckMutation, ExampleMutation, WorkflowExample } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const workflowExampleCases = {
  positive: [
    positive(
      "code fix repeats the specified offline command and records",
      [WorkflowExample.CodeFix, ExampleMutation.None],
      true,
    ),
    positive(
      "science claim retains independent challenge evidence",
      [WorkflowExample.ScienceClaim, ExampleMutation.None],
      true,
    ),
    positive(
      "business plan records the complete mixed workflow",
      [WorkflowExample.BusinessPlan, ExampleMutation.None],
      true,
    ),
    positive(
      "everyday plan records sequential dependency inputs",
      [WorkflowExample.EverydayProblem, ExampleMutation.None],
      true,
    ),
  ],
  negative: [
    rejected(
      "missing business replies block without spending quality attempts",
      [WorkflowExample.BusinessPlan, ExampleMutation.Missing],
      true,
    ),
    rejected(
      "malformed code-fix answers create no run",
      [WorkflowExample.CodeFix, ExampleMutation.Malformed],
      true,
    ),
  ],
};

export const workflowExamplesCheckCases = {
  positive: [
    positive(
      "check every maintained example in human output",
      [false, ExampleCheckMutation.None],
      true,
    ),
    positive(
      "check every maintained example in versioned JSON",
      [true, ExampleCheckMutation.None],
      true,
    ),
  ],
  negative: [
    rejected(
      "later invalid workflow identifies its file and field",
      [false, ExampleCheckMutation.Invalid],
      true,
    ),
    rejected(
      "JSON batch fails without partial success on invalid input",
      [true, ExampleCheckMutation.Invalid],
      true,
    ),
    rejected(
      "missing later workflow identifies its path",
      [true, ExampleCheckMutation.Missing],
      true,
    ),
    rejected("empty batch path is refused before I/O", [true, ExampleCheckMutation.Empty], true),
    rejected(
      "excess positional count is refused before I/O",
      [true, ExampleCheckMutation.Count],
      true,
    ),
    rejected(
      "combined JSON output exceeds its bounded budget",
      [true, ExampleCheckMutation.Output],
      true,
    ),
  ],
};

export const cliBatchCheckCases = {
  positive: [
    positive("human batch emits each validated file", [false, ExampleCheckMutation.None], true),
    positive(
      "JSON batch retains order and resolved plans",
      [true, ExampleCheckMutation.None],
      true,
    ),
  ],
  negative: [
    rejected(
      "empty positional prevents every source load",
      [true, ExampleCheckMutation.Empty],
      true,
    ),
    rejected(
      "excess positionals prevent every source load",
      [true, ExampleCheckMutation.Count],
      true,
    ),
    rejected(
      "human validation error retains earlier check and offending path",
      [false, ExampleCheckMutation.Invalid],
      true,
    ),
    rejected(
      "JSON validation error emits no partial response",
      [true, ExampleCheckMutation.Invalid],
      true,
    ),
    rejected(
      "plain source error includes the later file path",
      [true, ExampleCheckMutation.Missing],
      true,
    ),
    rejected(
      "response budget rejects accumulated plans",
      [true, ExampleCheckMutation.Output],
      true,
    ),
  ],
};
