import { FakeBackend } from "@titan/backend-fake";
import { ProgramCheck, SchemaKind } from "@titan/constants";
import { FakeMessage } from "@titan/messages";
import type { AgentSpec } from "@titan/types";

function schemaAnswer(schema: Record<string, unknown> | null): unknown {
  if (!schema) return { message: FakeMessage.Completed };
  if (Array.isArray(schema.enum)) return schema.enum[0];
  if (schema.type === SchemaKind.Object)
    return Object.fromEntries(
      Object.entries((schema.properties ?? {}) as Record<string, Record<string, unknown>>).map(
        ([key, child]) => [key, schemaAnswer(child)],
      ),
    );
  if (schema.type === SchemaKind.Array) return [];
  if (schema.type === SchemaKind.Number || schema.type === SchemaKind.Integer) return 1;
  if (schema.type === SchemaKind.Boolean) return true;
  return FakeMessage.Response;
}

export async function schemaFakeAnswer(spec: AgentSpec) {
  return { json: schemaAnswer(spec.output_schema) };
}

export const createFakeBackend = (): FakeBackend => new FakeBackend(schemaFakeAnswer);

export const createSlowBackend = (): FakeBackend =>
  new FakeBackend(async (spec) => {
    await Bun.sleep(ProgramCheck.SlowMilliseconds);
    return schemaFakeAnswer(spec);
  });
