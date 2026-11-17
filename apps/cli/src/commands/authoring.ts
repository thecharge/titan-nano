import { writeFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import {
  AgentTool,
  ErrorCode,
  ErrorField,
  ExitCode,
  FileErrorCode,
  FileOpenMode,
  IoLimit,
  KnowledgeKind,
  KnowledgeScope,
  Newline,
  PersonaReferencePattern,
  PersonaRegister,
  PersonaRule,
  PersonaState,
  TextSymbol,
  WorkflowFactory,
  WorkflowTemplate,
} from "@titan/constants";
import { jsonByteLength } from "@titan/core";
import { TitanError } from "@titan/errors";
import {
  inspectPersona,
  personaEntryId,
  projectHubHome,
  resolvePersonaWorkflow,
} from "@titan/knowledge";
import { CliDiagnostic, personaNotInRegister, WorkflowFactoryMessage } from "@titan/messages";
import {
  type CommandContext,
  KnowledgeInputSchema,
  type PersonaEntry,
  PersonaRecordSchema,
  PersonaSchema,
} from "@titan/types";
import { validatePlanTools, validateWorkflow } from "@titan/workflow";

async function writeDefinition(context: CommandContext, definition: unknown) {
  const file = resolve(context.positionals[0] ?? TextSymbol.Empty);
  jsonByteLength(definition, IoLimit.DataBytes);
  const extension = extname(file);
  const content =
    extension === WorkflowFactory.Yaml || extension === WorkflowFactory.Yml
      ? Bun.YAML.stringify(definition)
      : JSON.stringify(definition, null, 2);
  if (Buffer.byteLength(content) + 1 > IoLimit.DataBytes)
    throw new TitanError(ErrorCode.Arguments, CliDiagnostic.DefinitionSize);
  try {
    await writeFile(file, content + Newline, { flag: FileOpenMode.Exclusive });
  } catch (error) {
    if (error instanceof Error && Reflect.get(error, ErrorField.Code) === FileErrorCode.Exists)
      throw new TitanError(ErrorCode.Exists, CliDiagnostic.DefinitionExists);
    throw error;
  }
  return { data: { path: file }, exitCode: ExitCode.Success };
}

export function createPersona(context: CommandContext) {
  const persona = PersonaSchema.safeParse({
    description: WorkflowFactoryMessage.PersonaDescription,
    role: WorkflowFactoryMessage.PersonaRole,
    tools: context.options.tool ?? [AgentTool.Read],
    skills: context.options.skill,
  });
  if (!persona.success) throw new TitanError(ErrorCode.Arguments, persona.error.message);
  const file = context.positionals[0] ?? TextSymbol.Empty;
  const name = basename(file, extname(file));
  const version = PersonaRegister.FirstVersion;
  const title = `${name}${PersonaRule.VersionMark}${version}`;
  if (!PersonaReferencePattern.test(title))
    throw new TitanError(ErrorCode.Arguments, personaNotInRegister(title));
  const record = PersonaRecordSchema.parse({
    name,
    version,
    persona: persona.data,
    state: PersonaState.Proposed,
  });
  return writeDefinition(
    context,
    KnowledgeInputSchema.parse({
      id: personaEntryId(title),
      kind: KnowledgeKind.Persona,
      title,
      tags: persona.data.tags,
      body: Bun.YAML.stringify(record),
    }),
  );
}

async function selectedPersona(
  context: CommandContext,
  selection: string | undefined,
  fallback: PersonaEntry,
): Promise<PersonaEntry> {
  if (selection === undefined) return fallback;
  const prefix = `${KnowledgeScope.Project}${TextSymbol.Colon}`;
  const project = selection.startsWith(prefix);
  const reference = project ? selection.slice(prefix.length) : selection;
  if (!PersonaReferencePattern.test(reference))
    throw new TitanError(ErrorCode.UnknownPersona, personaNotInRegister(selection));
  if (!project) return { use: reference };
  const { versions } = await inspectPersona(projectHubHome(context.project), {
    selector: reference,
  });
  const record = versions[0];
  if (!record || record.state === PersonaState.Deleted)
    throw new TitanError(ErrorCode.UnknownPersona, personaNotInRegister(selection));
  return { use: selection };
}

export async function createWorkflow(context: CommandContext) {
  const { options } = context;
  const template = options.template ?? WorkflowTemplate.Reviewed;
  if (template !== WorkflowTemplate.Reviewed && template !== WorkflowTemplate.Parallel)
    throw new TitanError(ErrorCode.Arguments, CliDiagnostic.WorkflowTemplate);
  if (options.worker !== undefined && options.skill !== undefined)
    throw new TitanError(ErrorCode.Arguments, CliDiagnostic.WorkflowSkills);
  const worker = await selectedPersona(context, options.worker, {
    description: WorkflowFactoryMessage.WorkerDescription,
    role: WorkflowFactoryMessage.WorkerRole,
    tags: [],
    tools: [AgentTool.Read],
    ...(options.skill === undefined ? {} : { skills: options.skill }),
  });
  const reviewer = await selectedPersona(context, options.reviewer, {
    description: WorkflowFactoryMessage.ReviewerDescription,
    role: WorkflowFactoryMessage.ReviewerRole,
    tags: [],
    tools: [AgentTool.Read],
  });
  const reviewed = (id: string, task: string) => ({
    id,
    do: { persona: WorkflowFactory.Worker, task },
    falsify: [{ persona: WorkflowFactory.Reviewer, task: WorkflowFactoryMessage.CheckTask }],
  });
  const first = reviewed(WorkflowFactory.Prepare, WorkflowFactoryMessage.PrepareTask);
  const work =
    template === WorkflowTemplate.Parallel
      ? { parallel: [first, reviewed(WorkflowFactory.Risks, WorkflowFactoryMessage.RiskTask)] }
      : first;
  const { workflow } = validateWorkflow({
    name: WorkflowFactoryMessage.Name,
    goal: WorkflowFactoryMessage.Goal,
    personas: { worker, reviewer },
    steps: [
      work,
      ...(options.verify === undefined
        ? []
        : [
            {
              id: WorkflowFactory.Verify,
              do: { script: options.verify },
              falsify: [
                { persona: WorkflowFactory.Reviewer, task: WorkflowFactoryMessage.CheckTask },
              ],
            },
          ]),
    ],
  });
  validatePlanTools(
    validateWorkflow(await resolvePersonaWorkflow(context.home, workflow, context.project)),
  );
  return writeDefinition(context, workflow);
}
