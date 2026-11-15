import { strict as assert } from "node:assert";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  ApprovalLevel,
  Backend,
  ExitCode,
  ProgramCheck,
  ProgramFault,
  ProgramRun,
  RequestDecision,
  RunStatus,
} from "@titan/constants";
import { projectHubPath } from "@titan/knowledge";
import { answerRequest, resumeRun, runWorkflow } from "@titan/runner";
import { startServer } from "@titan/server";
import { createRunClient } from "@titan/server/client";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { thrownBy, waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type BackendChoice,
  type EventPage,
  EventPageSchema,
  type Run,
  type RunEventView,
  RunSchema,
} from "@titan/types";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { createFakeBackend, createSlowBackend } from "../support/backend.ts";

function declared(personas: BackendChoice) {
  const base = vendorRecoveryWorkflow();
  return {
    ...base,
    personas: {
      ...base.personas,
      ...Object.fromEntries(
        Object.entries(personas).map(([name, backend]) => [
          name,
          { ...Object(Reflect.get(base.personas, name)), backend },
        ]),
      ),
    },
  };
}

function shape(events: readonly RunEventView[]): string {
  return JSON.stringify(events.map(({ id, type, data }) => ({ id, type, data }))).replaceAll(
    ProgramRun.UuidPattern,
    ProgramRun.IdMark,
  );
}

function record(run: Run): string {
  return JSON.stringify({
    state: run.state,
    workflow_id: run.workflow_id,
    workflow_revision: run.workflow_revision,
    request_hash: run.request_hash,
    base_hash: run.base_hash,
    backend: run.backend,
    nodes: Object.entries(run.nodes).map(([id, node]) => [id, node.state]),
  });
}

export async function backendNaming(personas: BackendChoice, named: boolean) {
  return withTemporaryDirectory(async (root) => {
    const { project, home, path } = await layout(root, vendorRecoveryWorkflow());
    const options = {
      project,
      home,
      backend: personas,
      client_id: ProgramCheck.ClientId,
      submission_id: ProgramCheck.SubmissionId,
      ...(named ? { default_backend: Backend.Fake } : {}),
    };
    if (named) return (await (await runWorkflow(path, options, createFakeBackend)).done).state;
    const error = await thrownBy(() => runWorkflow(path, options, createFakeBackend));
    return error instanceof Error ? error.message : String(error);
  });
}

async function layout(root: string, source: unknown) {
  const project = resolve(root, ProgramCheck.Project);
  const home = resolve(root, "home");
  const flow = resolve(root, ProgramCheck.Flow);
  await mkdir(project);
  await mkdir(flow);
  await writeFile(resolve(project, ProgramCheck.Note), ProgramCheck.Note);
  const path = resolve(flow, ProgramRun.WorkflowFile);
  await writeFile(path, Bun.YAML.stringify(source));
  return { project, home, path };
}

async function viaCli(path: string, home: string, project: string, client: string, id: string) {
  let run: unknown;
  let page: EventPage | undefined;
  const cli = createCli({
    ...defaultServices,
    output: (value, _json, context) => {
      run = value;
      page = context?.events;
    },
  });
  assert.equal(
    await cli([
      "run",
      path,
      "--home",
      home,
      "--project",
      project,
      "--backend",
      Backend.Fake,
      "--client-id",
      client,
      "--submission-id",
      id,
      "--watch",
      "--json",
    ]),
    ExitCode.Success,
  );
  return { run: RunSchema.parse(run), page: EventPageSchema.parse(page) };
}

function codeOf(error: unknown): unknown {
  return Reflect.get(Object(error), "code");
}

async function compareWithCli(root: string, personas: BackendChoice, fault: ProgramFault) {
  const { project, home, path } = await layout(root, vendorRecoveryWorkflow());
  const options = {
    project,
    home,
    backend: personas,
    default_backend: Backend.Fake,
    overrides: { defaults: { backend: Backend.Fake } },
    client_id: ProgramCheck.ClientId,
    submission_id: ProgramCheck.SubmissionId,
  };
  if (fault === ProgramFault.NoBackend)
    return codeOf(
      await thrownBy(() =>
        runWorkflow(path, { project, home, client_id: ProgramCheck.ClientId }, createFakeBackend),
      ),
    );
  if (fault === ProgramFault.Persona)
    return codeOf(
      await thrownBy(async () => {
        const handle = await runWorkflow(path, options, createFakeBackend);
        await handle.done;
      }),
    );
  const slow = fault === ProgramFault.Follow || fault === ProgramFault.EndedSlow;
  const began = Date.now();
  const handle = await runWorkflow(path, options, slow ? createSlowBackend : createFakeBackend);
  if (fault === ProgramFault.Follow) {
    const seen: RunEventView[] = [];
    for await (const event of handle.events) seen.push(event);
    const result = await handle.done;
    assert.equal(result.state, RunStatus.Passed);
    return `${seen.length > 0} ${Date.now() - began >= ProgramCheck.SlowMilliseconds}`;
  }
  if (fault === ProgramFault.Ended || fault === ProgramFault.EndedSlow) {
    await handle.done;
    const resumed = Date.now();
    for await (const event of handle.events) assert.ok(event.id);
    assert.ok(Date.now() - resumed < ProgramCheck.SlowMilliseconds);
    return codeOf(await thrownBy(async () => resumeRun(handle)));
  }
  if (fault === ProgramFault.Handle) {
    await handle.done;
    return codeOf(await thrownBy(async () => resumeRun({ ...handle })));
  }
  const events: RunEventView[] = [];
  for await (const event of handle.events) events.push(event);
  const finished = await handle.done;
  assert.equal(finished.state, RunStatus.Passed);
  if (fault === ProgramFault.Resume) return codeOf(await thrownBy(async () => resumeRun(handle)));
  if (fault === ProgramFault.Answer)
    return codeOf(
      await thrownBy(() =>
        answerRequest(
          handle,
          {
            run_id: handle.run_id,
            request_id: ProgramCheck.MissingRun,
            version: 1,
            decision: RequestDecision.Deny,
            reason: ProgramCheck.MissingRun,
          },
          { client_id: ProgramCheck.ClientId, authority: ApprovalLevel.Main },
        ),
      ),
    );
  await rm(projectHubPath(project), { recursive: true, force: true });
  await writeFile(path, Bun.YAML.stringify(declared(personas)));
  const server = await startServer(home, createFakeBackend);
  try {
    const cli = await viaCli(
      path,
      home,
      project,
      ProgramCheck.CliClientId,
      ProgramCheck.CliSubmissionId,
    );
    return `${shape(events) === shape(cli.page.events)} ${record(finished) === record(cli.run)}`;
  } finally {
    await server.stop();
  }
}

export function programWorkflow(personas: BackendChoice, fault: ProgramFault) {
  return withTemporaryDirectory((root) => compareWithCli(root, personas, fault));
}

async function compareHttp(root: string, personas: BackendChoice, fault: ProgramFault) {
  const workflow = declared(personas);
  const { project, home, path } = await layout(root, workflow);
  const server = await startServer(home, createFakeBackend);
  const client = createRunClient(home);
  try {
    const body = {
      project,
      workflow,
      backend: Backend.Fake,
      client_id: ProgramCheck.HttpClientId,
      submission_id: ProgramCheck.HttpSubmissionId,
      workflow_path: path,
      preserve_source: true,
    };
    if (fault === ProgramFault.Submission)
      return codeOf(await thrownBy(() => client.submit({ ...body, project: "" })));
    if (fault === ProgramFault.Run)
      return codeOf(await thrownBy(() => client.events(ProgramCheck.MissingRun)));
    const started = await client.submit(body);
    assert.ok(
      await waitUntil(async () => (await client.get(started.run_id)).state === RunStatus.Passed),
    );
    const events: RunEventView[] = [];
    let pages = 0;
    let after = 0;
    let more = true;
    while (more) {
      const page = await client.events(started.run_id, { after, limit: ProgramCheck.PageLimit });
      events.push(...page.events);
      pages++;
      after = page.next_cursor;
      more = page.has_more;
    }
    await rm(projectHubPath(project), { recursive: true, force: true });
    const cli = await viaCli(
      path,
      home,
      project,
      ProgramCheck.CliClientId,
      ProgramCheck.CliSubmissionId,
    );
    return `${shape(events) === shape(cli.page.events)} ${pages > 1}`;
  } finally {
    await server.stop();
  }
}

export function programHttp(personas: BackendChoice, fault: ProgramFault) {
  return withTemporaryDirectory((root) => compareHttp(root, personas, fault));
}
