import { strict as assert } from "node:assert";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  AgentRuntime,
  Backend,
  ConfigFile,
  ErrorCode,
  FileEncoding,
  Packaging,
  RunStatus,
  SdkDelivery,
  SdkPlanFixture,
  StepStatus,
  VendorFixture,
  WorkspaceMode,
  WorkspaceModeSetting,
} from "@titan/constants";
import { all } from "@titan/core";
import { createRunClient } from "@titan/server/client";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type Run,
  type RunClient,
  RunSchema,
  type RunSummary,
  type SdkProbePaths,
  WorkflowSchema,
} from "@titan/types";
import { exists } from "@titan/workspace";
import { serverReady, spawnServer } from "./server-process.ts";
import { prepareVendorFixtures } from "./vendor-fixtures.ts";

function mixedWorkflow(root: string, mode: SdkPlanFixture, reverse: boolean, origin: string) {
  const base = vendorRecoveryWorkflow().personas;
  const personas = {
    codex: { ...base.worker, backend: Backend.Codex },
    claude: { ...base.worker, backend: Backend.Claude },
    codexCheck: { ...base.checker, backend: Backend.Codex },
    claudeCheck: { ...base.checker, backend: Backend.Claude },
  };
  const dependencies = [
    [],
    ["seed"],
    ["seed"],
    ["seed"],
    ["left", "middle", "right"],
    ["join"],
    ["join"],
    ["document", "audit"],
  ];
  const nodes = SdkDelivery.Steps.map((id, index) => {
    const worker = Boolean(index % 2) === reverse ? "codex" : "claude";
    const members = index >= 1 && index <= 3 ? ["left", "middle", "right"] : ["document", "audit"];
    const parallel = (index >= 1 && index <= 3) || index === 5 || index === 6;
    const conflict = mode === SdkPlanFixture.Conflict && index >= 1 && index <= 2;
    const task = JSON.stringify({
      mode: "delivery",
      file: conflict ? "shared" : id,
      content: id,
      requires:
        mode === SdkPlanFixture.MissingInput && id === "join" ? ["missing"] : dependencies[index],
      barrier:
        index === 0
          ? {
              directory: resolve(root, "origins"),
              member: origin,
              members: [...SdkDelivery.Origins],
            }
          : parallel
            ? {
                directory: resolve(root, origin, index < 4 ? "first-wave" : "second-wave"),
                member: id,
                members,
              }
            : null,
    });
    return {
      id,
      needs: dependencies[index] ?? [],
      inputs: {},
      do: { persona: worker, task },
      falsify: [{ persona: worker === "codex" ? "claudeCheck" : "codexCheck", task }],
    };
  });
  return WorkflowSchema.parse({
    name: "Mixed native SDK delivery",
    workflow_id: SdkDelivery.Workflow,
    goal: "Deliver independent files through mixed sequential and parallel native SDK phases",
    personas,
    graph: { nodes: reverse ? nodes.reverse() : nodes },
    limits: { max_parallel: 3 },
  });
}

export async function sdkMixedDelivery(
  mode: SdkPlanFixture,
  reverse: boolean,
  paths: SdkProbePaths = {},
) {
  return withTemporaryDirectory((root) => sdkMixedDeliveryAtRoot(root, mode, reverse, paths));
}

async function sdkMixedDeliveryAtRoot(
  root: string,
  mode: SdkPlanFixture,
  reverse: boolean,
  paths: SdkProbePaths,
) {
  const { home, project } = await preparePlanProject(
    root,
    paths.vendors ?? resolve("testing/fixtures/vendors"),
  );
  const child = spawnServer(home, paths.cli, SdkDelivery.DaemonTimeout);
  try {
    if (!(await waitUntil(() => serverReady(home, child.pid))))
      throw new Error("Mixed SDK daemon did not start");
    const client = createRunClient(home);
    const submitted = await all(
      SdkDelivery.Origins.map(
        (origin, index) => () =>
          client.submit({
            project,
            workflow: mixedWorkflow(
              root,
              index === 0 ? mode : SdkPlanFixture.Complete,
              reverse,
              origin,
            ),
            backend: Backend.Codex,
            client_id: origin,
            submission_id: "same-request",
          }),
      ),
    );
    const runs = await settledPlans(
      client,
      submitted.map((run) => run.run_id),
    );
    return {
      ...(await inspectPlans(root, project, runs, (await client.list()).runs, mode)),
      verified: await verifyPlans(client, runs),
    };
  } finally {
    if (child.exitCode === null) child.kill("SIGTERM");
    await child.exited;
  }
}

export async function preparePlanProject(
  root: string,
  vendors: string,
  maxActiveAgents = 8,
  recoveryAllowance = 0,
) {
  const launchers = await prepareVendorFixtures(vendors, resolve(root, Packaging.VendorStubs));
  const home = resolve(root, "home");
  const project = resolve(root, "project");
  await all([() => mkdir(home), () => mkdir(project)]);
  await writeFile(resolve(project, "source.txt"), Buffer.from("Original project content"));
  const backends = {
    [Backend.Codex]: { executable: resolve(launchers, VendorFixture.Codex) },
    [Backend.Claude]: {
      executable: resolve(launchers, VendorFixture.Claude),
      runtime: AgentRuntime.Bun,
    },
  };
  const server = { max_active_agents: maxActiveAgents, backends };
  await writeFile(
    resolve(home, ConfigFile.User),
    Buffer.from(
      JSON.stringify({
        server,
        workspace: { mode: WorkspaceModeSetting.Isolated },
        defaults: { claude_max_turns: 3 },
        recovery: { max_retries: recoveryAllowance },
      }),
    ),
  );
  return { home, project };
}

async function settledPlans(client: RunClient, ids: string[]) {
  const settled = await waitUntil(
    async () => {
      const page = await client.list({ limit: ids.length });
      return ids.every((id) =>
        page.runs.some(
          (run) =>
            run.run_id === id &&
            (run.state === RunStatus.Passed || run.state === RunStatus.Blocked),
        ),
      );
    },
    SdkDelivery.SettleAttempts,
    SdkDelivery.PollMilliseconds,
  );
  if (!settled) throw new Error("Mixed SDK deliveries did not settle");
  return all(ids.map((id) => async () => RunSchema.parse(await client.get(id))));
}

async function deliveredArtifact(directory: string | null) {
  if (directory === null) return null;
  const files = (await readdir(directory)).sort();
  const expected = [...SdkDelivery.Steps.map((id) => `${id}.txt`), "source.txt"].sort();
  const contents = await all(
    SdkDelivery.Steps.map(
      (id) => async () =>
        (await readFile(resolve(directory, `${id}.txt`))).equals(Buffer.from(`Delivered ${id}`)),
    ),
  );
  return (
    JSON.stringify(files) === JSON.stringify(expected) &&
    contents.every(Boolean) &&
    ((await stat(resolve(directory, "seed.txt"))).mode & 0o7777) === WorkspaceMode.PrivateExecutable
  );
}

async function inspectPlans(
  root: string,
  project: string,
  runs: Run[],
  list: RunSummary[],
  mode: SdkPlanFixture,
) {
  const published = await all(runs.map((run) => () => deliveredArtifact(run.artifacts)));
  const waves = await all(
    SdkDelivery.Origins.map(
      (origin) => async () =>
        (
          await exists(resolve(root, origin, "first-wave")).then((present) =>
            present ? readdir(resolve(root, origin, "first-wave")) : [],
          )
        ).filter((file) => file.endsWith(".checked")).length === 3,
    ),
  );
  return {
    unexpectedErrors: runs
      .filter((_, index) => index === 1 || mode === SdkPlanFixture.Complete)
      .flatMap((run) => Object.values(run.nodes).flatMap((node) => node.evidence)),
    state: runs[0]?.state,
    companion: runs[1]?.state,
    artifacts: published[0],
    companionArtifacts: published[1],
    independent:
      runs[0]?.run_id !== runs[1]?.run_id &&
      list.length === 2 &&
      list.every(
        (row) =>
          row.workflow_id === SdkDelivery.Workflow && runs.some((run) => run.run_id === row.run_id),
      ),
    overlap: waves.every(Boolean),
    accounting: runs.every((run) =>
      Object.values(run.nodes).every((node) => node.attempt === 1 && node.refutations === 0),
    ),
    completed: Object.values(runs[1]?.nodes ?? {}).filter(
      (node) => node.state === StepStatus.Passed,
    ).length,
    projectPreserved:
      JSON.stringify((await readdir(project)).sort()) ===
        JSON.stringify([ConfigFile.HomeDirectory, "source.txt"]) &&
      (await readFile(resolve(project, "source.txt"))).equals(
        Buffer.from("Original project content"),
      ),
  };
}

async function verifyPlans(client: RunClient, runs: Run[]): Promise<boolean> {
  for (const run of runs) {
    if (run.state !== RunStatus.Passed) {
      await assert.rejects(client.artifacts(run.run_id), { code: ErrorCode.ArtifactUnavailable });
      continue;
    }
    const inspection = await client.artifacts(run.run_id);
    assert.equal(inspection.run_id, run.run_id);
    assert.equal(inspection.workflow_id, run.workflow_id);
    assert.equal(inspection.workflow_revision, run.workflow_revision);
    assert.deepEqual(
      inspection.files.map((file) => file.path).sort(),
      [...SdkDelivery.Steps.map((id) => `${id}.txt`), "source.txt"].sort(),
    );
    assert.equal(inspection.files.find((file) => file.path === "seed.txt")?.executable, true);
    const file = inspection.files.find((entry) => entry.path === "seed.txt");
    assert.ok(file);
    const first = await client.artifact(run.run_id, file.id, { limit: 2 });
    const last = await client.artifact(run.run_id, file.id, { offset: first.next_offset });
    assert.deepEqual(first.file, file);
    assert.deepEqual(last.file, file);
    assert.equal(first.has_more, true);
    assert.equal(last.has_more, false);
    assert.equal(
      Buffer.concat([
        Buffer.from(first.content, FileEncoding.Base64),
        Buffer.from(last.content, FileEncoding.Base64),
      ]).toString(),
      "Delivered seed",
    );
  }
  return true;
}
