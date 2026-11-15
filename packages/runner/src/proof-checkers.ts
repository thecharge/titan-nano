import { ErrorCode, VerifyKind } from "@titan/constants";
import { OperationalError } from "@titan/errors";
import { RunnerMessage } from "@titan/messages";
import type { VerifyEntry } from "@titan/types";

export function assertProofCheckers(checks: readonly VerifyEntry[]): void {
  if (checks.some((entry) => entry.kind !== VerifyKind.Script))
    throw new OperationalError(ErrorCode.NotBuilt, RunnerMessage.ProofUnavailable);
}
