import { ConfigDefault, ErrorCode, RunStatus } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

export const capacitySettingsCases = {
  positive: [
    positive("one active agent without waiting", [1, 0], true),
    positive("bounded large waiting budget", [2, ConfigDefault.MaxPendingAgentsLimit], true),
  ],
  negative: [
    negative("zero active agents", [0, 1], { code: ErrorCode.Capacity }),
    negative("negative pending agents", [1, -1], { code: ErrorCode.Capacity }),
    negative("excessive pending agents", [1, ConfigDefault.MaxPendingAgentsLimit + 1], {
      code: ErrorCode.Capacity,
    }),
    negative("fractional pending agents", [1, 1.5], { code: ErrorCode.Capacity }),
  ],
};

export const capacityBudgetCases = {
  positive: [
    positive("cancellation retains another callback in the same run", [2, true, true], {
      outcomes: ["cancelled", "started", "started"],
      calls: ["owner", "second", "replacement"],
    }),
    positive("two different runs retain both waiting tasks", [2, false, false], {
      outcomes: ["started", "started", ErrorCode.Capacity],
      calls: ["owner", "first", "second"],
    }),
    positive("cancellation releases a same-run waiting slot", [1, true, true], {
      outcomes: ["cancelled", ErrorCode.Capacity, "started"],
      calls: ["owner", "replacement"],
    }),
    positive("cancellation releases a different-run waiting slot", [1, true, false], {
      outcomes: ["cancelled", ErrorCode.Capacity, "started"],
      calls: ["owner", "replacement"],
    }),
  ],
  negative: [
    rejected("zero waiting budget rejects every queued task", [0, false, false], {
      outcomes: [ErrorCode.Capacity, ErrorCode.Capacity, ErrorCode.Capacity],
      calls: ["owner"],
    }),
    rejected("one waiting slot rejects excess work", [1, false, true], {
      outcomes: ["started", ErrorCode.Capacity, ErrorCode.Capacity],
      calls: ["owner", "first"],
    }),
  ],
};

export const capacityOverlapCases = {
  positive: [
    positive("serial admission drains four tasks", [1, false], {
      peak: 1,
      active: 0,
      completed: 4,
      failures: 0,
    }),
    positive("two concurrent agents drain four tasks", [2, false], {
      peak: 2,
      active: 0,
      completed: 4,
      failures: 0,
    }),
  ],
  negative: [
    rejected("serial failure releases capacity", [1, true], {
      peak: 1,
      active: 0,
      completed: 4,
      failures: 1,
    }),
    rejected("parallel failure releases capacity", [2, true], {
      peak: 2,
      active: 0,
      completed: 4,
      failures: 1,
    }),
  ],
};

export const configuredAgentCapacityCases = {
  positive: [
    positive(
      "owner chooses separate active and pending budgets",
      [{ max_active_agents: 2, max_pending_agents: 1 }, true],
      { max_active_agents: 2, max_pending_agents: 1 },
    ),
    positive("owner disables waiting", [{ max_active_agents: 1, max_pending_agents: 0 }, true], {
      max_active_agents: 1,
      max_pending_agents: 0,
    }),
  ],
  negative: [
    negative("project cannot enlarge pending budget", [{ max_pending_agents: 5 }, false], {
      code: ErrorCode.OwnerSetting,
    }),
    negative("owner cannot configure a negative queue", [{ max_pending_agents: -1 }, true], {
      code: ErrorCode.InvalidConfig,
    }),
  ],
};

const untouched = { attempt: 1, refutations: 0, executions: 0, session: null };
export const capacityRunRecoveryCases = {
  positive: [
    positive("explicit resume admits the waiting worker", [true, false], {
      before: untouched,
      state: RunStatus.Passed,
      workerCalls: [1, 1],
      refutations: [0, 0],
      attempts: [1, 1],
    }),
    positive("reload and resume admit the waiting worker", [true, true], {
      before: untouched,
      state: RunStatus.Passed,
      workerCalls: [1, 1],
      refutations: [0, 0],
      attempts: [1, 1],
    }),
  ],
  negative: [
    rejected("blocked queue cannot invent a second worker result", [false, false], {
      before: untouched,
      state: RunStatus.Blocked,
      workerCalls: [1],
      refutations: [0, 0],
      attempts: [1, 1],
    }),
    rejected("reload cannot silently admit blocked work", [false, true], {
      before: untouched,
      state: RunStatus.Blocked,
      workerCalls: [1],
      refutations: [0, 0],
      attempts: [1, 1],
    }),
  ],
};

export const capacityAdmissionCases = {
  positive: [
    positive("ordinary run identifier", ["run-1", false], 1),
    positive("distinct client run identifier", ["other_run", false], 1),
  ],
  negative: [
    negative("cancelled task never starts", ["run-1", true], {
      code: ErrorCode.ExecutionInterrupted,
    }),
    negative("another cancelled task never starts", ["other_run", true], {
      code: ErrorCode.ExecutionInterrupted,
    }),
    negative("empty key cannot strand the queue", ["", false], { code: ErrorCode.InvalidId }),
    negative("path key cannot enter admission", ["../run", false], { code: ErrorCode.InvalidId }),
  ],
};

export const capacityFairnessCases = {
  positive: [
    positive(
      "one run cannot monopolize released slots",
      [false, false],
      ["first", "second", "sibling"],
    ),
    positive(
      "key ordering cannot change fair admission",
      [true, false],
      ["first", "second", "sibling"],
    ),
  ],
  negative: [
    rejected(
      "cancelled sibling cannot occupy a turn",
      [false, true],
      ["cancelled", "first", "second"],
    ),
    rejected(
      "reversed cancelled sibling cannot occupy a turn",
      [true, true],
      ["cancelled", "first", "second"],
    ),
  ],
};
