import { Backend, ErrorCode, RunStatus } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

export const backendCapacitySettingsCases = {
  positive: [
    positive("independent native limits", [{ [Backend.Claude]: 1, [Backend.Codex]: 2 }], {
      [Backend.Claude]: 1,
      [Backend.Codex]: 2,
    }),
    positive("null retains only the shared ceiling", [{ [Backend.Codex]: null }], {
      [Backend.Codex]: null,
    }),
    positive("absent backend limits preserve legacy shape", [{}], {}),
  ],
  negative: [
    negative("zero Claude capacity", [{ [Backend.Claude]: 0 }], { name: "ZodError" }),
    negative("negative Codex capacity", [{ [Backend.Codex]: -1 }], { name: "ZodError" }),
    negative("fractional capacity", [{ [Backend.Claude]: 1.5 }], { name: "ZodError" }),
    negative("unknown backend cannot acquire an unbounded counter", [{ unknown: 1 }], {
      name: "ZodError",
    }),
  ],
};

const drained = { peerBeforeRelease: true, starts: 2, peak: 1, active: 0, queuedResult: null };
const cancelled = { ...drained, starts: 1, queuedResult: "cancelled" };
const failed = { ...drained, queuedResult: "failed" };
const refused = { ...drained, starts: 1, queuedResult: ErrorCode.Capacity };
export const backendCapacityAdmissionCases = {
  positive: [
    positive(
      "same run continues Codex while Claude is saturated",
      [Backend.Claude, true, false, false],
      drained,
    ),
    positive(
      "other run continues Claude while Codex is saturated",
      [Backend.Codex, false, false, false],
      drained,
    ),
    positive(
      "same run continues Claude while Codex is saturated",
      [Backend.Codex, true, false, false],
      drained,
    ),
    positive(
      "other run continues Codex while Claude is saturated",
      [Backend.Claude, false, false, false],
      drained,
    ),
  ],
  negative: [
    rejected(
      "cancelled Claude waiter never starts",
      [Backend.Claude, true, true, false],
      cancelled,
    ),
    rejected("cancelled Codex waiter never starts", [Backend.Codex, false, true, false], cancelled),
    rejected(
      "failed Claude work releases its backend slot",
      [Backend.Claude, true, false, true],
      failed,
    ),
    rejected(
      "failed Codex work releases its backend slot",
      [Backend.Codex, false, false, true],
      failed,
    ),
    rejected(
      "zero pending refuses saturated Claude but permits Codex",
      [Backend.Claude, true, false, false, 0],
      refused,
    ),
    rejected(
      "zero pending refuses saturated Codex but permits Claude",
      [Backend.Codex, false, false, false, 0],
      refused,
    ),
  ],
};

const passed = {
  peerBeforeRelease: true,
  peak: 1,
  active: 0,
  state: RunStatus.Passed,
  peerState: null,
  attempts: [1, 1, 1],
  refutations: [0, 0, 0],
};
const split = { ...passed, peerState: RunStatus.Passed, attempts: [1, 1], refutations: [0, 0] };
export const backendCapacityRunCases = {
  positive: [
    positive("parallel graph routes Claude admissions", [Backend.Claude, false, false], passed),
    positive("parallel graph routes Codex admissions", [Backend.Codex, false, false], passed),
    positive("two runs share the Claude limit", [Backend.Claude, true, false], split),
    positive("two runs share the Codex limit", [Backend.Codex, true, false], split),
    positive("Claude checkers share the backend limit", [Backend.Claude, true, false, true], split),
    positive("Codex checkers share the backend limit", [Backend.Codex, true, false, true], split),
  ],
  negative: [
    rejected("cancel held Claude checker", [Backend.Claude, true, true, true], {
      ...split,
      state: RunStatus.Cancelled,
    }),
    rejected("cancel held Codex checker", [Backend.Codex, true, true, true], {
      ...split,
      state: RunStatus.Cancelled,
    }),
    rejected("cancel Claude owner while Codex peer completes", [Backend.Claude, true, true], {
      ...split,
      state: RunStatus.Cancelled,
    }),
    rejected("cancel Codex owner while Claude peer completes", [Backend.Codex, true, true], {
      ...split,
      state: RunStatus.Cancelled,
    }),
  ],
};

export const configuredBackendCapacityCases = {
  positive: [
    positive("owner limits Claude separately", [{ [Backend.Claude]: 1 }, true, false], {
      [Backend.Claude]: 1,
    }),
    positive(
      "owner retains only the shared Codex limit",
      [{ [Backend.Codex]: null }, true, false],
      { [Backend.Codex]: null },
    ),
  ],
  negative: [
    negative("project cannot set backend capacity", [{ [Backend.Claude]: 2 }, false, false], {
      code: ErrorCode.OwnerSetting,
    }),
    negative("workflow cannot set backend capacity", [{ [Backend.Codex]: 2 }, false, true], {
      code: ErrorCode.OwnerSetting,
    }),
    negative(
      "owner cannot disable Claude with zero capacity",
      [{ [Backend.Claude]: 0 }, true, false],
      { code: ErrorCode.InvalidConfig },
    ),
  ],
};

const observed = {
  peak: 1,
  active: 0,
  state: RunStatus.Passed,
  peerState: RunStatus.Passed,
  attempts: [1, 1],
  refutations: [0, 0],
};
export const backendCapacityServerCases = {
  positive: [
    positive("HTTP workflows share the owner Claude limit", [Backend.Claude, false], observed),
    positive("HTTP workflows share the owner Codex limit", [Backend.Codex, false], observed),
    positive("HTTP Claude checkers use owner limit", [Backend.Claude, false, true], observed),
    positive("HTTP Codex checkers use owner limit", [Backend.Codex, false, true], observed),
  ],
  negative: [
    rejected("HTTP cancellation releases Claude checker", [Backend.Claude, true, true], {
      ...observed,
      state: RunStatus.Cancelled,
    }),
    rejected("HTTP cancellation releases Codex checker", [Backend.Codex, true, true], {
      ...observed,
      state: RunStatus.Cancelled,
    }),
    rejected("HTTP cancellation releases Claude without cancelling Codex", [Backend.Claude, true], {
      ...observed,
      state: RunStatus.Cancelled,
    }),
    rejected("HTTP cancellation releases Codex without cancelling Claude", [Backend.Codex, true], {
      ...observed,
      state: RunStatus.Cancelled,
    }),
  ],
};

export const capacityRunCeilingCases = {
  positive: [
    positive("one physical turn across mixed backends", [1, false], {
      peak: 1,
      active: 0,
      completed: 4,
      failures: 0,
    }),
    positive("two physical turns across mixed backends", [2, false], {
      peak: 2,
      active: 0,
      completed: 4,
      failures: 0,
    }),
  ],
  negative: [
    rejected("a serial failure releases the run ceiling", [1, true], {
      peak: 1,
      active: 0,
      completed: 4,
      failures: 1,
    }),
    rejected("a concurrent failure releases the run ceiling", [2, true], {
      peak: 2,
      active: 0,
      completed: 4,
      failures: 1,
    }),
  ],
};

export const capacityQueuedBackendCases = {
  positive: [
    positive("queued Codex passes a blocked Claude head", [Backend.Claude, false], {
      peerBeforeHeldRelease: true,
      starts: 2,
      queuedResult: null,
    }),
    positive("queued Claude passes a blocked Codex head", [Backend.Codex, false], {
      peerBeforeHeldRelease: true,
      starts: 2,
      queuedResult: null,
    }),
  ],
  negative: [
    rejected("cancelled Claude head releases its waiting entry", [Backend.Claude, true], {
      peerBeforeHeldRelease: true,
      starts: 1,
      queuedResult: "cancelled",
    }),
    rejected("cancelled Codex head releases its waiting entry", [Backend.Codex, true], {
      peerBeforeHeldRelease: true,
      starts: 1,
      queuedResult: "cancelled",
    }),
  ],
};
