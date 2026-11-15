import { ErrorCode, GraphValidationMode } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

const mixed = [["a"], ["b", "a"], ["c", "a"], ["d", "b"], ["e", "c", "d"]];
const groups = [["one"], ["b", "one"], ["c", "one"], ["e", "b", "c"]];

export const graphValidationCases = {
  positive: [
    positive(
      "mixed dry run retains branch-specific dependencies",
      [GraphValidationMode.Mixed, mixed, []],
      true,
    ),
    positive(
      "reversed display retains every dependency edge",
      [GraphValidationMode.Reversed, [...mixed].reverse(), []],
      true,
    ),
    positive(
      "groups compile to equivalent predecessor edges",
      [GraphValidationMode.Groups, groups, []],
      true,
    ),
  ],
  negative: [
    rejected(
      "dependency cycle starts no run",
      [GraphValidationMode.Cycle, ErrorCode.DependencyCycle, ["a -> e -> c -> a"]],
      true,
    ),
    rejected(
      "input producer must be a dependency",
      [GraphValidationMode.Input, ErrorCode.InputDependency, ["d.inputs", "uses b"]],
      true,
    ),
    rejected(
      "two scheduling forms start no run",
      [
        GraphValidationMode.Forms,
        ErrorCode.InvalidWorkflow,
        ["exactly one of steps or graph.nodes"],
      ],
      true,
    ),
    rejected(
      "missing dependency starts no run",
      [GraphValidationMode.Missing, ErrorCode.MissingDependency, ["Unknown dependency: absent"]],
      true,
    ),
    rejected(
      "duplicate identifier starts no run",
      [GraphValidationMode.Duplicate, ErrorCode.DuplicateStep, ["Duplicate step id: a"]],
      true,
    ),
    rejected(
      "group cannot also declare graph edges",
      [
        GraphValidationMode.GroupNeeds,
        ErrorCode.AmbiguousDependencies,
        ["a: needs is only valid in graph mode"],
      ],
      true,
    ),
  ],
};
