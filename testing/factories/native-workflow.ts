import { strict as assert } from "node:assert";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  Backend,
  ConfigFile,
  ExecutionPhase,
  KnowledgeKind,
  KnowledgeScope,
  KnowledgeTool,
  NativeToolAudit,
  NativeToolOutcome,
  NativeToolRole,
  NativeToolTransport,
  RunEventKind,
  RunStatus,
  SdkProcessFixture,
  VendorStubMode,
  WorkspaceModeSetting,
} from "@titan/constants";
import { KnowledgeHub, projectHubHome } from "@titan/knowledge";
import { createRunClient } from "@titan/server/client";
import { createKnowledgeClient } from "@titan/server/knowledge";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  ConfigSchema,
  type EventPage,
  type NativeBackendId,
  NativeEventBoardSchema,
  NativeToolBoardSchema,
  type Run,
  type RunClient,
  RunSchema,
  type SdkProbePaths,
} from "@titan/types";
import { knowledgeDraft } from "./knowledge.ts";
import { prepareSdkProject } from "./sdk-process.ts";
import { serverReady, spawnServer } from "./server-process.ts";

export async function nativeWorkflow(
  backend: NativeBackendId,
  seeded: boolean,
  transport: NativeToolTransport = NativeToolTransport.Http,
  paths: SdkProbePaths = {},
) {
  return withTemporaryDirectory((root) =>
    nativeWorkflowAtRoot(root, backend, seeded, transport, paths),
  );
}

export async function nativeProjectWorkflow(
  backend: NativeBackendId,
  seeded: boolean,
  paths: SdkProbePaths = {},
) {
  return withTemporaryDirectory(async (root) => {
    if (!seeded) await seedProjectKnowledge(resolve(root, "unrelated"));
    return nativeWorkflowAtRoot(
      root,
      backend,
      seeded,
      NativeToolTransport.Http,
      paths,
      KnowledgeScope.Project,
    );
  });
}

async function seedProjectKnowledge(project: string) {
  const hub = await KnowledgeHub.open(projectHubHome(project));
  try {
    return await hub.add(knowledgeDraft(KnowledgeKind.Fact));
  } finally {
    await hub.close();
  }
}

async function nativeWorkflowAtRoot(
  root: string,
  backend: NativeBackendId,
  seeded: boolean,
  transport: NativeToolTransport,
  paths: SdkProbePaths,
  scope: KnowledgeScope = KnowledgeScope.Home,
) {
  const { home, project } = await prepareSdkProject(
    root,
    backend,
    0,
    false,
    paths.vendors,
    transport,
  );
  if (scope === KnowledgeScope.Project) {
    const file = resolve(home, ConfigFile.User);
    const config = ConfigSchema.parse(JSON.parse((await readFile(file)).toString()));
    config.workspace = { ...config.workspace, mode: WorkspaceModeSetting.Live };
    await writeFile(file, Buffer.from(JSON.stringify(config)));
  }
  const child = spawnServer(home, paths.cli, SdkProcessFixture.DaemonTimeout);
  try {
    assert.equal(
      await waitUntil(() => serverReady(home, child.pid), SdkProcessFixture.ObserveAttempts),
      true,
    );
    const entry = seeded
      ? scope === KnowledgeScope.Project
        ? await seedProjectKnowledge(project)
        : await createKnowledgeClient(home).add(knowledgeDraft(KnowledgeKind.Fact))
      : null;
    const workflow = vendorRecoveryWorkflow(VendorStubMode.NativeTools);
    for (const step of workflow.steps) step.do.task = VendorStubMode.NativeTools;
    const client = createRunClient(home);
    const submitted = await client.submit({
      project,
      workflow,
      backend,
      client_id: "native-workflow",
      submission_id: "native-tools",
    });
    assert.equal(
      await waitUntil(async () => {
        const run = await client.get(submitted.run_id);
        return run.state === RunStatus.Passed || run.state === RunStatus.Blocked;
      }, SdkProcessFixture.ObserveAttempts),
      true,
    );
    const run = RunSchema.parse(await client.get(submitted.run_id));
    assert.equal(
      run.state,
      seeded ? RunStatus.Passed : RunStatus.Blocked,
      JSON.stringify({ error: run.error, nodes: run.nodes }),
    );
    await nativeWorkflowAudit(client, run, entry?.entry.id ?? null);
    const node = run.nodes.deliver;
    assert.ok(node);
    assert.equal(node.attempt, 1);
    assert.equal(node.refutations, 0);
    assert.deepEqual(node.evidence, []);
    assert.equal(node.phases[ExecutionPhase.Worker]?.completed, seeded);
    if (seeded) {
      assert.equal(node.phases[`${ExecutionPhase.FalsifierPrefix}0`]?.completed, true);
      assert.ok(run.artifacts);
      assert.equal(
        (await readFile(resolve(run.artifacts, "DELIVERED.txt"))).equals(
          Buffer.from("Delivered by SDK stub"),
        ),
        true,
      );
    } else assert.equal(run.artifacts, null);
    return true;
  } finally {
    if (child.exitCode === null) child.kill("SIGTERM");
    await child.exited;
  }
}

async function nativeWorkflowAudit(client: RunClient, run: Run, entry: string | null) {
  let after = 0;
  let searches = 0;
  let reads = 0;
  let projections = 0;
  while (after < run.version) {
    const page = await client.events(run.run_id, { after });
    assert.ok(page.events.length);
    const count = nativeWorkflowAuditPage(page, run, entry);
    searches += count.searches;
    reads += count.reads;
    projections += count.projections;
    after = page.next_cursor;
  }
  assert.equal(searches, entry ? 2 : 1);
  assert.equal(reads, entry ? 2 : 0);
  assert.equal(projections, entry ? (run.backend === Backend.Codex ? 6 : 4) : 0);
}

function nativeWorkflowAuditPage(page: EventPage, run: Run, entry: string | null) {
  let searches = 0;
  let reads = 0;
  let projections = 0;
  const body = knowledgeDraft(KnowledgeKind.Fact).body;
  assert.equal(JSON.stringify(page).includes(body), false);
  for (const event of page.events) {
    if (event.type === RunEventKind.AgentEvent)
      projections += nativeWorkflowProjection(event.data, run);
    if (event.type !== NativeToolAudit.Kind) continue;
    const record = NativeToolBoardSchema.parse(event.data);
    assert.equal(record.run_id, run.run_id);
    assert.equal(record.step_id, "deliver");
    assert.equal(record.attempt, 1);
    assert.equal(record.outcome, NativeToolOutcome.Returned);
    assert.equal(record.from, record.role === NativeToolRole.Worker ? "worker" : "checker");
    const key =
      record.role === NativeToolRole.Worker
        ? ExecutionPhase.Worker
        : `${ExecutionPhase.FalsifierPrefix}0`;
    assert.equal(record.execution_id, run.nodes.deliver?.phases[key]?.execution_id);
    if (record.tool === KnowledgeTool.Search) {
      searches++;
      assert.deepEqual(record.entry_ids, entry ? [entry] : []);
    }
    if (record.tool === KnowledgeTool.Get) {
      reads++;
      assert.deepEqual(record.entry_ids, [entry]);
    }
  }
  return { searches, reads, projections };
}

function nativeWorkflowProjection(data: unknown, run: Run) {
  const projected = NativeEventBoardSchema.safeParse(data);
  if (!projected.success) return 0;
  assert.equal(projected.data.data.backend, run.backend);
  assert.equal(projected.data.data.tools[0]?.call_id, "native-read");
  assert.equal(projected.data.data.tools.length, 1);
  assert.equal(JSON.stringify(data).includes("Private native query"), false);
  return 1;
}
