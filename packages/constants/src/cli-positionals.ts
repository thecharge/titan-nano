import { CliArgument, CliSchema } from "./cli.ts";
import { RequestDecision } from "./requests.ts";

const run = { name: CliArgument.RunId, required: true } as const;
const request = { name: CliArgument.RequestId, required: true } as const;
const knowledge = { name: CliArgument.KnowledgeId, required: true } as const;
const knowledgeFile = { name: CliArgument.KnowledgeFile, required: true } as const;

export const CliPositionals = {
  Skill: [{ name: CliArgument.SkillName, required: true }],
  Persona: [{ name: CliArgument.PersonaName, required: true }],
  ConfigSet: [
    { name: CliArgument.Setting, required: true },
    { name: CliArgument.Value, required: true },
  ],
  Run: [run],
  WebRead: [run, { name: CliArgument.Url, required: true }, { ...request, required: false }],
  Workflow: [{ name: CliArgument.WorkflowFile, required: true }],
  Workflows: [{ name: CliArgument.WorkflowFile, required: true, multiple: true }],
  OptionalWorkflow: [{ name: CliArgument.WorkflowFile, required: false }],
  Schema: [
    { name: CliArgument.Schema, required: false, choices: [CliSchema.Workflow, CliSchema.Config] },
  ],
  Request: [run, request],
  Answer: [
    run,
    request,
    {
      name: CliArgument.Decision,
      required: false,
      choices: [RequestDecision.Approve, RequestDecision.Deny],
    },
  ],
  Deny: [run, request, { name: CliArgument.Reason, required: true }],
  KnowledgeId: [knowledge],
  KnowledgeFile: [knowledgeFile],
  KnowledgeUpdate: [knowledge, knowledgeFile],
  PlanKind: [{ name: CliArgument.PlanKind, required: true }],
  Question: [{ name: CliArgument.Question, required: false }],
  Words: [{ name: CliArgument.Words, required: false, multiple: true }],
  Artifact: [run, { name: CliArgument.ArtifactId, required: true }],
} as const;
