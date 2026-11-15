import { CliRuntime, IdentifierPattern } from "@titan/constants";
import { z } from "zod";
import type { ClientAuthority } from "./credentials.ts";
import type { RequestListQueryInput, RequestPage } from "./request-pages.ts";
import type { RequestAnswerSubmission, RequestEscalationSubmission } from "./request-transport.ts";
import type { OperationRequest, OperationRequestInput } from "./requests.ts";

export interface RequestClient {
  escalate(input: RequestEscalationSubmission): Promise<OperationRequest>;
  list(query?: RequestListQueryInput): Promise<RequestPage>;
  open(runId: string, input: OperationRequestInput): Promise<OperationRequest>;
  get(runId: string, requestId: string): Promise<OperationRequest>;
  answer(input: RequestAnswerSubmission, authority: ClientAuthority): Promise<OperationRequest>;
}
export const RequestCliOptionsSchema = z.strictObject({
  version: z
    .string()
    .regex(CliRuntime.PositiveIntegerPattern)
    .transform(Number)
    .pipe(z.number().int().positive().max(Number.MAX_SAFE_INTEGER)),
  client_id: z.string().regex(IdentifierPattern),
});
