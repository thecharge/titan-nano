import { type RequestKind, RequestLimit } from "@titan/constants";
import { z } from "zod";
import type { Run, RunEvent } from "./board.ts";
import type { OperationRequest, OperationRequestInput, OperationScope } from "./requests.ts";

export const StatementLockedSchema = z.strictObject({
  request_id: z.string().min(1),
  scope: z.string().min(1),
  path: z.string().min(1),
  hash: z.string().regex(RequestLimit.HashPattern),
  copy: z.string().min(1),
});
export type StatementLocked = z.infer<typeof StatementLockedSchema>;

export const StatementEntrySchema = z.object({ scope: z.string(), path: z.string() });
export type StatementEntry = z.infer<typeof StatementEntrySchema>;

export type StatementLedger = {
  list(runId: string): Promise<OperationRequest[]>;
  open(runId: string, input: OperationRequestInput): Promise<OperationRequest>;
  approved(
    runId: string,
    requestId: string,
    kind: RequestKind,
    scope: OperationScope,
  ): Promise<OperationRequest>;
};

export type StatementLockPorts = {
  ledger: () => StatementLedger;
  events: (run: Run) => AsyncIterable<RunEvent>;
  commit: (run: Run, type: string, data: unknown) => Promise<void>;
};
