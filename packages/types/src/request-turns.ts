import { IdentifierPattern, RequestLimit } from "@titan/constants";
import { z } from "zod";
import type { PhaseContext, PhaseExecution } from "./phase.ts";
import type {
  OperationRequest,
  OperationRequestInput,
  RequestActor,
  RequestAnswerInput,
} from "./requests.ts";
import { OperationRequestInputSchema, OperationRequestSchema } from "./requests.ts";

export const AgentRequestSchema = OperationRequestInputSchema.omit({
  request_id: true,
  origin: true,
});
export type AgentRequest = z.infer<typeof AgentRequestSchema>;
export const AgentKindProbeSchema = z.looseObject({
  requests: z.array(z.looseObject({ kind: z.string() })),
});
export const AgentTurnSchema = z
  .strictObject({
    result: z.json(),
    requests: z.array(AgentRequestSchema).max(RequestLimit.PerRun),
  })
  .refine((turn) => turn.requests.length === 0 || turn.result === null);
export const PhaseRequestTurnSchema = z.strictObject({
  execution_id: z.string().regex(IdentifierPattern),
  request_ids: z.array(z.string().regex(IdentifierPattern)).min(1).max(RequestLimit.PerRun),
  waiting: z.boolean(),
});
export const RequestTurnBatchSchema = z
  .array(OperationRequestSchema)
  .min(1)
  .max(RequestLimit.PerRun)
  .refine(
    (requests) => new Set(requests.map((request) => request.request_id)).size === requests.length,
  )
  .refine((requests) =>
    requests.every(
      (request) =>
        request.origin.execution !== undefined &&
        JSON.stringify(request.origin) === JSON.stringify(requests[0]?.origin),
    ),
  );
export type RequestTurnBatch = z.infer<typeof RequestTurnBatchSchema>;
export const PhaseTurnSchema = z.strictObject({
  value: z.unknown(),
  requests: z.array(AgentRequestSchema),
});
export type PhaseTurn = z.infer<typeof PhaseTurnSchema>;
export type RequestTurnCommit = (requests: RequestTurnBatch) => Promise<void>;

export type RequestTurnPublisher = (
  context: PhaseExecution,
  requests: RequestTurnBatch,
) => Promise<void>;
export type HelperTurnExecutor = (context: PhaseContext) => Promise<unknown>;
export type RequestTurnLedgerProvider = () => {
  answer: (input: RequestAnswerInput, actor: RequestActor) => Promise<OperationRequest>;
  list: (runId: string) => Promise<OperationRequest[]>;
  openTurn: (
    runId: string,
    inputs: OperationRequestInput[],
    publish: RequestTurnCommit,
  ) => Promise<OperationRequest[]>;
};
