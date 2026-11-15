import { RequestState } from "@titan/constants";
import { z } from "zod";
import { OperationRequestInputSchema, OperationRequestSchema } from "./requests.ts";

export const McpRequestOpenSchema = z.strictObject({
  run_id: OperationRequestSchema.shape.run_id,
  input: OperationRequestInputSchema,
});
export const McpRequestReadSchema = z.strictObject({
  run_id: OperationRequestSchema.shape.run_id,
  request_id: OperationRequestInputSchema.shape.request_id,
});

export const McpRequestResultSchema = z
  .strictObject({
    state: z.enum(RequestState),
    request: OperationRequestSchema,
  })
  .refine(
    (value) =>
      value.state ===
      (value.request.answer === null ? RequestState.Waiting : RequestState.Answered),
  );
