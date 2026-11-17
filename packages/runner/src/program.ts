import { dirname, resolve } from "node:path";
import { homePath, loadData, resolveConfig, workflowSettings } from "@titan/config";
import { ErrorCode, ProgramRun as ProgramLimit } from "@titan/constants";
import { newId } from "@titan/core";
import { TitanError } from "@titan/errors";
import { ownedKnowledge } from "@titan/knowledge";
import { ProgramMessage } from "@titan/messages";
import {
  type BackendChoice,
  type BackendFactory,
  ObjectSchema,
  type OperationRequest,
  type ProgramOptions,
  ProgramOptionsSchema,
  type ProgramRun,
  type RequestActor,
  type RequestAnswerInput,
} from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { Engine } from "./engine.ts";

const engines = new WeakMap<ProgramRun, Engine>();

function withBackends(workflow: unknown, backends: BackendChoice | undefined): unknown {
  if (!backends) return workflow;
  const root = ObjectSchema.parse(workflow);
  const personas = ObjectSchema.parse(root[ProgramLimit.PersonasField]);
  for (const name of Object.keys(backends))
    if (!Object.hasOwn(personas, name))
      throw new TitanError(ErrorCode.Arguments, ProgramMessage.UnknownPersona(name));
  return {
    ...root,
    [ProgramLimit.PersonasField]: Object.fromEntries(
      Object.entries(personas).map(([name, persona]) => [
        name,
        backends[name]
          ? { ...ObjectSchema.parse(persona), [ProgramLimit.BackendField]: backends[name] }
          : persona,
      ]),
    ),
  };
}

async function* follow(engine: Engine, id: string, ended: () => boolean, wake: Promise<unknown>) {
  let after = 0;
  let done = false;
  while (!done) {
    const finished = ended();
    const page = await engine.events(id, { after });
    yield* page.events;
    after = page.next_cursor;
    done = !page.has_more && finished;
    if (!page.has_more && !done)
      await Promise.race([wake, Bun.sleep(ProgramLimit.PollMilliseconds)]);
  }
}

function track(engine: Engine, id: string, work: Promise<void>): ProgramRun {
  let ended = false;
  const done = work.then(async () => {
    ended = true;
    return engine.snapshot(id);
  });
  const run: ProgramRun = {
    run_id: id,
    events: follow(engine, id, () => ended, done),
    done,
  };
  engines.set(run, engine);
  return run;
}

export async function runWorkflow(
  path: string,
  options: ProgramOptions,
  factory: BackendFactory,
): Promise<ProgramRun> {
  const parsed = ProgramOptionsSchema.parse(options);
  const file = resolve(path);
  const project = resolve(parsed.project ?? dirname(file));
  const raw = withBackends(await loadData(file), parsed.backend);
  const config = await resolveConfig({
    home: homePath(parsed.home),
    project,
    workflow: workflowSettings(raw),
    overrides: parsed.overrides ?? {},
  });
  const plan = validateWorkflow(raw, config.value.limits.max_group_depth);
  const backend = parsed.default_backend ?? config.value.defaults.backend;
  if (!backend) throw new TitanError(ErrorCode.Backend, ProgramMessage.BackendMissing);
  const knowledge = ownedKnowledge(
    homePath(parsed.home),
    config.value.server.knowledge ?? {},
    config.value.server.native_tools.max_pending_operations,
  );
  const engine = new Engine(
    factory,
    {},
    {
      hub: knowledge.hub,
      personaHistory: knowledge.personaHistory,
      personaDecision: knowledge.personaDecision,
      openCalls: knowledge.openCalls,
    },
  );
  engine.preflight(
    validateWorkflow(
      await knowledge.resolvePersonas(plan.workflow, project),
      config.value.limits.max_group_depth,
    ),
    config,
    backend,
  );
  const binding = await knowledge.bindPersonas(plan.workflow, project);
  const resolved = validateWorkflow(binding.workflow, config.value.limits.max_group_depth);
  const run = await engine.create({
    project,
    plan,
    persona_references: binding.references,
    ...(resolved.revision === plan.revision ? {} : { resolved_plan: resolved }),
    config,
    backend,
    client_id: parsed.client_id ?? newId(),
    submission_id: parsed.submission_id ?? newId(),
    workflow_path: file,
  });
  return track(engine, run.run_id, engine.start(run.run_id));
}

function engineOf(run: ProgramRun): Engine {
  const engine = engines.get(run);
  if (!engine) throw new TitanError(ErrorCode.RunNotFound, ProgramMessage.NotStarted);
  return engine;
}

export function resumeRun(run: ProgramRun): ProgramRun {
  const engine = engineOf(run);
  return track(engine, run.run_id, engine.resume(run.run_id));
}

export function answerRequest(
  run: ProgramRun,
  input: RequestAnswerInput,
  actor: RequestActor,
): Promise<OperationRequest> {
  return engineOf(run).requests.answer(input, actor);
}
