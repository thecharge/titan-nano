import { AgentTool, ErrorCode, ExitCode, RunStatus, WorkflowSourceFixture } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

const stringOutput = { note: { type: "string" } };
const stringInput = { source: { type: "string" } };
const stringItems = { type: "string" };
const arrayOutput = { notes: { type: "array", items: stringItems } };
const invalidFormat = { source: { type: "not-a-json-type" } };
const personas = {
  writer: {
    description: "Writer",
    role: "Produce",
    inputs: stringInput,
    outputs: stringOutput,
  },
  checker: { description: "Checker", role: "Refute independently" },
};
const first = {
  id: "a",
  do: { persona: "writer", task: "Produce" },
  falsify: [{ persona: "checker", task: "Check" }],
};
const second = { ...first, id: "b" };
const base = { name: "Workflow contract", goal: "A typed artifact", personas };

const graphFirst = { ...first, needs: [] };
const graphSecond = { ...second, needs: [] };
const diamondNodes = [
  graphFirst,
  { ...second, needs: [first.id] },
  { ...first, id: "c", needs: [first.id] },
  { ...first, id: "d", needs: [second.id, "c"], inputs: { source: "a.note" } },
];
const diamond = { ...base, graph: { nodes: diamondNodes } };
const independent = { ...base, graph: { nodes: [graphFirst, graphSecond] } };
const duplicate = { ...base, graph: { nodes: [graphFirst, graphFirst] } };
const cyclicNodes = [
  { ...first, needs: [second.id] },
  { ...second, needs: [first.id] },
];
const cyclic = { ...base, graph: { nodes: cyclicNodes } };
const missingNodes = [{ ...first, needs: [second.id] }];
const missing = { ...base, graph: { nodes: missingNodes } };

const grouped = { ...base, steps: [first, { parallel: [second] }] };
const displayNodes = [
  { ...second, needs: ["a"], inputs: { source: "a.note" } },
  { ...first, needs: [] },
];
const display = { ...base, graph: { nodes: displayNodes } };
const ambiguous = { ...base, steps: [{ ...first, needs: [] }] };
const invalidInputPersonas = {
  ...personas,
  writer: { ...personas.writer, inputs: invalidFormat },
};
const invalidOutputPersonas = {
  ...personas,
  writer: { ...personas.writer, outputs: invalidFormat },
};
const invalidInput = { ...base, personas: invalidInputPersonas, steps: [first] };
const invalidOutput = { ...base, personas: invalidOutputPersonas, steps: [first] };
const absentSteps = [first, { ...second, inputs: { source: "a.absent" } }];
const absent = { ...base, steps: absentSteps };

const completeCheck = { ...base, steps: [first] };
const missingGoalCheck = { name: base.name, personas, steps: [first] };
const missingIdentityCheck = { personas, steps: [first] };
const missingTaskAction = { persona: "writer" };
const missingTaskStep = { ...first, do: missingTaskAction };
const missingTaskCheck = { ...base, steps: [{ sequential: [missingTaskStep] }] };
const invalidRoleWriter = { ...personas.writer, role: 42 };
const invalidRolePersonas = { ...personas, writer: invalidRoleWriter };
const invalidRoleCheck = { ...completeCheck, personas: invalidRolePersonas };
const invalidPersonaKeyCheck = {
  ...completeCheck,
  personas: { ...personas, "bad persona": personas.writer },
};

export const workflowCheckCases = {
  positive: [
    positive("human and JSON checks accept grouped work", [completeCheck, true, []], true),
    positive("human and JSON checks accept dependency graphs", [diamond, true, []], true),
  ],
  negative: [
    rejected(
      "missing goal reports its required path before execution",
      [missingGoalCheck, false, ["goal", "Required"]],
      true,
    ),
    rejected(
      "missing name and goal both retain their paths",
      [missingIdentityCheck, false, ["name", "goal", "Required"]],
      true,
    ),
    rejected(
      "nested task failure retains its complete path",
      [missingTaskCheck, false, ["steps[0].sequential[0].do.task", "Required"]],
      true,
    ),
    rejected(
      "wrong persona role reports its complete path",
      [invalidRoleCheck, false, ["personas.writer.role", "string"]],
      true,
    ),
    rejected(
      "invalid persona name retains its record path",
      [invalidPersonaKeyCheck, false, ['personas["bad persona"]', "Invalid"]],
      true,
    ),
  ],
};

const inputSource = { ...first, id: "b" };
const planFormats = { plan: { type: "string" } };
const inputWriter = { ...personas.writer, inputs: planFormats, outputs: planFormats };
const validationInputPersonas = { ...personas, writer: inputWriter };
const validationInputBase = { ...base, personas: validationInputPersonas };
const inputConsumer = { ...second, id: "c", inputs: { plan: "b.plan" } };
const orderedInputs = { ...validationInputBase, steps: [inputSource, inputConsumer] };
const inputBridge = { ...first, id: "bridge", needs: ["b"] };
const transitiveInputNodes = [
  { ...inputSource, needs: [] },
  inputBridge,
  { ...inputConsumer, needs: ["bridge"] },
];
const transitiveInputs = { ...validationInputBase, graph: { nodes: transitiveInputNodes } };
const parallelInputs = {
  ...validationInputBase,
  steps: [{ parallel: [inputSource, inputConsumer] }],
};
const reversedParallelInputs = {
  ...validationInputBase,
  steps: [{ parallel: [inputConsumer, inputSource] }],
};
const causeInput = { cause: { type: "string" } };
const causeItems = { type: "string" };
const listCause = { root_cause: { type: "array", items: causeItems } };
const numberCause = { root_cause: { type: "number" } };
const causeWriter = { ...personas.writer, outputs: listCause };
const causeConsumer = { ...personas.writer, inputs: causeInput };
const causePersonas = { ...personas, writer: causeWriter, consumer: causeConsumer };
const inputCauseStep = { ...first, id: "cause" };
const fixAction = { persona: "consumer", task: "Use the cause" };
const inputFixStep = { ...second, id: "fix", do: fixAction, inputs: { cause: "cause.root_cause" } };
const mismatchedInputs = {
  ...base,
  personas: causePersonas,
  steps: [inputCauseStep, inputFixStep],
};
const numberWriter = { ...causeWriter, outputs: numberCause };
const numberPersonas = { ...causePersonas, writer: numberWriter };
const numberInputs = { ...mismatchedInputs, personas: numberPersonas };
const describedOutput = { note: { type: "string", description: "A checked note" } };
const describedInput = { source: { description: "A checked note", type: "string" } };
const describedWriter = { ...personas.writer, outputs: describedOutput };
const describedConsumer = { ...personas.writer, inputs: describedInput };
const describedPersonas = { ...personas, writer: describedWriter, consumer: describedConsumer };
const describedAction = { ...second.do, persona: "consumer" };
const describedStep = { ...second, do: describedAction, inputs: { source: "a.note" } };
const reorderedFormats = { ...base, personas: describedPersonas, steps: [first, describedStep] };

export const workflowInputCases = {
  positive: [
    positive("sequential predecessor supplies a matching format", [orderedInputs, null, []], true),
    positive(
      "transitive graph predecessor supplies a matching format",
      [transitiveInputs, null, []],
      true,
    ),
    positive(
      "format property order does not change the contract",
      [reorderedFormats, null, []],
      true,
    ),
  ],
  negative: [
    rejected(
      "parallel peer cannot supply an unfinished input",
      [
        parallelInputs,
        ErrorCode.InputDependency,
        ["c uses b, but b may not be finished before c starts"],
      ],
      true,
    ),
    rejected(
      "reversed parallel display cannot authorize an input",
      [
        reversedParallelInputs,
        ErrorCode.InputDependency,
        ["c uses b, but b may not be finished before c starts"],
      ],
      true,
    ),
    rejected(
      "list output cannot satisfy a string input",
      [
        mismatchedInputs,
        ErrorCode.FormatMismatch,
        ["fix.inputs.cause", "cause.root_cause", '"type":"string"', '"type":"array"'],
      ],
      true,
    ),
    rejected(
      "number output cannot satisfy a string input",
      [
        numberInputs,
        ErrorCode.FormatMismatch,
        ["fix.inputs.cause", "cause.root_cause", '"type":"string"', '"type":"number"'],
      ],
      true,
    ),
  ],
};

export const answerCases = {
  positive: [
    positive("declared string output", [stringOutput, { note: "done" }], {
      note: "done",
    }),
    positive("declared array output", [arrayOutput, { notes: ["one", "two"] }], {
      notes: ["one", "two"],
    }),
  ],
  negative: [
    negative("wrong output type", [stringOutput, { note: 1 }], {
      name: "ZodError",
    }),
    negative("missing required output", [stringOutput, {}], { name: "ZodError" }),
    negative("undeclared output is rejected", [stringOutput, { note: "done", extra: true }], {
      name: "ZodError",
    }),
  ],
};

export const workflowCases = {
  positive: [
    positive(
      "diamond branches share upstream ancestry",
      [diamond],
      [
        ["a", []],
        ["b", ["a"]],
        ["c", ["a"]],
        ["d", ["b", "c"]],
      ],
    ),
    positive(
      "independent nodes have separate ancestry",
      [independent],
      [
        ["a", []],
        ["b", []],
      ],
    ),
    positive(
      "group ordering supplies predecessor dependencies",
      [grouped],
      [
        ["a", []],
        ["b", ["a"]],
      ],
    ),
    positive(
      "graph display order does not reorder execution dependencies",
      [display],
      [
        ["b", ["a"]],
        ["a", []],
      ],
    ),
  ],
  negative: [
    negative("duplicate nodes cannot replace an earlier definition", [duplicate], {
      code: ErrorCode.DuplicateStep,
    }),
    negative("a dependency cycle cannot reuse incomplete ancestry", [cyclic], {
      code: ErrorCode.DependencyCycle,
    }),
    negative("unknown dependencies cannot pass validation", [missing], {
      code: ErrorCode.MissingDependency,
    }),
    negative("group nodes cannot also declare graph dependencies", [ambiguous], {
      code: ErrorCode.AmbiguousDependencies,
    }),
    negative("unsupported input format is rejected", [invalidInput], {
      code: ErrorCode.InvalidFormat,
    }),
    negative("unsupported output format is rejected", [invalidOutput], {
      code: ErrorCode.InvalidFormat,
    }),
    negative("undeclared upstream format cannot satisfy typed input", [absent], {
      code: ErrorCode.FormatMismatch,
    }),
  ],
};

const groupedPersonas = {
  ...personas,
  writer: { ...personas.writer, tools: [AgentTool.Write] },
};
const groupBase = { ...base, personas: groupedPersonas };

const parallelGroup = { parallel: [first, second] };
const reversedParallelGroup = { parallel: [second, first] };
const nestedSequentialGroup = { sequential: [reversedParallelGroup] };
const sequentialGroup = { sequential: [first, second] };
const joinStep = { ...first, id: "join" };
const parallelExecution = { ...groupBase, steps: [parallelGroup] };
const reversedExecution = { ...groupBase, steps: [reversedParallelGroup] };
const nestedExecution = { ...groupBase, steps: [nestedSequentialGroup] };
const sequentialExecution = { ...groupBase, steps: [sequentialGroup] };
const joinedExecution = { ...groupBase, steps: [parallelGroup, joinStep] };

export const groupedRunCases = {
  positive: [
    positive(
      "parallel group starts its second step before the first passes",
      [parallelExecution, "a", "b", 2],
      true,
    ),
    positive(
      "reversed nested parallel group retains overlap",
      [nestedExecution, "b", "a", 2],
      true,
    ),
  ],
  negative: [
    rejected(
      "sequential group waits for the first complete checked result",
      [sequentialExecution, "a", "b", 2],
      false,
    ),
    rejected(
      "a step after a parallel group waits for every member",
      [joinedExecution, "b", "join", 2],
      false,
    ),
    rejected(
      "one configured place prevents worker overlap in an ordinary parallel group",
      [parallelExecution, "a", "b", 1, false],
      false,
    ),
    rejected(
      "one configured place prevents worker overlap in a reversed parallel group",
      [reversedExecution, "b", "a", 1, false],
      false,
    ),
  ],
};

const causeOutput = { root_cause: { type: "string" } };
const fixInput = { cause: { type: "string" } };
const inputPersonas = {
  cause: {
    description: "Find cause",
    role: "Find the cause",
    tools: [AgentTool.Write],
    outputs: causeOutput,
  },
  fix: {
    description: "Fix cause",
    role: "Use the checked cause",
    tools: [AgentTool.Write],
    inputs: fixInput,
    outputs: stringOutput,
  },
  checker: personas.checker,
};
const causeStep = {
  id: "cause",
  do: { persona: "cause", task: "Find the root cause" },
  falsify: [{ persona: "checker", task: "Check the cause" }],
};
const fixStep = {
  id: "fix",
  needs: ["cause"],
  inputs: { cause: "cause.root_cause" },
  do: { persona: "fix", task: "Fix the checked cause" },
  falsify: [{ persona: "checker", task: "Check the fix" }],
};
const causeGraph = { ...causeStep, needs: [] };
const inputBase = {
  name: "Checked inputs",
  goal: "Pass only kept outputs",
  personas: inputPersonas,
};
const normalInputs = { ...inputBase, graph: { nodes: [causeGraph, fixStep] } };
const reversedInputs = { ...inputBase, graph: { nodes: [fixStep, causeGraph] } };
const exhaustedCause = { ...causeGraph, max_attempts: 1 };
const exhaustedInputs = {
  ...inputBase,
  graph: { nodes: [exhaustedCause, fixStep] },
};
const acceptedInputs = { passed: true, attempt: 1, refutations: 0, consumer: true };
export const keptInputCases = {
  positive: [
    positive(
      "kept cause reaches the worker and persisted task",
      [normalInputs, false],
      acceptedInputs,
    ),
    positive(
      "reverse presentation retains the same declared input",
      [reversedInputs, false],
      acceptedInputs,
    ),
  ],
  negative: [
    rejected("a refuted first candidate cannot reach the consumer", [normalInputs, true], {
      ...acceptedInputs,
      attempt: 2,
      refutations: 1,
    }),
    rejected("an exhausted producer cannot start its consumer", [exhaustedInputs, true], {
      passed: false,
      attempt: 1,
      refutations: 1,
      consumer: false,
    }),
  ],
};

const branchFirst = { ...first, max_attempts: 1 };
const branchSecond = { ...second, max_attempts: 1 };
const branchParallel = { parallel: [branchFirst, branchSecond] };
const branchReverse = { parallel: [branchSecond, branchFirst] };
const branchWorkflow = { ...groupBase, steps: [branchParallel, joinStep] };
const reverseBranchWorkflow = { ...groupBase, steps: [branchReverse, joinStep] };
const branchPassed = {
  code: ExitCode.Success,
  state: RunStatus.Passed,
  workers: ["a", "b", "join"],
};
const branchFailed = { code: ExitCode.Unsuccessful, state: RunStatus.Failed, workers: ["a", "b"] };

export const cliBranchFailureCases = {
  positive: [
    positive(
      "complete parallel branches admit their join and write a result",
      [branchWorkflow, null],
      branchPassed,
    ),
    positive(
      "reversed complete branches retain their join and result",
      [reverseBranchWorkflow, null],
      branchPassed,
    ),
  ],
  negative: [
    rejected(
      "a refuted first branch preserves its peer and skips the join",
      [branchWorkflow, "a"],
      branchFailed,
    ),
    rejected(
      "a refuted reversed branch preserves its peer and skips the join",
      [reverseBranchWorkflow, "b"],
      branchFailed,
    ),
  ],
};

export const cliResultPathCases = {
  positive: [
    positive("human passing output prints the result path", [RunStatus.Passed, false], true),
    positive("human failed output prints the result path", [RunStatus.Failed, false], true),
  ],
  negative: [
    rejected("machine passing output remains one JSON value", [RunStatus.Passed, true], true),
    rejected("machine failed output remains one JSON value", [RunStatus.Failed, true], true),
  ],
};

export const workflowSourceCreationCases = {
  positive: [
    positive(
      "YAML source is detached before asynchronous creation",
      [WorkflowSourceFixture.Yaml],
      true,
    ),
    positive("JSON source retains its original formatting", [WorkflowSourceFixture.Json], true),
  ],
  negative: [
    rejected("changed source plan cannot invoke a backend", [WorkflowSourceFixture.Mismatch], true),
    rejected("oversized source cannot create run storage", [WorkflowSourceFixture.TooLarge], true),
  ],
};
