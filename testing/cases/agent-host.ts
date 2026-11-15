import { AgentHost, Backend } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

const retryableFailure = { type: "error", retryable: true, retry_after_ms: 50, stopped: true };
export const hostFailureCases = {
  positive: [
    positive("short diagnostic retains recovery details", ["rate_limit", "try later"], {
      ...retryableFailure,
      code: "rate_limit",
      message: "try later",
    }),
    positive("Unicode diagnostic retains recovery details", ["unavailable", "再試行"], {
      ...retryableFailure,
      code: "unavailable",
      message: "再試行",
    }),
  ],
  negative: [
    rejected(
      "oversized code is bounded before IPC",
      ["x".repeat(AgentHost.MessageBytes), "try later"],
      {
        ...retryableFailure,
        code: "x".repeat(AgentHost.ErrorCodeCharacters),
        message: "try later",
      },
    ),
    rejected(
      "oversized Unicode message is bounded before IPC",
      ["rate_limit", "界".repeat(AgentHost.MessageBytes)],
      {
        ...retryableFailure,
        code: "rate_limit",
        message: "界".repeat(AgentHost.ErrorMessageCharacters),
      },
    ),
  ],
};
export const hostValueCases = {
  positive: [
    positive("structured frame stays unchanged", [{ value: [true, null] }], {
      value: [true, null],
    }),
    positive("Unicode frame stays unchanged", ["😀"], "😀"),
  ],
  negative: [
    negative("undefined frame data fails protocol", [{ value: undefined }], {
      code: "protocol_json",
    }),
    negative("non-finite frame data fails protocol", [Number.NaN], { code: "protocol_json" }),
  ],
};

export const hostBudgetCases = {
  positive: [
    positive("small frame", [4], 4),
    positive("frame at byte boundary", [AgentHost.MessageBytes - 2], AgentHost.MessageBytes - 2),
  ],
  negative: [
    negative("over byte boundary", [AgentHost.MessageBytes - 1], { code: "protocol_json" }),
    negative("large frame", [AgentHost.MessageBytes], { code: "protocol_json" }),
  ],
};
export const hostServiceCases = {
  positive: [
    positive("new turn acknowledges its event", ["fresh"], {
      answer: { delivered: true },
      resumed: false,
      events: 1,
      stopped: true,
      backpressure: true,
    }),
    positive("native turn resumes its id", ["resume"], {
      answer: { delivered: true },
      resumed: true,
      events: 1,
      stopped: true,
      backpressure: true,
    }),
  ],
  negative: [
    rejected("ack without event", ["ack"], { failed: true, stopped: true }),
    rejected("unknown frame", ["invalid"], { failed: true, stopped: true }),
    rejected("second start", ["duplicate"], { failed: true, stopped: true }),
    rejected("native error", ["backend-error"], { failed: true, stopped: true }),
  ],
};
export const hostLeaseCases = {
  positive: [
    positive("separate candidates run together", [false, false], { independent: true }),
    positive("resumed candidate leaves peer independent", [false, true], { independent: true }),
  ],
  negative: [
    negative("new writer cannot share lease", [true, false], { code: "execution_interrupted" }),
    negative("resumed writer cannot share lease", [true, true], { code: "execution_interrupted" }),
  ],
};
export const nativeHostCompositionCases = {
  positive: [
    positive("Codex adapter in host", [Backend.Codex, false], {
      backend: Backend.Codex,
      failed: true,
    }),
    positive("Claude adapter in host", [Backend.Claude, false], {
      backend: Backend.Claude,
      failed: true,
    }),
  ],
  negative: [
    rejected("Codex malformed input", [Backend.Codex, true], {
      backend: Backend.Codex,
      failed: true,
    }),
    rejected("Claude malformed input", [Backend.Claude, true], {
      backend: Backend.Claude,
      failed: true,
    }),
  ],
};
export const hostTransportCases = {
  positive: [
    positive("answer waits for host teardown", ["answer"], {
      answer: { delivered: true },
      events: 0,
    }),
    positive("event is acknowledged before answer", ["event"], {
      answer: { delivered: true },
      events: 1,
    }),
  ],
  negative: [
    negative(
      "oversized prompt starts no host",
      ["answer", false, "x".repeat(AgentHost.MessageBytes)],
      { code: "protocol_json" },
    ),
    negative(
      "escape expansion starts no host",
      ["answer", false, "\u0000".repeat(AgentHost.MessageBytes / 4)],
      { code: "protocol_json" },
    ),
    negative("silent startup reaches bounded deadline", ["silent"], {
      code: "execution_interrupted",
    }),
    negative("early process exit", ["exit"], { code: "execution_interrupted" }),
    negative("native failure", ["error"], { code: "session_unavailable" }),
    negative("answer before ready", ["not-ready"], { code: "protocol_json" }),
    negative("second ready", ["double-ready"], { code: "protocol_json" }),
    negative("unknown output", ["malformed"], { name: "ZodError" }),
    negative("oversized output", ["oversize"], { code: "protocol_json" }),
    negative("durable sink failure", ["event", true], { message: "durable sink unavailable" }),
    negative("abort during event", ["abort"], { message: "cancelled turn" }),
  ],
};

export const hostPlatformCases = {
  positive: [
    positive("Linux process host", ["linux"], true),
    positive("second Linux process host", ["linux"], true),
  ],
  negative: [
    negative("Windows is unsupported", ["win32"], { code: "execution_interrupted" }),
    negative("macOS is unverified", ["darwin"], { code: "execution_interrupted" }),
  ],
};
export const hostedNativeCases = {
  positive: [
    positive("Codex continues native identity", [Backend.Codex, false], {
      preserved: true,
      completed: true,
    }),
    positive("Claude continues native identity", [Backend.Claude, false], {
      preserved: true,
      completed: true,
    }),
  ],
  negative: [
    negative("Codex targeted cancellation", [Backend.Codex, true], { message: "cancelled native" }),
    negative("Claude targeted cancellation", [Backend.Claude, true], {
      message: "cancelled native",
    }),
  ],
};

export const nativeHostPortsCases = {
  positive: [
    positive("first native host routes and owns its group", [321], {
      messages: [{ test: true }, { type: "ready" }],
      killed: -321,
      stoppedBeforeMessages: false,
    }),
    positive("second native host routes and owns its group", [654], {
      messages: [{ test: true }, { type: "ready" }],
      killed: -654,
      stoppedBeforeMessages: false,
    }),
  ],
  negative: [
    negative("zero pid cannot address caller group", [0], { code: "protocol_json" }),
    negative("pid one cannot address init group", [1], { code: "protocol_json" }),
    rejected("lost parent stops before first frame", [321, false], {
      messages: [{ test: true }, { type: "ready" }],
      killed: -321,
      stoppedBeforeMessages: true,
    }),
    rejected("lost parent stops a second host before first frame", [654, false], {
      messages: [{ test: true }, { type: "ready" }],
      killed: -654,
      stoppedBeforeMessages: true,
    }),
  ],
};

const independent = {
  firstFailed: false,
  secondFailed: false,
  isolated: true,
  stopped: true,
  timedOut: false,
  synchronized: true,
  survivorLive: true,
};
export const hostedIsolationCases = {
  positive: [
    positive("Codex managed turns overlap independently", [Backend.Codex, false], independent),
    positive("Claude managed turns overlap independently", [Backend.Claude, false], independent),
  ],
  negative: [
    rejected("Codex group cancellation preserves a live peer", [Backend.Codex, true], {
      ...independent,
      firstFailed: true,
    }),
    rejected("Claude group cancellation preserves a live peer", [Backend.Claude, true], {
      ...independent,
      firstFailed: true,
    }),
  ],
};

export const hostedSharedCases = {
  positive: [
    positive(
      "Codex independent native turns overlap in the same live directory",
      [Backend.Codex, false],
      { shared: true, overlapped: true, cancelled: false },
    ),
    positive(
      "Claude independent native turns overlap in the same live directory",
      [Backend.Claude, false],
      { shared: true, overlapped: true, cancelled: false },
    ),
  ],
  negative: [
    rejected("Codex cancellation preserves a peer in the same directory", [Backend.Codex, true], {
      shared: true,
      overlapped: true,
      cancelled: true,
    }),
    rejected("Claude cancellation preserves a peer in the same directory", [Backend.Claude, true], {
      shared: true,
      overlapped: true,
      cancelled: true,
    }),
  ],
};
