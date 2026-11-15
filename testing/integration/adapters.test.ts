import { test } from "bun:test";
import {
  claudeCompletedTransport,
  claudeErrorResult,
  claudeExactResume,
  claudeLateResult,
  claudeMalformedUsage,
  claudeMandatoryPaths,
  claudeOperationalResult,
  claudePermissionCancellation,
  claudeResultCancellation,
  codexIncompleteStreams,
  codexMalformedUsage,
  codexStreamedAnswer,
  result,
} from "../factories/adapter-contract.ts";

test("Codex translates streamed session, output and per-turn usage", codexStreamedAnswer);
test("Codex failed and incomplete streams are operational errors", codexIncompleteStreams);
test("Claude exact resume, read-only tools and structured answer", claudeExactResume);
test(
  "Claude checks paths in a mandatory hook, including implicitly allowed tools",
  claudeMandatoryPaths,
);
test("Claude success subtype with is_error true cannot pass", claudeErrorResult);
test(
  "Claude permission callback rejects tools and outside paths; cancellation aborts its SDK controller",
  claudePermissionCancellation,
);
test("Codex rejects malformed vendor usage before run accounting", codexMalformedUsage);
test("Claude rejects malformed vendor usage before run accounting", claudeMalformedUsage);
test.each([
  { ...result, structured_output: { ok: true } },
  { ...result, structured_output: { ok: false } },
])("Claude completed transport closes after a result: %j", claudeCompletedTransport);
test.each(["error_during_execution", "error_max_turns"])(
  "Claude non-success result remains operational: %s",
  claudeOperationalResult,
);
test.each(["pause", "cancel"])(
  "Claude drops a late result after caller cancellation: %s",
  claudeLateResult,
);
test.each([false, true])(
  "Claude rejects cancellation during result handling: %s",
  claudeResultCancellation,
);

import { unit } from "@titan/test-factories";
import { adapterSpecSnapshotCases } from "../cases/adapter-spec.ts";
import { claudeSpecSnapshot, codexSpecSnapshot } from "../factories/adapter-spec.ts";

unit(claudeSpecSnapshot, adapterSpecSnapshotCases);
unit(codexSpecSnapshot, adapterSpecSnapshotCases);
