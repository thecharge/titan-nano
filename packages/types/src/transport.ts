import { Backend, backendIds, LocalServer, RunStatus, ServerLimit } from "@titan/constants";
import { z } from "zod";
import { ArtifactHashSchema, ArtifactQuerySchema } from "./artifacts.ts";
import {
  CallerSessionSchema,
  NodeStateSchema,
  type Run,
  RunRuntimeVersionSchema,
} from "./board.ts";
import type { Embedder } from "./contracts/embedder.ts";
import { type LogSink, LogStatisticsSchema } from "./logging.ts";
import type { NativeToolLaunch } from "./native-tool-launch.ts";
import { ProofSummarySchema } from "./proof-report.ts";
import { RunUsageSchema } from "./usage.ts";

export const RunSnapshotSchema = z.looseObject({
  run_id: z.string().min(1),
  workflow_id: z.string().min(1).optional(),
  client_id: z.string().min(1).max(ServerLimit.IdentityCharacters).optional(),
  submission_id: z.string().min(1).max(ServerLimit.IdentityCharacters).optional(),
  harness_session_id: CallerSessionSchema.optional(),
  state: z.enum(RunStatus),
  root: z.string().min(1),
  artifacts: z.string().nullable(),
  nodes: z.record(z.string(), z.unknown()),
  proofs: ProofSummarySchema.optional(),
});
export type RunSnapshot = z.infer<typeof RunSnapshotSchema>;
export const CompactRunSchema = z.strictObject({
  ...RunSnapshotSchema.omit({ nodes: true, proofs: true }).shape,
  compact: z.literal(true),
  error: z.string().nullable(),
  nodes: z.record(
    z.string(),
    NodeStateSchema.pick({ state: true, attempt: true, refutations: true }).extend({
      errors: z.record(z.string(), z.string()),
    }),
  ),
  usage: RunUsageSchema,
  waiting_requests: z.array(z.string().min(1)),
});
export const ResumeBackendSchema = z.enum(backendIds).optional();
export const LimitNodesSchema = z.record(
  z.string(),
  z.object({
    phases: z.record(
      z.string(),
      z.object({ next_retry: z.number().nullable(), completed: z.boolean() }),
    ),
  }),
);
export const AddressSchema = z.strictObject({
  url: z.url().refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === LocalServer.Protocol &&
      url.hostname === LocalServer.Host &&
      Boolean(url.port) &&
      url.pathname === LocalServer.Root &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  }),
  token: z.string().min(LocalServer.TokenMinimumLength),
  pid: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});
export type Address = z.infer<typeof AddressSchema>;
export const ServerErrorSchema = z.object({
  code: z.string().min(1),
  error: z.string(),
  required_runtime: RunRuntimeVersionSchema.optional(),
  required_build: ArtifactHashSchema.optional(),
});

export const ServerReadySchema = AddressSchema.omit({ token: true });
export type ServerReady = z.infer<typeof ServerReadySchema>;

export const SubmissionSchema = z.strictObject({
  project: z.string().min(1),
  workflow: z.unknown(),
  workflow_path: z.string().optional(),
  preserve_source: z.boolean().optional(),
  client_id: z.string().min(1).max(ServerLimit.IdentityCharacters),
  submission_id: z.string().min(1).max(ServerLimit.IdentityCharacters),
  harness_session_id: CallerSessionSchema.optional(),
  backend: z.enum(Backend),
  overrides: z.record(z.string(), z.unknown()).optional(),
});
export const SubmissionIntentSchema = SubmissionSchema.omit({
  client_id: true,
  submission_id: true,
});
export type SubmissionIntent = z.infer<typeof SubmissionIntentSchema>;
export const StoredRootSchema = z.strictObject({ root: z.string() });
export const StoredRunSchema = StoredRootSchema.extend({ id: z.string() });
export const StoredSubmissionSchema = StoredRunSchema.extend({ request_hash: z.string() });
export type StoredRoot = z.infer<typeof StoredRootSchema>;
export type StoredRun = z.infer<typeof StoredRunSchema>;
export type StoredSubmission = z.infer<typeof StoredSubmissionSchema>;
export type ReadStoredRun = (row: StoredRun) => Promise<Run>;
export interface ServerHandle {
  address: Address;
  stop: () => Promise<void>;
  stopped: Promise<void>;
}
export const McpCheckFields = {
  workflow: z.record(z.string(), z.unknown()),
  project: z.string().min(1).optional(),
  backend: z.enum(Backend).optional(),
};
export const McpRunFields = {
  ...McpCheckFields,
  project: z.string().min(1),
  backend: z.enum(Backend),
  client_id: z.string().min(1),
  submission_id: z.string().min(1),
  harness_session_id: SubmissionSchema.shape.harness_session_id,
  workflow_path: SubmissionSchema.shape.workflow_path,
  preserve_source: SubmissionSchema.shape.preserve_source,
};
export const McpRunSelectorFields = { run_id: z.string().min(1) };
export const McpArtifactSchema = z.strictObject({
  ...McpRunSelectorFields,
  artifact_id: ArtifactHashSchema,
  ...ArtifactQuerySchema.shape,
});

export const ServerOwnerSchema = z.strictObject({
  pid: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  started_at: z.number().int().nonnegative(),
  lease: z.literal(true).optional(),
});

export const ServerStopRequestSchema = z.strictObject({ idle_only: z.boolean().default(true) });
export const ServerStopResponseSchema = z.strictObject({ stopping: z.literal(true) });

export const ServerHealthSchema = z.strictObject({
  ready: z.literal(true),
  version: z.string().min(1),
  diagnostics: LogStatisticsSchema,
});
export type ServerHealth = z.infer<typeof ServerHealthSchema>;
export interface ServerOptions {
  runtimeBuild?: string;
  diagnosticSink?: LogSink;
  nativeTools?: NativeToolLaunch;
  embedders?: readonly Embedder[];
}

export const KnownHomeRowSchema = z.object({ path: z.unknown() });
