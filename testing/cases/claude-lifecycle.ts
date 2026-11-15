import { ErrorCode, NativeStreamOutcome } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

const complete = { queries: 1, closes: 1, finalized: 1, error: null, code: null };
const stopped = { queries: 1, closes: 1, finalized: 1, error: "Error", code: null };

export const claudeStreamLifecycleCases = {
  positive: [
    positive("completed start detaches its query", [NativeStreamOutcome.Complete, false], complete),
    positive("completed resume detaches its query", [NativeStreamOutcome.Complete, true], complete),
    positive("second turn owns a fresh query", [NativeStreamOutcome.Complete, false, 2], {
      ...complete,
      queries: 2,
      closes: 2,
      finalized: 2,
    }),
    positive("resumed second turn owns a fresh query", [NativeStreamOutcome.Complete, true, 2], {
      ...complete,
      queries: 2,
      closes: 2,
      finalized: 2,
    }),
  ],
  negative: [
    ...[false, true].flatMap((resume) => [
      rejected(
        `failed close retains its query for explicit cleanup: resume=${resume}`,
        [NativeStreamOutcome.CloseFailure, resume],
        stopped,
      ),
      rejected(
        `failed turn detaches its query: resume=${resume}`,
        [NativeStreamOutcome.Failure, resume],
        { ...stopped, error: "OperationalError", code: ErrorCode.ClaudeExecution },
      ),
      rejected(
        `invalid usage detaches its query: resume=${resume}`,
        [NativeStreamOutcome.Malformed, resume],
        { ...stopped, error: "OperationalError", code: ErrorCode.ClaudeProtocol },
      ),
      rejected(
        `cancel in observer closes only its current query: resume=${resume}`,
        [NativeStreamOutcome.Cancel, resume],
        stopped,
      ),
      rejected(
        `close in observer closes only its current query: resume=${resume}`,
        [NativeStreamOutcome.Close, resume],
        { ...stopped, error: "AbortError", code: null },
      ),
      rejected(
        `caller abort detaches its query: resume=${resume}`,
        [NativeStreamOutcome.Abort, resume],
        stopped,
      ),
    ]),
  ],
};
