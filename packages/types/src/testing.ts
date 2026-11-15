import {
  AgentEventKind,
  CaseMode,
  CasePolarity,
  KnowledgeKind,
  KnowledgeWriterFixture,
  McpStdioFixture,
  MinimumCasesPerPolarity,
  type ProcessSignal,
  SpellingFixture,
  TestProcessLimit,
  TestSchedule,
} from "@titan/constants";
import { z } from "zod";

export const UnitCaseSchema = z.strictObject({
  name: z.string().min(1),
  polarity: z.enum(CasePolarity),
  mode: z.enum(CaseMode),
  args: z.array(z.unknown()),
  expected: z.unknown(),
});
export type UnitCase = z.infer<typeof UnitCaseSchema>;
export const PositiveCaseSchema = UnitCaseSchema.extend({
  polarity: z.literal(CasePolarity.Positive),
  mode: z.literal(CaseMode.Returns),
});
export type PositiveCase = z.infer<typeof PositiveCaseSchema>;
export const NegativeCaseSchema = UnitCaseSchema.extend({
  polarity: z.literal(CasePolarity.Negative),
});
export type NegativeCase = z.infer<typeof NegativeCaseSchema>;
export const UnitSuiteSchema = z.strictObject({
  positive: z
    .array(
      UnitCaseSchema.extend({
        polarity: z.literal(CasePolarity.Positive),
        mode: z.literal(CaseMode.Returns),
      }),
    )
    .min(MinimumCasesPerPolarity),
  negative: z
    .array(
      UnitCaseSchema.extend({
        polarity: z.literal(CasePolarity.Negative),
      }),
    )
    .min(MinimumCasesPerPolarity),
});
export type UnitSuite = z.infer<typeof UnitSuiteSchema>;
export type TestSubject = (...args: never[]) => unknown;
export type TestAction = () => unknown;
export type TestPredicate = () => Promise<boolean>;

export const VendorStubCallSchema = z.strictObject({
  pid: z.number().int().positive(),
  resume: z.boolean(),
});

export const RunIdentitySchema = z.object({ run_id: z.string() });
export type RunIdentity = z.infer<typeof RunIdentitySchema>;
export const RunStateViewSchema = RunIdentitySchema.extend({ state: z.string() });
export type RunStateView = z.infer<typeof RunStateViewSchema>;
export const StateViewSchema = z.object({ state: z.string() });
export type StateView = z.infer<typeof StateViewSchema>;
export const SessionIdentitySchema = z.object({ session_id: z.string() });
export type SessionIdentity = z.infer<typeof SessionIdentitySchema>;
const mcpToolSchema = z.object({ name: z.string() });
const mcpFrameResultSchema = z.object({
  tools: z.array(mcpToolSchema).optional(),
  isError: z.boolean().optional(),
});
export const McpStdioFrameSchema = z
  .strictObject({
    jsonrpc: z.literal(McpStdioFixture.RpcVersion),
    id: z.number().int(),
    result: mcpFrameResultSchema.optional(),
    error: z.object({ code: z.number().int(), message: z.string() }).optional(),
  })
  .refine((frame) => (frame.result !== undefined) !== (frame.error !== undefined));
export { McpTextContentSchema } from "./mcp.ts";
export const TypeScriptConfigSchema = z.object({
  extends: z.string().optional(),
  compilerOptions: z.record(z.string(), z.unknown()).optional(),
});
export type TypeScriptConfig = z.infer<typeof TypeScriptConfigSchema>;

export const VendorNativeStateSchema = z.strictObject({
  session_id: z.string().min(1),
  turn: z.number().int().nonnegative(),
});

export const SdkProbePathsSchema = z.strictObject({
  cli: z.string().min(1).optional(),
  vendors: z.string().min(1).optional(),
});
export type SdkProbePaths = z.infer<typeof SdkProbePathsSchema>;

export const ServerClaimProbeSchema = z.strictObject({
  ready: z.boolean(),
  code: z.string().nullable(),
});

export const VendorActivePidsSchema = z.strictObject({
  vendor: z.number().int().positive(),
  descendant: z.number().int().positive(),
});

export const SpellingFixtureSchema = z.enum(SpellingFixture);

export const TestScheduleSchema = z.enum(TestSchedule);
export const SchedulingProbeSchema = z.strictObject({
  schedule: TestScheduleSchema,
  fail: z.boolean(),
  result: z.string().min(1),
});
export const SchedulingResultSchema = z.strictObject({
  peak: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  active: z.number().int().nonnegative(),
});

export const VendorPhaseEventSchema = z.object({
  phase: z.string(),
  session_id: z.string().nullable(),
});

export const VendorSessionEventSchema = VendorPhaseEventSchema.extend({
  execution_id: z.string().uuid(),
  type: z.literal(AgentEventKind.Session),
});

export interface TestProcess {
  readonly exited: Promise<number>;
  kill(): void;
}

export interface OwnedTestProcess extends TestProcess {
  readonly exitCode: number | null;
  kill(signal?: ProcessSignal): void;
}

export const TestProcessDeadlineSchema = z
  .number()
  .int()
  .positive()
  .max(TestProcessLimit.MaximumMilliseconds);

export const KnowledgeWriterInputSchema = z.strictObject({
  home: z.string().min(1),
  project: z.string().min(1),
  id: z.uuid(),
  kind: z.enum(KnowledgeKind),
  stale: z.boolean(),
  ready: z.string().min(1),
  file: z.string().min(1),
});
export const KnowledgeWriterCommitSchema = z.strictObject({
  version: z.number().int().min(2),
  body: z.string().min(1).max(1024),
});
export const KnowledgeWriterResultSchema = z.strictObject({
  pid: z.number().int().positive(),
  attempts: z.literal(KnowledgeWriterFixture.Updates),
  conflicts: z.number().int().nonnegative().max(KnowledgeWriterFixture.Updates),
  committed: z.array(KnowledgeWriterCommitSchema).max(KnowledgeWriterFixture.Updates),
});
export type KnowledgeWriterResult = z.infer<typeof KnowledgeWriterResultSchema>;
