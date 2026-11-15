import { StepStatus, Verdict } from "@titan/constants";
import { RunnerMessage } from "@titan/messages";
import { positive, rejected } from "@titan/test-factories";

const passedKeys = ["candidate", "goal", "inputs", "step_task", "task"];
const clean = { resumed_own: false, resumed_foreign: false };
const workerKeys = ["goal", "inputs", "prior_refutations", "steps", "task"];

export const allFalsifiersSurviveCases = {
  positive: [
    positive("persona survived and script exits 0", [Verdict.Survived, 0, ""], StepStatus.Passed),
    positive(
      "script output on a clean exit is not evidence",
      [Verdict.Survived, 0, "noise"],
      StepStatus.Passed,
    ),
  ],
  negative: [
    rejected(
      "persona refuting fails the step",
      [Verdict.Refuted, 0, ""],
      `${StepStatus.Failed}|persona evidence`,
    ),
    rejected(
      "script exit 3 fails the step",
      [Verdict.Survived, 3, "bad"],
      `${StepStatus.Failed}|bad`,
    ),
  ],
};

export const oneFalsifierRefutesCases = {
  positive: [
    positive(
      "script exit 1 stores its output as evidence",
      [Verdict.Survived, 1, "fails for an empty list", ""],
      `${StepStatus.Failed}|fails for an empty list`,
    ),
    positive(
      "standard output and standard error are both evidence",
      [Verdict.Survived, 2, "out ", "err"],
      `${StepStatus.Failed}|out err`,
    ),
    positive(
      "silent nonzero exit still has evidence",
      [Verdict.Survived, 1, "", ""],
      `${StepStatus.Failed}|${RunnerMessage.ScriptExit}`,
    ),
  ],
  negative: [
    rejected(
      "script exit 0 keeps the result",
      [Verdict.Survived, 0, "ignored", ""],
      StepStatus.Passed,
    ),
    rejected(
      "both falsifiers refuting keep both pieces of evidence",
      [Verdict.Refuted, 1, "script says no", ""],
      `${StepStatus.Failed}|persona evidence|script says no`,
    ),
  ],
};

export const refutedWithoutEvidenceCases = {
  positive: [
    positive(
      "empty evidence is asked again and a survived answer passes",
      [{ verdict: Verdict.Survived, evidence: "Checked" }],
      `2 ${StepStatus.Passed}`,
    ),
    positive(
      "empty evidence is asked again and a real refutation counts",
      [{ verdict: Verdict.Refuted, evidence: "real flaw" }],
      `2 ${StepStatus.Failed}`,
    ),
  ],
  negative: [
    rejected(
      "empty evidence twice blocks the step",
      [{ verdict: Verdict.Refuted, evidence: "" }],
      `2 ${StepStatus.Blocked}`,
    ),
    rejected(
      "unknown verdict on the second answer blocks the step",
      [{ verdict: "maybe", evidence: "x" }],
      `2 ${StepStatus.Blocked}`,
    ),
  ],
};

export const falsifierTaskCases = {
  positive: [
    positive("first falsifier holds goal, step task, result and its own task", ["falsifier-0"], {
      keys: passedKeys,
      goal: "Deliver a checked file",
      task: "Refute",
      step_task: "Solve",
      candidate: { done: true },
    }),
    positive("second falsifier holds its own task", ["falsifier-1"], {
      keys: passedKeys,
      goal: "Deliver a checked file",
      task: "Probe",
      step_task: "Solve",
      candidate: { done: true },
    }),
  ],
  negative: [
    rejected("worker task has refutations and no result", ["worker"], {
      keys: workerKeys,
      goal: "Deliver a checked file",
      task: "Solve",
      step_task: null,
      candidate: null,
    }),
    rejected("a falsifier that never ran has no task record", ["falsifier-9"], {
      keys: [],
      step_task: null,
      candidate: null,
    }),
  ],
};

export const falsifierSessionCases = {
  positive: [
    positive("falsifier starts fresh", [false, "falsifier-0"], { ...clean, keys: passedKeys }),
    positive("retried falsifier resumes only its own session", [true, "falsifier-0"], {
      resumed_own: true,
      resumed_foreign: false,
      keys: passedKeys,
    }),
  ],
  negative: [
    rejected("worker prompt carries refutations not seen by falsifiers", [false, "worker"], {
      ...clean,
      keys: workerKeys,
    }),
    rejected("worker is not resumed when only the falsifier is retried", [true, "worker"], {
      ...clean,
      keys: workerKeys,
    }),
  ],
};
