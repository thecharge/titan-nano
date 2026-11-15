import { Backend, ErrorCode, HostReadinessFixture, HostReadinessMode } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const hostReadinessCases = {
  positive: [
    positive(
      "Codex worker readiness waits for daemon acknowledgement",
      [HostReadinessMode.Accepted, Backend.Codex, null, 1],
      true,
    ),
    positive(
      "Claude checker readiness waits for daemon acknowledgement",
      [HostReadinessMode.Accepted, Backend.Claude, null, 1],
      true,
    ),
  ],
  negative: [
    rejected(
      "refused daemon readiness preserves operational classification",
      [HostReadinessMode.Refused, Backend.Codex, ErrorCode.ExecutionInterrupted, 1],
      true,
    ),
    rejected(
      "retryable daemon refusal retains retry timing",
      [
        HostReadinessMode.RateLimited,
        Backend.Claude,
        ErrorCode.RateLimited,
        1,
        HostReadinessFixture.RetryMilliseconds,
      ],
      true,
    ),
    rejected(
      "aborted readiness reaps the managed process",
      [HostReadinessMode.Aborted, Backend.Codex, ErrorCode.ExecutionInterrupted, 1],
      true,
    ),
    rejected(
      "readiness without an HTTP binding is refused",
      [HostReadinessMode.MissingBinding, Backend.Claude, ErrorCode.ProtocolJson, 0],
      true,
    ),
    rejected(
      "a repeated readiness frame is refused",
      [HostReadinessMode.Duplicate, Backend.Codex, ErrorCode.ProtocolJson, 1],
      true,
    ),
    rejected(
      "answer before readiness is refused",
      [HostReadinessMode.EarlyAnswer, Backend.Claude, ErrorCode.ProtocolJson, 0],
      true,
    ),
    rejected(
      "event before readiness is refused",
      [HostReadinessMode.EarlyEvent, Backend.Codex, ErrorCode.ProtocolJson, 0],
      true,
    ),
    rejected(
      "answer during pending readiness is refused",
      [HostReadinessMode.PendingAnswer, Backend.Claude, ErrorCode.ProtocolJson, 1],
      true,
    ),
  ],
};

export const standaloneReadinessCases = {
  positive: [
    positive("standalone Codex keeps its HTTP readiness check", [Backend.Codex, false], true),
    positive("standalone Claude keeps its HTTP readiness check", [Backend.Claude, false], true),
  ],
  negative: [
    rejected("standalone Codex refuses a substituted execution", [Backend.Codex, true], true),
    rejected("standalone Claude refuses a substituted execution", [Backend.Claude, true], true),
  ],
};

export const serviceReadinessCases = {
  positive: [
    positive(
      "Codex service holds SDK work until readiness acknowledgment",
      [Backend.Codex, false],
      true,
    ),
    positive(
      "Claude service holds SDK work until readiness acknowledgment",
      [Backend.Claude, false],
      true,
    ),
  ],
  negative: [
    rejected(
      "Codex service retains refusal after readiness acknowledgment",
      [Backend.Codex, true],
      true,
    ),
    rejected(
      "Claude service retains refusal after readiness acknowledgment",
      [Backend.Claude, true],
      true,
    ),
  ],
};
