export const Improver = {
  DefaultPersona: "improver",
  Output: "improvement.json",
  InvocationId: "improver",
  ExecutionId: "improver-1",
} as const;

export const ImproveLoop = {
  FirstRound: 1,
  EvaluationRounds: 0,
  ClientId: "improve",
} as const;

export const ImproveLoopScenario = {
  RunId: "run-one",
  Broken: "name: broken",
  Home: "home",
  Command: "improve",
  HomeFlag: "--home",
  PartNone: "none",
  PartFull: "full",
  PartRounds: "rounds-only",
  AnswerSame: "same",
  AnswerBroken: "broken",
  ProjectRounds: 1,
  Description: "Persona",
  Role: "Contract role",
  Model: "stub-model",
  UnknownRun: "missing-run",
} as const;

export const ImproverOutput = {
  type: "object",
  properties: {
    workflow: { type: "string" },
    changes: {
      type: "array",
      items: {
        type: "object",
        properties: { change: { type: "string" }, reason: { type: "string" } },
        required: ["change", "reason"],
        additionalProperties: false,
      },
    },
    lessons: {
      type: "array",
      items: {
        type: "object",
        properties: {
          persona: { type: "string" },
          step: { type: "string" },
          text: { type: "string" },
        },
        required: ["persona", "step", "text"],
        additionalProperties: false,
      },
    },
  },
  required: ["workflow", "changes"],
  additionalProperties: false,
};

export const ImproverScenario = {
  Fixer: "fixer",
  Skeptic: "skeptic",
  Improver: "improver",
  StepId: "deliver",
  FixTask: "fix the report",
  CheckTask: "check the report",
  Marker: "report-marker",
  Evidence: "Evidence: the report omits the time zone",
  Rounds: 1,
  Attempts: 2,
  Name: "Improver record",
  Goal: "Produce a report that names its time zone",
  Replacement: "name: replacement",
  Change: "Ask the skeptic for the time zone",
  Reason: "The report omitted the time zone",
} as const;
