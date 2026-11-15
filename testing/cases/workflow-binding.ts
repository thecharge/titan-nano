import { AgentTool, Backend, CliCommand, ErrorCode } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

const personas = {
  worker: { description: "Worker", role: "Deliver" },
  checker: { description: "Checker", role: "Refute" },
};
const first = {
  name: "First revision",
  goal: "Validate one revision",
  defaults: { backend: Backend.Fake },
  personas,
  steps: [
    {
      id: "first",
      do: { persona: "worker", task: "Deliver" },
      falsify: [{ persona: "checker", task: "Check" }],
    },
  ],
};
const second = {
  ...first,
  defaults: { backend: Backend.Claude },
  steps: [{ ...first.steps[0], id: "second" }],
};
const shell = {
  ...second,
  personas: { ...personas, checker: { ...personas.checker, tools: [AgentTool.Bash] } },
};

export const cliWorkflowBindingCases = {
  positive: [
    positive("check binds the first document and its settings", [CliCommand.Check, first, second], {
      exit: 0,
      reads: 1,
      ids: ["first"],
      backend: Backend.Fake,
    }),
    positive("dry run binds the first document and its settings", [CliCommand.Run, second, first], {
      exit: 0,
      reads: 1,
      ids: ["second"],
      backend: Backend.Claude,
    }),
  ],
  negative: [
    negative(
      "later valid data cannot hide the initial invalid workflow",
      [CliCommand.Check, { ...first, goal: "" }, second],
      { code: ErrorCode.InvalidWorkflow },
    ),
    negative(
      "later allowed tools cannot hide the initial shell request",
      [CliCommand.Run, shell, second],
      { code: ErrorCode.PermissionDenied },
    ),
  ],
};
export const mcpConfiguredCheckCases = {
  positive: [
    positive(
      "owner default selects supported Claude file tools",
      [{ defaults: { backend: Backend.Claude } }, {}, [AgentTool.Read]],
      true,
    ),
    positive(
      "explicit backend overrides owner default",
      [{ defaults: { backend: Backend.Claude } }, {}, [AgentTool.Bash], Backend.Fake],
      true,
    ),
    positive(
      "project limit permits the exact node count",
      [{}, { limits: { max_steps: 2, max_group_depth: 2 } }, [], undefined, true],
      true,
    ),
  ],
  negative: [
    rejected(
      "owner backend cannot lose its permission check",
      [{ defaults: { backend: Backend.Claude } }, {}, [AgentTool.Bash]],
      false,
    ),
    rejected(
      "project backend overrides owner backend",
      [
        { defaults: { backend: Backend.Fake } },
        { defaults: { backend: Backend.Claude } },
        [AgentTool.Bash],
      ],
      false,
    ),
    rejected("project node ceiling is enforced", [{}, { limits: { max_steps: 1 } }, []], false),
    rejected(
      "project group depth is enforced",
      [{}, { limits: { max_group_depth: 1 } }, [], undefined, true],
      false,
    ),
    rejected(
      "project cannot set home-owner settings",
      [{}, { server: { max_active_agents: 1 } }, []],
      false,
    ),
  ],
};
