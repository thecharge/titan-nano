import { resolve } from "node:path";
import { resolveConfig, workflowSettings } from "@titan/config";
import {
  CliOption,
  CliRuntime,
  ErrorCode,
  ExitCode,
  IoLimit,
  SubmissionReceipt,
  TextSymbol,
} from "@titan/constants";
import { hash, jsonByteLength } from "@titan/core";
import { errorMessage, SubmissionUncertainError, TitanError } from "@titan/errors";
import { checkPersonaUses, resolvePersonaWorkflow, retainWorkspaceSkills } from "@titan/knowledge";
import {
  addableStepsLine,
  CliDiagnostic,
  CliMessage,
  staticPlanLine,
  uncertainSubmission,
  workflowIssue,
} from "@titan/messages";
import { readFileBytes } from "@titan/streams";
import {
  type CommandContext,
  type CommandHandler,
  type RunSnapshot,
  type SubmissionIntent,
  SubmissionIntentSchema,
  type SubmissionReceiptRecord,
  type Workflow,
  WorkflowCheckBatchSchema,
  type WorkflowCheckItem,
  WorkflowCheckItemSchema,
} from "@titan/types";
import {
  assertStatementPaths,
  maxAgents,
  stepRoom,
  validatePlanTools,
  validateWorkflow,
  workflowSkillBindings,
} from "@titan/workflow";
import { detectedBackend } from "../harness-backend.ts";
import { cliSettingOverrides } from "../setting-overrides.ts";
import { runResult } from "./runs.ts";

async function settings(context: CommandContext, workflow: unknown) {
  const { options, home, project } = context;
  const [argument] = context.positionals;
  const scriptPath = options[CliOption.FakeScript];
  const script = scriptPath ? await context.services.loadData(resolve(scriptPath)) : undefined;
  const overrides = cliSettingOverrides(options, script);
  const config = await resolveConfig({
    home,
    project,
    ...(options.config ? { configFile: options.config } : {}),
    ...(argument ? { workflow: workflowSettings(workflow) } : {}),
    overrides,
  });
  return { config, overrides };
}
async function checkedPlan(context: CommandContext) {
  const workflow = await context.services.loadData(
    resolve(context.positionals[0] ?? TextSymbol.Empty),
  );
  const { config, overrides } = await settings(context, workflow);
  const plan = validateWorkflow(workflow, config.value.limits.max_group_depth);
  if (plan.nodes.length > config.value.limits.max_steps)
    throw new TitanError(ErrorCode.StepLimit, CliDiagnostic.StepLimit);
  await checkPersonaUses(context.home, plan.workflow, context.project);
  const resolved = validateWorkflow(
    await resolvePersonaWorkflow(context.home, plan.workflow, context.project),
    config.value.limits.max_group_depth,
  );
  validatePlanTools(resolved, config.value.defaults.backend ?? undefined);
  await assertStatementPaths(plan, context.project);
  return { plan, resolved, config, overrides };
}

async function checkedSkills(project: string, workflow: Workflow) {
  const personas = workflowSkillBindings(workflow);
  const names = new Set(Object.values(personas).flat());
  if (!names.size) return undefined;
  const { index, files } = await retainWorkspaceSkills(project, process.env, names);
  return {
    personas,
    origins: index.filter(({ name }) => names.has(name)),
    files: files.map(({ name, path, hash }) => ({ name, path, hash })),
  };
}

function checkData(
  { plan, config }: Awaited<ReturnType<typeof checkedPlan>>,
  skills?: Awaited<ReturnType<typeof checkedSkills>>,
) {
  return {
    ok: true as const,
    revision: plan.revision,
    nodes: plan.nodes,
    config,
    ...(skills && { skills }),
  };
}

async function checkedOutput(context: CommandContext) {
  const checked = await checkedPlan(context);
  return checkData(checked, await checkedSkills(context.project, checked.resolved.workflow));
}

async function checkedFile(context: CommandContext, path: string) {
  try {
    return WorkflowCheckItemSchema.parse({
      path,
      ...(await checkedOutput({ ...context, positionals: [path] })),
    });
  } catch (error) {
    const diagnostic = workflowIssue(path, errorMessage(error));
    if (error instanceof TitanError)
      throw new TitanError(error.code, diagnostic, error.exitCode, error.paths);
    throw new TitanError(ErrorCode.Arguments, diagnostic);
  }
}

async function checkWorkflows(context: CommandContext) {
  const json = context.options[CliOption.Json];
  if (context.positionals.length === 1) {
    const data = await checkedOutput(context);
    return { data: json ? data : CliMessage.Checked, exitCode: ExitCode.Success };
  }
  const workflows: WorkflowCheckItem[] = [];
  for (const path of context.positionals) {
    const entry = await checkedFile(context, path);
    if (!json) {
      context.emit(CliMessage.Checked);
      continue;
    }
    jsonByteLength(
      { schema_version: CliRuntime.CheckVersion, ok: true, workflows: [...workflows, entry] },
      CliRuntime.CheckBytes,
    );
    workflows.push(entry);
  }
  return {
    data: json
      ? WorkflowCheckBatchSchema.parse({
          schema_version: CliRuntime.CheckVersion,
          ok: true,
          workflows,
        })
      : undefined,
    exitCode: ExitCode.Success,
  };
}
async function submit(
  context: CommandContext,
  receipt: SubmissionReceiptRecord,
  body: SubmissionIntent,
): Promise<RunSnapshot> {
  try {
    return await context.services
      .client(context.home)
      .submit({ ...body, client_id: receipt.client_id, submission_id: receipt.submission_id });
  } catch (error) {
    if (!(error instanceof TitanError) || error.exitCode !== ExitCode.Transport) throw error;
    const path = resolve(context.home, SubmissionReceipt.File);
    throw new SubmissionUncertainError(
      receipt.client_id,
      receipt.submission_id,
      path,
      uncertainSubmission(receipt.client_id, receipt.submission_id, path),
    );
  }
}
export const workflowHandlers = {
  config: async (context) => ({
    data: (
      await settings(
        context,
        context.positionals[0]
          ? await context.services.loadData(resolve(context.positionals[0]))
          : undefined,
      )
    ).config,
    exitCode: ExitCode.Success,
  }),
  check: checkWorkflows,
  run: async (context) => {
    const checked = await checkedPlan(context);
    const { plan, config, overrides, resolved } = checked;
    if (context.options[CliOption.DryRun]) {
      const skills = await checkedSkills(context.project, resolved.workflow);
      if (!context.options[CliOption.Json]) {
        context.emit(staticPlanLine(maxAgents(plan, config.value.defaults)));
        context.emit(addableStepsLine(stepRoom(plan, config.value.limits.max_steps)));
      }
      return {
        data: checkData(checked, skills),
        exitCode: ExitCode.Success,
      };
    }
    const backend =
      context.options.backend ??
      config.value.defaults.backend ??
      detectedBackend(context, plan.workflow.harness);
    const workflowPath = resolve(context.positionals[0] ?? TextSymbol.Empty);
    const intent = SubmissionIntentSchema.safeParse({
      project: context.project,
      workflow: plan.workflow,
      preserve_source: true,
      workflow_path: workflowPath,
      backend,
      ...(context.options[CliOption.HarnessSessionId] !== undefined
        ? { harness_session_id: context.options[CliOption.HarnessSessionId] }
        : {}),
      overrides,
    });
    if (!intent.success)
      throw new TitanError(
        ErrorCode.InvalidSubmission,
        intent.error.message,
        ExitCode.Input,
        intent.error.issues.map((issue) => issue.path.join(TextSymbol.Dot)),
      );
    const body = intent.data;
    const fingerprint = {
      ...body,
      config: config.hash,
      source: hash(await readFileBytes(workflowPath, IoLimit.DataBytes)),
    };
    jsonByteLength(fingerprint, IoLimit.DataBytes);
    const requestHash = hash(JSON.stringify(fingerprint));
    const receipt = await context.services.prepareSubmission(context.home, {
      client_id: context.options[CliOption.ClientId],
      submission_id: context.options[CliOption.SubmissionId],
      request_hash: requestHash,
      max_receipts: config.value.client?.max_submission_receipts,
    });
    const run = await submit(context, receipt, body);
    return runResult(context, run);
  },
} satisfies Record<string, CommandHandler>;
