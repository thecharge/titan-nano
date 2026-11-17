import {
  ErrorCode,
  ExecutionPhase,
  RequestDecision,
  RunStatus,
  WorkspaceModeSetting,
} from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const scriptProcessCases = {
  positive: [
    positive(
      "approved script worker and falsifier use the production CLI",
      [false, false, RequestDecision.Approve],
      {
        state: RunStatus.Passed,
        scripts: 2,
        text: "good",
      },
    ),
    positive(
      "script checks and permissions survive production CLI restart",
      [true, true, RequestDecision.Approve],
      {
        state: RunStatus.Passed,
        scripts: 3,
        text: "good",
      },
    ),
  ],
  negative: [
    rejected(
      "denied CLI script permission starts no process",
      [false, false, RequestDecision.Deny],
      {
        state: RunStatus.Blocked,
        scripts: 0,
        text: null,
      },
    ),
    rejected("unanswered CLI script permission starts no process", [true, false, null], {
      state: RunStatus.Waiting,
      scripts: 0,
      text: null,
    }),
  ],
};

export const scriptWorkerFlowCases = {
  positive: [
    positive("script worker checkpoints survive a falsifier approval wait", [0, false], {
      state: RunStatus.Passed,
      starts: 2,
      refutations: 0,
    }),
    positive("script worker checkpoints survive check and falsifier approval waits", [0, true], {
      state: RunStatus.Passed,
      starts: 3,
      refutations: 0,
    }),
  ],
  negative: [
    rejected("a failed script worker cannot pass or become a quality refutation", [1, false], {
      state: RunStatus.Blocked,
      starts: 1,
      refutations: 0,
    }),
    rejected("a failed script worker starts neither its check nor falsifier", [1, true], {
      state: RunStatus.Blocked,
      starts: 1,
      refutations: 0,
    }),
  ],
};

export const scopedScriptAdmissionCases = {
  positive: [
    positive(
      "an approved worker dispatches its exact command",
      [ExecutionPhase.Worker, "valid", 0],
      { code: 0, starts: 1 },
    ),
    positive("an approved check retains a failed exit", ["check-0", "valid", 1], {
      code: 1,
      starts: 1,
    }),
    positive("an approved live falsifier uses the project directory", ["falsifier-0", "valid", 0], {
      code: 0,
      starts: 1,
    }),
    positive(
      "an explicitly isolated falsifier uses its exact review directory",
      ["falsifier-0", "valid", 0, WorkspaceModeSetting.Isolated],
      { code: 0, starts: 1 },
    ),
    positive(
      "an explicitly isolated falsifier retains a failed exit",
      ["falsifier-0", "valid", 1, WorkspaceModeSetting.Isolated],
      { code: 1, starts: 1 },
    ),
  ],
  negative: [
    rejected("a proof absent from the workflow cannot execute", ["proof-0-0", "valid", 0], {
      code: ErrorCode.PermissionDenied,
      starts: 0,
    }),
    rejected("another absent proof index cannot execute", ["proof-1-1", "valid", 0], {
      code: ErrorCode.PermissionDenied,
      starts: 0,
    }),
    rejected(
      "live falsifier permission cannot authorize a review copy",
      ["falsifier-0", "review-directory", 0],
      { code: ErrorCode.PermissionDenied, starts: 0 },
    ),
    rejected(
      "isolated falsifier permission cannot authorize the live project",
      ["falsifier-0", "project-directory", 0, WorkspaceModeSetting.Isolated],
      { code: ErrorCode.PermissionDenied, starts: 0 },
    ),
    rejected(
      "missing execution context starts no process",
      [ExecutionPhase.Worker, "missing-context", 0],
      { code: ErrorCode.PermissionDenied, starts: 0 },
    ),
    rejected(
      "a live script without a claim starts no process",
      [ExecutionPhase.Worker, "missing-binding", 0],
      {
        code: ErrorCode.PermissionDenied,
        starts: 0,
      },
    ),
    rejected(
      "a crossed execution starts no process",
      [ExecutionPhase.Worker, "wrong-execution", 0],
      {
        code: ErrorCode.PermissionDenied,
        starts: 0,
      },
    ),
    rejected("an absent step starts no process", [ExecutionPhase.Worker, "missing-step", 0], {
      code: ErrorCode.PermissionDenied,
      starts: 0,
    }),
    rejected("a stale attempt starts no process", [ExecutionPhase.Worker, "wrong-attempt", 0], {
      code: ErrorCode.PermissionDenied,
      starts: 0,
    }),
    rejected(
      "an unprepared workspace starts no process",
      [ExecutionPhase.Worker, "missing-work", 0],
      { code: ErrorCode.PermissionDenied, starts: 0 },
    ),
    rejected("a paused run starts no process", [ExecutionPhase.Worker, "paused", 0], {
      code: ErrorCode.PermissionDenied,
      starts: 0,
    }),
    rejected("a changed command starts no process", [ExecutionPhase.Worker, "wrong-command", 0], {
      code: ErrorCode.PermissionDenied,
      starts: 0,
    }),
    rejected(
      "a changed directory starts no process",
      [ExecutionPhase.Worker, "wrong-directory", 0],
      { code: ErrorCode.PermissionDenied, starts: 0 },
    ),
    rejected("an unknown falsifier starts no process", ["falsifier-99", "valid", 0], {
      code: ErrorCode.PermissionDenied,
      starts: 0,
    }),
    rejected("an unknown phase starts no process", ["other", "valid", 0], {
      code: ErrorCode.PermissionDenied,
      starts: 0,
    }),
    rejected("a decimal check index starts no process", ["check-0.0", "valid", 0], {
      code: ErrorCode.PermissionDenied,
      starts: 0,
    }),
    rejected("an empty check index starts no process", ["check-", "valid", 0], {
      code: ErrorCode.PermissionDenied,
      starts: 0,
    }),
    rejected("an exponent falsifier index starts no process", ["falsifier-0e0", "valid", 0], {
      code: ErrorCode.PermissionDenied,
      starts: 0,
    }),
    rejected("a padded falsifier index starts no process", ["falsifier-00", "valid", 0], {
      code: ErrorCode.PermissionDenied,
      starts: 0,
    }),
  ],
};

export const scopedScriptDeadlineCases = {
  positive: [
    positive(
      "worker can exceed the former ten-second deadline",
      [ExecutionPhase.Worker, "valid", 0, WorkspaceModeSetting.Live, 12, 10050],
      { code: 0, starts: 1 },
    ),
    positive(
      "falsifier can exceed the former ten-second deadline",
      ["falsifier-0", "valid", 0, WorkspaceModeSetting.Live, 12, 10050],
      { code: 0, starts: 1 },
    ),
  ],
  negative: [
    rejected(
      "worker obeys its declared short deadline",
      [ExecutionPhase.Worker, "valid", 0, WorkspaceModeSetting.Live, 0.01, 100],
      { code: ErrorCode.CommandTimeout, starts: 1 },
    ),
    rejected(
      "falsifier obeys its declared short deadline",
      ["falsifier-0", "valid", 0, WorkspaceModeSetting.Live, 0.01, 100],
      { code: ErrorCode.CommandTimeout, starts: 1 },
    ),
  ],
};

export const serverScriptCases = {
  positive: [
    positive(
      "approved production checks feed failure to the builder and pass after correction",
      [true, false, RequestDecision.Approve, false],
      { state: RunStatus.Passed, builders: 2, checkers: 1, fed: true, scripts: 2, text: "good" },
    ),
    positive(
      "an approved script writes the shared project without a worker agent",
      [false, true, RequestDecision.Approve, false],
      { state: RunStatus.Passed, builders: 0, checkers: 1, fed: false, scripts: 1, text: "good" },
    ),
    positive(
      "script approval survives server restart before dispatch",
      [false, true, RequestDecision.Approve, true],
      { state: RunStatus.Passed, builders: 0, checkers: 1, fed: false, scripts: 1, text: "good" },
    ),
  ],
  negative: [
    rejected(
      "a denied production script executes no command and starts no checker",
      [false, true, RequestDecision.Deny, false],
      { state: RunStatus.Blocked, builders: 0, checkers: 0, fed: false, scripts: 0, text: null },
    ),
    rejected("an unanswered script request cannot write the project", [false, true, null, false], {
      state: RunStatus.Waiting,
      builders: 0,
      checkers: 0,
      fed: false,
      scripts: 0,
      text: null,
    }),
  ],
};

export const scriptProofFlowCases = {
  positive: [
    positive("step proof runs twice before the falsifier", [0, 0, false], {
      state: RunStatus.Passed,
      starts: 4,
      proofs: 2,
      checkers: 1,
      refutations: 0,
    }),
    positive("completed proof invocation survives engine replacement", [0, 0, true], {
      state: RunStatus.Passed,
      starts: 4,
      proofs: 2,
      checkers: 1,
      refutations: 0,
    }),
  ],
  negative: [
    rejected("a later candidate runs its proof once", [0, 1, true, 2], {
      state: RunStatus.Failed,
      starts: 5,
      proofs: 3,
      checkers: 0,
      refutations: 2,
    }),
    rejected("failed proof skips the falsifier", [1, 1, false], {
      state: RunStatus.Failed,
      starts: 3,
      proofs: 2,
      checkers: 0,
      refutations: 1,
    }),
    rejected("changing proof answer refutes the candidate after restart", [0, 1, true], {
      state: RunStatus.Failed,
      starts: 3,
      proofs: 2,
      checkers: 0,
      refutations: 1,
    }),
  ],
};

export const scriptProofProcessCases = {
  positive: [
    positive("public server executes the approved proof twice", [false, RequestDecision.Approve], {
      state: RunStatus.Passed,
      scripts: 4,
      text: "good",
    }),
    positive("public proof workflow survives server replacement", [true, RequestDecision.Approve], {
      state: RunStatus.Passed,
      scripts: 4,
      text: "good",
    }),
  ],
  negative: [
    rejected("denied proof workflow starts no command", [false, RequestDecision.Deny], {
      state: RunStatus.Blocked,
      scripts: 0,
      text: null,
    }),
    rejected("unanswered proof workflow remains waiting", [true, null], {
      state: RunStatus.Waiting,
      scripts: 0,
      text: null,
    }),
  ],
};

export const goalProofProcessCases = {
  positive: [
    positive("public goal proof checks the final delivered files", [false, false], {
      state: RunStatus.Passed,
      scripts: 4,
      text: "good",
    }),
    positive("public goal verification survives server replacement", [true, false], {
      state: RunStatus.Passed,
      scripts: 4,
      text: "good",
    }),
  ],
  negative: [
    rejected("failed final proof refuses successful artifacts", [false, true], {
      state: RunStatus.Failed,
      scripts: 4,
      text: "good",
    }),
    rejected("failed final proof remains failed after server replacement", [true, true], {
      state: RunStatus.Failed,
      scripts: 4,
      text: "good",
    }),
  ],
};
