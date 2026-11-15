import { object, parseData } from "@titan/config";
import {
  ConfigDefault,
  ErrorCode,
  ExitCode,
  FileEncoding,
  JsonSchemaDirection,
  LeanCheck,
  Newline,
  VerifyKind,
  WorkflowField,
  WorkflowIssueKind,
  WorkflowPath,
} from "@titan/constants";
import { hash } from "@titan/core";
import { TitanError } from "@titan/errors";
import { WorkflowMessage, workflowIssue } from "@titan/messages";
import {
  type Plan,
  PlanSchema,
  type Step,
  WorkflowSchema,
  WorkflowSourceSchema,
} from "@titan/types";
import { z } from "zod";
import { validatePersonaFormats } from "./formats.ts";
import { validateDependencies } from "./graph.ts";
import { assertGroupDepth, compileGroups, stepLocations } from "./groups.ts";

export { maxAgents, stepRoom } from "./dry-run.ts";
export { assertBuiltFeatures } from "./features.ts";
export { checkAnswer, outputSchema } from "./formats.ts";
export { validatePlanTools } from "./permissions.ts";
export { personaAction, resolvedPersona } from "./personas.ts";
export { assertStatementPaths } from "./statements.ts";

function reachedDiscriminator(branch: z.core.$ZodIssue[]): boolean {
  return branch.some((issue) => issue.code === WorkflowIssueKind.Union && !issue.errors.length);
}

function* workflowIssues(issue: z.core.$ZodIssue, prefix: PropertyKey[] = []): Generator<string> {
  const path = [...prefix, ...issue.path];
  if (issue.code === WorkflowIssueKind.Union && issue.errors.length) {
    const reached = issue.errors.filter(reachedDiscriminator);
    for (const child of (reached.length === 1 ? reached : issue.errors).flat())
      yield* workflowIssues(child, path);
    return;
  }
  if (issue.code === WorkflowIssueKind.Key) {
    for (const child of issue.issues) yield* workflowIssues(child, path);
    return;
  }
  if (issue.code === WorkflowIssueKind.UnrecognizedKeys) {
    for (const key of issue.keys)
      yield workflowIssue(z.core.toDotPath([...path, key]), issue.message);
    return;
  }
  yield workflowIssue(z.core.toDotPath(path) || WorkflowMessage.Root, issue.message);
}

export function validateWorkflow(
  raw: unknown,
  maxDepth: number = ConfigDefault.MaxGroupDepth,
  platform: string = process.platform,
): Plan {
  const root = object(raw);
  if (root.steps) assertGroupDepth(root.steps, maxDepth);
  const parsed = WorkflowSchema.safeParse(raw, {
    error: (issue) => (issue.input === undefined ? WorkflowMessage.Required : undefined),
  });
  if (!parsed.success)
    throw new TitanError(
      ErrorCode.InvalidWorkflow,
      parsed.error.issues.flatMap((issue) => [...workflowIssues(issue)]).join(Newline),
      ExitCode.Input,
      [
        ...new Set(
          parsed.error.issues.map((issue) => z.core.toDotPath(issue.path) || WorkflowMessage.Root),
        ),
      ],
    );
  const workflow = parsed.data;
  validatePersonaFormats(workflow.personas);
  stepLocations(workflow.steps ?? [], WorkflowPath.Steps);
  stepLocations(workflow.graph?.nodes ?? [], WorkflowPath.GraphNodes);
  const nodes: Step[] = workflow.steps ? [] : (workflow.graph?.nodes ?? []);
  if (workflow.steps) compileGroups(workflow.steps, false, [], nodes);
  validateDependencies(nodes, workflow);
  const checks = [...(workflow.verify ?? []), ...nodes.flatMap((node) => node.verify)];
  if (platform !== LeanCheck.Platform && checks.some((check) => check.kind === VerifyKind.Lean))
    throw new TitanError(ErrorCode.InvalidWorkflow, WorkflowMessage.LeanPlatform);
  return PlanSchema.parse({ workflow, nodes, revision: hash(JSON.stringify(workflow)) });
}

function representations() {
  return [
    { required: [WorkflowField.Steps], not: { required: [WorkflowField.Graph] } },
    { required: [WorkflowField.Graph], not: { required: [WorkflowField.Steps] } },
  ];
}

export const workflowJsonSchema = (): Record<string, unknown> => ({
  ...z.toJSONSchema(WorkflowSchema, { io: JsonSchemaDirection.Input }),
  oneOf: representations(),
});
export { requestTurnOutputSchema } from "./turns.ts";

export function workflowFile(
  plan: Plan,
  source?: Uint8Array,
  maxDepth: number = ConfigDefault.MaxGroupDepth,
): Buffer {
  if (source === undefined) return Buffer.from(Bun.YAML.stringify(plan.workflow));
  const parsed = WorkflowSourceSchema.safeParse(source);
  if (!parsed.success)
    throw new TitanError(ErrorCode.InvalidWorkflow, WorkflowMessage.SourceInvalid);
  const bytes = Buffer.from(parsed.data);
  if (
    validateWorkflow(parseData(bytes.toString(FileEncoding.Utf8)), maxDepth).revision !==
    plan.revision
  )
    throw new TitanError(ErrorCode.InvalidWorkflow, WorkflowMessage.SourceMismatch);
  return bytes;
}
