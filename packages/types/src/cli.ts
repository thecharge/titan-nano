import {
  CliCommand,
  type CliOptionDefinitions,
  CliRuntime,
  ExitCode,
  HarnessPlugin,
  NativeToolTransport,
  ProbeOption,
  SkillDocument,
} from "@titan/constants";
import { z } from "zod";
import { EventPageSchema } from "./board.ts";
import { EffectiveConfigSchema } from "./config.ts";
import { Sha256Schema } from "./hash.ts";
import { LocalModelStatusSchema } from "./local-model.ts";
import { PrerequisiteStatusSchema } from "./prerequisites.ts";
import { UpdateBackupSchema, UpdateCatalogSchema } from "./updates.ts";
import { PlanSchema } from "./workflow.ts";
import { WorkspaceSkillEntrySchema } from "./workspace.ts";

export const CliArgumentsSchema = z.array(z.string().min(1)).max(CliRuntime.MaximumPositionals);
const WorkflowCheckedSkillsSchema = z.strictObject({
  personas: z.record(z.string(), z.array(z.string())),
  origins: z.array(WorkspaceSkillEntrySchema),
  files: z.array(z.strictObject({ name: z.string(), path: z.string(), hash: Sha256Schema })),
});
export const WorkflowCheckItemSchema = z.strictObject({
  path: z.string(),
  ok: z.literal(true),
  revision: PlanSchema.shape.revision,
  nodes: PlanSchema.shape.nodes,
  config: EffectiveConfigSchema,
  skills: WorkflowCheckedSkillsSchema.optional(),
});
export type WorkflowCheckItem = z.infer<typeof WorkflowCheckItemSchema>;
export const WorkflowCheckBatchSchema = z.strictObject({
  schema_version: z.literal(CliRuntime.CheckVersion),
  ok: z.literal(true),
  workflows: z.array(WorkflowCheckItemSchema).max(CliRuntime.MaximumPositionals),
});

export const CliOptionsSchema = z.strictObject({
  from: z.string().optional(),
  backup: z.string().optional(),
  check: z.boolean().optional(),
  "no-model": z.boolean().optional(),
  "fetch-model": z.boolean().optional(),
  all: z.boolean().optional(),
  apply: z.boolean().optional(),
  scope: z.string().optional(),
  tag: z.string().optional(),
  "expected-version": z.string().optional(),
  follow: z.boolean().optional(),
  format: z.string().optional(),
  "fake-script": z.string().optional(),
  "entry-version": z.string().optional(),
  kind: z.string().optional(),
  mode: z.string().optional(),
  "to-person": z.boolean().optional(),
  yes: z.boolean().optional(),
  deny: z.string().optional(),
  cursor: z.string().optional(),
  sources: z.boolean().optional(),
  "run-id": z.string().optional(),
  "harness-session-id": z.string().optional(),
  "project-path": z.string().optional(),
  "home-after": z.string().optional(),
  state: z.string().optional(),
  "request-version": z.string().optional(),
  reason: z.string().optional(),
  set: z.array(z.string()).optional(),
  output: z.string().optional(),
  before: z.string().optional(),
  help: z.boolean().optional(),
  json: z.boolean().optional(),
  home: z.string().optional(),
  project: z.string().optional(),
  config: z.string().optional(),
  backend: z.string().optional(),
  compact: z.boolean().optional(),
  watch: z.boolean().optional(),
  detach: z.boolean().optional(),
  "dry-run": z.boolean().optional(),
  "client-id": z.string().optional(),
  "submission-id": z.string().optional(),
  "max-parallel": z.string().optional(),
  harness: z.string().optional(),
  version: z.boolean().optional(),
  after: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
  force: z.boolean().optional(),
  template: z.string().optional(),
  worker: z.string().optional(),
  reviewer: z.string().optional(),
  verify: z.string().optional(),
  tool: z.array(z.string()).optional(),
  skill: z.array(z.string()).optional(),
  persona: z.string().optional(),
  rounds: z.string().optional(),
});
export type CliOptions = z.infer<typeof CliOptionsSchema>;
export type OptionName = keyof typeof CliOptionDefinitions;
export const CommandNameSchema = z.enum(CliCommand);
export type CommandName = z.infer<typeof CommandNameSchema>;
export const SkillHeaderSchema = z.strictObject({
  name: z.literal(SkillDocument.Name),
  description: z.string().min(1),
});

export const PluginManifestSchema = z.strictObject({
  name: z.literal(HarnessPlugin.Server),
  description: z.string().min(1),
  version: z.string().min(1),
});
export const PluginMcpSchema = z.strictObject({
  mcpServers: z.strictObject({
    [HarnessPlugin.Server]: z.strictObject({
      command: z.string().min(1),
      args: z.union([
        z.tuple([z.literal(HarnessPlugin.Arguments[0])]),
        z.tuple([z.string().min(1), z.literal(HarnessPlugin.Arguments[0])]),
        z.tuple([
          z.literal(HarnessPlugin.Arguments[0]),
          z.literal(ProbeOption.Home),
          z.string().min(1),
        ]),
        z.tuple([
          z.string().min(1),
          z.literal(HarnessPlugin.Arguments[0]),
          z.literal(ProbeOption.Home),
          z.string().min(1),
        ]),
      ]),
    }),
  }),
});

export const InstallResultSchema = z.strictObject({
  model: LocalModelStatusSchema,
  installed: z.string().min(1),
  mcp: z.string().min(1),
  prerequisites: z.array(PrerequisiteStatusSchema),
  next: z.string().min(1),
});

export const DoctorResultSchema = z.strictObject({
  model: LocalModelStatusSchema,
  harness: z.string().min(1),
  tools: z.record(z.string(), z.string()),
  prerequisites: z.array(PrerequisiteStatusSchema),
  bun: z.string().min(1),
  node: z.string().nullable(),
  codex: z.string().nullable(),
  claude: z.string().nullable(),
  home: z.string().min(1),
  project: z.string().min(1),
  live_checks: z.string().min(1),
  supported: z.array(z.string()),
  backup: z.strictObject({ backup: UpdateBackupSchema, catalog: UpdateCatalogSchema }).optional(),
});

export const CommandResultSchema = z.strictObject({
  data: z.unknown().optional(),
  events: EventPageSchema.optional(),
  exitCode: z.enum(ExitCode),
});
export type CommandResult = z.infer<typeof CommandResultSchema>;
export const CommandPositionalSchema = z.strictObject({
  name: z.string().min(1),
  required: z.boolean(),
  multiple: z.literal(true).optional(),
  choices: z.array(z.string()).readonly().optional(),
});
export type CommandPositional = z.infer<typeof CommandPositionalSchema>;

export const ClaudeStdioRegistrationSchema = z.strictObject({
  type: z.literal(NativeToolTransport.Stdio).optional(),
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).default({}),
});
export const ClaudeLocalConfigurationSchema = z.looseObject({
  projects: z
    .record(
      z.string(),
      z.looseObject({
        mcpServers: z.record(z.string(), z.unknown()).optional(),
        disabledMcpServers: z.array(z.string()).optional(),
      }),
    )
    .default({}),
});
