import { IdentifierPattern, RequestField, RequestOperation } from "@titan/constants";
import { z } from "zod";
import {
  type OperationRequest,
  type OperationRequestInput,
  OperationRequestInputSchema,
  type RequestActor,
  type RequestAnswerInput,
  RequestAnswerInputSchema,
  type RequestEscalationInput,
  RequestEscalationInputSchema,
} from "./requests.ts";

const identity = z.string().regex(IdentifierPattern);
export const RequestAnswerSubmissionSchema = RequestAnswerInputSchema.extend({
  client_id: identity,
});
export const RequestEscalationSubmissionSchema = RequestEscalationInputSchema.extend({
  client_id: identity,
});
export type RequestEscalationSubmission = z.infer<typeof RequestEscalationSubmissionSchema>;
export type RequestAnswerSubmission = z.infer<typeof RequestAnswerSubmissionSchema>;
export const RequestRouteSelectionSchema = z.discriminatedUnion(RequestField.Operation, [
  z.strictObject({
    operation: z.literal(RequestOperation.Escalate),
    run_id: identity,
    input: RequestEscalationSubmissionSchema,
  }),
  z.strictObject({
    operation: z.literal(RequestOperation.Open),
    run_id: identity,
    input: OperationRequestInputSchema,
  }),
  z.strictObject({
    operation: z.literal(RequestOperation.Read),
    run_id: identity,
    request_id: identity,
  }),
  z.strictObject({
    operation: z.literal(RequestOperation.Answer),
    run_id: identity,
    input: RequestAnswerSubmissionSchema,
  }),
]);
export type RequestRouteSelection = z.infer<typeof RequestRouteSelectionSchema>;
export interface RequestService {
  escalate(input: RequestEscalationInput, actor: RequestActor): Promise<OperationRequest>;
  open(runId: string, input: OperationRequestInput): Promise<OperationRequest>;
  list(runId: string): Promise<OperationRequest[]>;
  decideWithinLimits(runId: string, requestId: string): Promise<OperationRequest>;
  answer(input: RequestAnswerInput, actor: RequestActor): Promise<OperationRequest>;
}
