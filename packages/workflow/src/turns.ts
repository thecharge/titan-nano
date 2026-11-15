import { RequestLimit, RequestTurnField, SchemaKind } from "@titan/constants";
import { AgentRequestSchema } from "@titan/types";
import { z } from "zod";

export function requestTurnOutputSchema(
  result: Record<string, unknown> | null,
): Record<string, unknown> {
  const resultSchema = {
    anyOf: [result ?? { type: SchemaKind.String }, { type: SchemaKind.Null }],
  };
  const requests = {
    type: SchemaKind.Array,
    items: z.toJSONSchema(AgentRequestSchema),
    maxItems: RequestLimit.PerRun,
  };
  const properties = { result: resultSchema, requests };
  return {
    type: SchemaKind.Object,
    properties,
    required: [RequestTurnField.Result, RequestTurnField.Requests],
    additionalProperties: false,
  };
}
