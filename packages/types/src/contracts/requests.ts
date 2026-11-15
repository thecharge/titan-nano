import type { RunEventKind } from "@titan/constants";
import type { Run, RunEvent } from "../board.ts";
import type { OperationRequest } from "../requests.ts";

export type RequestJournalPort = {
  snapshot: (runId: string) => Promise<Run>;
  events: (runId: string, through: number) => AsyncIterable<RunEvent>;
  append: (runId: string, kind: RunEventKind, request: OperationRequest) => Promise<void>;
};
