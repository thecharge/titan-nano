import { CancellationBoundary, ErrorCode, FakeScriptLimit, IoLimit } from "@titan/constants";
import { agentSpec, negative, positive, rejected } from "@titan/test-factories";

export const personaInvocationCases = {
  positive: [
    positive("ordinary persona identifiers remain valid", ["worker"], true),
    positive("selected registered persona versions reach native admission", ["chemist@1"], true),
  ],
  negative: [
    rejected("persona invocation cannot contain a path", ["../chemist@1"], false),
    rejected("persona invocation requires a numeric saved version", ["chemist@invalid"], false),
  ],
};

export const fakeCancellationCases = {
  positive: [
    positive("new session sends work", [false, false, false], {
      called: 1,
      events: 1,
      failed: false,
    }),
    positive("resumed session sends work", [true, false, false], {
      called: 1,
      events: 1,
      failed: false,
    }),
  ],
  negative: [
    rejected("cancelled session starts no work", [false, true, false], {
      called: 0,
      events: 0,
      failed: true,
    }),
    rejected("pre-aborted invocation starts no work", [true, false, true], {
      called: 0,
      events: 0,
      failed: true,
    }),
  ],
};

export const codexCancellationCases = {
  positive: [
    positive("new session completes", [false, CancellationBoundary.None, false], {
      started: 1,
      events: 3,
      failed: false,
    }),
    positive("resumed session completes", [true, CancellationBoundary.None, true], {
      started: 1,
      events: 3,
      failed: false,
    }),
  ],
  negative: [
    rejected(
      "pre-aborted invocation starts no transport",
      [false, CancellationBoundary.BeforeSend, false],
      {
        started: 0,
        events: 0,
        failed: true,
      },
    ),
    rejected(
      "cancelled session starts no transport",
      [true, CancellationBoundary.BeforeSend, true],
      {
        started: 0,
        events: 0,
        failed: true,
      },
    ),
    rejected(
      "caller cancellation rejects late events",
      [false, CancellationBoundary.BeforeEvent, false],
      {
        started: 1,
        events: 0,
        failed: true,
      },
    ),
    rejected(
      "session cancellation rejects late events",
      [true, CancellationBoundary.BeforeEvent, true],
      {
        started: 1,
        events: 0,
        failed: true,
      },
    ),
    rejected(
      "caller cancellation during result handling cannot pass",
      [false, CancellationBoundary.ResultHandler, false],
      {
        started: 1,
        events: 3,
        failed: true,
      },
    ),
    rejected(
      "session cancellation during result handling cannot pass",
      [true, CancellationBoundary.ResultHandler, true],
      {
        started: 1,
        events: 3,
        failed: true,
      },
    ),
    rejected(
      "caller cancellation at stream end cannot pass",
      [false, CancellationBoundary.StreamEnd, false],
      {
        started: 1,
        events: 3,
        failed: true,
      },
    ),
    rejected(
      "session cancellation at stream end cannot pass",
      [true, CancellationBoundary.StreamEnd, true],
      {
        started: 1,
        events: 3,
        failed: true,
      },
    ),
  ],
};

export const processObservationCases = {
  positive: [
    positive("exited child is observed", [true, 1], true),
    positive("exited child needs no retry", [true, 2], true),
  ],
  negative: [
    rejected("live process is not exited", [false, 1], false),
    rejected("bounded retries do not declare a live process exited", [false, 2], false),
  ],
};

const firstAnswer = { marker: "first" };
const nextAnswer = { marker: "next" };
const otherAnswer = { marker: "other" };
const firstReply = { persona: "worker", task: "Deliver", answer: firstAnswer };
const nextReply = { ...firstReply, attempt: 2, execution: 3, answer: nextAnswer };
const otherReply = { ...firstReply, persona: "checker", answer: otherAnswer };
const answerScript = { version: 1, answers: [firstReply, nextReply, otherReply] };
export const scriptedFakeCases = {
  positive: [
    positive(
      "new session selects its persona and task",
      [answerScript, "worker", "Deliver"],
      firstAnswer,
    ),
    positive(
      "resumed session selects durable coordinates",
      [answerScript, "worker", "Deliver", 2, 3, true],
      nextAnswer,
    ),
    positive(
      "same task retains a separate persona answer",
      [answerScript, "checker", "Deliver"],
      otherAnswer,
    ),
  ],
  negative: [
    negative("unscripted task names the missing call", [answerScript, "worker", "other"], {
      code: ErrorCode.FakeUnscripted,
      message: "fake backend has no script for task: other",
    }),
    negative("another persona cannot borrow a reply", [answerScript, "missing", "Deliver"], {
      code: ErrorCode.FakeUnscripted,
    }),
    negative(
      "another quality attempt cannot borrow a reply",
      [answerScript, "worker", "Deliver", 2, 1],
      { code: ErrorCode.FakeUnscripted },
    ),
    negative(
      "another physical execution cannot borrow a reply",
      [answerScript, "worker", "Deliver", 1, 2],
      { code: ErrorCode.FakeUnscripted },
    ),
  ],
};
const duplicateScript = {
  version: 1,
  answers: [firstReply, { ...firstReply, attempt: 1, execution: 1 }],
};
const manyReplies = Array.from({ length: FakeScriptLimit.Entries + 1 }, (_, index) => ({
  ...firstReply,
  task: String(index),
}));
const largeReply = { ...firstReply, answer: "x".repeat(IoLimit.DataBytes + 1) };
const minimalScript = { version: 1, answers: [{ ...firstReply, answer: "" }] };
const expandedReply = {
  ...firstReply,
  answer: "x".repeat(IoLimit.DataBytes - JSON.stringify(minimalScript).length),
};
const expandedScript = { version: 1, answers: [expandedReply] };
export const fakeScriptAdmissionCases = {
  positive: [
    positive("empty versioned script is valid", [{ version: 1, answers: [] }], true),
    positive("distinct durable coordinates are valid", [answerScript], true),
  ],
  negative: [
    negative("ambiguous default coordinates are refused", [duplicateScript], {
      code: ErrorCode.FakeScript,
    }),
    negative("unsupported script version is refused", [{ ...answerScript, version: 2 }], {
      code: ErrorCode.FakeScript,
    }),
    negative("unknown script fields are refused", [{ ...answerScript, extra: true }], {
      code: ErrorCode.FakeScript,
    }),
    negative("answer count is bounded", [{ version: 1, answers: manyReplies }], {
      code: ErrorCode.FakeScript,
    }),
    negative("normalized defaults remain inside the byte budget", [expandedScript], {
      code: ErrorCode.FakeScript,
    }),
    negative("encoded script bytes are bounded", [{ version: 1, answers: [largeReply] }], {
      code: ErrorCode.FakeScript,
    }),
  ],
};
const baseFakeSpec = { ...agentSpec("/tmp"), persona_id: "worker", attempt: 1, execution: 1 };
export const fakeScriptPromptCases = {
  positive: [
    positive("valid task reaches script lookup", [baseFakeSpec, '{"task":"other"}'], true),
    positive(
      "valid second coordinate reaches script lookup",
      [{ ...baseFakeSpec, execution: 2 }, '{"task":"Deliver"}'],
      true,
    ),
  ],
  negative: [
    negative("missing durable coordinates are refused", [agentSpec("/tmp"), '{"task":"other"}'], {
      code: ErrorCode.FakeScript,
    }),
    negative("malformed JSON task is refused", [baseFakeSpec, "{"], { code: ErrorCode.FakeScript }),
    negative("missing task is refused", [baseFakeSpec, "{}"], { code: ErrorCode.FakeScript }),
    negative("oversized prompt is refused", [baseFakeSpec, "x".repeat(IoLimit.DataBytes + 1)], {
      code: ErrorCode.FakeScript,
    }),
  ],
};

export const configuredFakeScriptCases = {
  positive: [
    positive(
      "empty scripted configuration has a frozen identity",
      [{ version: 1, answers: [] }],
      true,
    ),
    positive("persona answers resolve through workflow configuration", [answerScript], true),
  ],
  negative: [
    negative("normalized replies cannot exceed configuration bytes", [expandedScript], {
      code: ErrorCode.StreamLimit,
    }),
    negative(
      "oversized replies cannot enter frozen settings",
      [{ version: 1, answers: [largeReply] }],
      { code: ErrorCode.StreamLimit },
    ),
  ],
};
