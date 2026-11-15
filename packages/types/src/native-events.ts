import {
  Backend,
  NativeCodexStatus,
  NativeEventActivity,
  NativeEventLimit,
  NativeEventProjection,
  NativeVendorEvent,
  RuntimeLimit,
} from "@titan/constants";
import { z } from "zod";
import { NativeToolNameSchema } from "./native-tool-audit.ts";

const identity = z.string().min(1).max(NativeEventLimit.IdentityCharacters);
export const NativeObservedToolSchema = z.strictObject({
  call_id: identity.nullable(),
  tool: NativeToolNameSchema,
  status: z.enum(NativeCodexStatus).nullable(),
});
export const NativeEventProjectionSchema = z.strictObject({
  schema_version: z.literal(NativeEventProjection.Version),
  backend: z.enum([Backend.Codex, Backend.Claude]),
  activity: z.enum(NativeEventActivity),
  tools: z.array(NativeObservedToolSchema).max(RuntimeLimit.PendingOperations),
});
export type NativeObservedTool = z.infer<typeof NativeObservedToolSchema>;
export const NativeEventBoardSchema = z.object({
  execution_id: identity,
  data: NativeEventProjectionSchema,
});

export const NativeCodexMarkerSchema = z.object({
  item: z.object({ type: z.literal(NativeVendorEvent.CodexTool) }),
});
const codexItem = z.object({
  id: identity,
  type: z.literal(NativeVendorEvent.CodexTool),
  server: z.string().min(1).max(NativeEventLimit.NameCharacters),
  tool: z.string().min(1).max(NativeEventLimit.NameCharacters),
  status: z.enum(NativeCodexStatus),
});
export const NativeCodexEventSchema = z.object({
  type: z.enum([
    NativeVendorEvent.CodexStarted,
    NativeVendorEvent.CodexUpdated,
    NativeVendorEvent.CodexCompleted,
  ]),
  item: codexItem,
});
export const NativeVendorMarkerSchema = z.object({ type: z.string() });
export const NativeClaudeBlockSchema = z.object({ type: z.string() });
const claudeMessage = z.object({
  content: z.union([z.string(), z.array(z.unknown()).max(RuntimeLimit.PendingOperations)]),
});
export const NativeClaudeMessageSchema = z.object({ message: claudeMessage });
export const NativeClaudeUseSchema = z.object({
  id: identity,
  name: z.string().min(1).max(NativeEventLimit.NameCharacters),
});
export const NativeClaudeResultSchema = z.object({ tool_use_id: identity });
