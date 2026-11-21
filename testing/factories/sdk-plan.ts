import { strict as assert } from "node:assert";
import { constants } from "node:fs";
import { copyFile, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  AgentRuntime,
  Backend,
  CliCommand,
  ConfigFile,
  ErrorCode,
  ExecutionPhase,
  FileEncoding,
  IoLimit,
  Packaging,
  ProbeOption,
  RunEventKind,
  RunFile,
  RunStatus,
  SdkDelivery,
  SdkPlanFixture,
  StepStatus,
  VendorFixture,
  WorkspaceMode,
  WorkspaceModeSetting,
} from "@titan/constants";
import { all, hash } from "@titan/core";
import { createRunClient } from "@titan/server/client";
import { readFileBytes } from "@titan/streams";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  ArtifactExportSchema,
  ArtifactInspectionSchema,
  ArtifactPageSchema,
  type Run,
  type RunClient,
  RunSchema,
  type RunSummary,
  type SdkProbePaths,
  VendorStubCallSchema,
  WorkflowCheckItemSchema,
  WorkflowSchema,
} from "@titan/types";
import { exists } from "@titan/workspace";
import { runCliCommand, stopCommand } from "../support/command.ts";
import { serverReady, spawnServer } from "./server-process.ts";
import { prepareVendorFixtures } from "./vendor-fixtures.ts";

async function recoveryWorkflow(root: string, reverse: boolean, installed: boolean) {
  const assets = installed ? Packaging.InstalledPath : ".";
  const source = (
    await readFileBytes(
      resolve(assets, Packaging.Examples, "installed-recovery.yaml"),
      IoLimit.DataBytes,
    )
  ).toString(FileEncoding.Utf8);
  const workflow = WorkflowSchema.parse(Bun.YAML.parse(source));
  assert.ok(workflow.graph);
  for (const node of workflow.graph.nodes) {
    if (node.needs?.length) continue;
    assert.ok("persona" in node.do);
    node.do.task = JSON.stringify({
      ...JSON.parse(node.do.task),
      barrier: {
        directory: resolve(root, "overlap"),
        member: node.id,
        members: ["left", "right"],
      },
    });
  }
  for (const persona of Object.values(workflow.personas)) {
    if (reverse)
      persona.backend = persona.backend === Backend.Codex ? Backend.Claude : Backend.Codex;
  }
  return workflow;
}

export async function sdkMixedRestart(
  reverse: boolean,
  mutant?: string,
  paths: SdkProbePaths = {},
) {
  return withTemporaryDirectory((root) => sdkMixedRestartAtRoot(root, reverse, paths, mutant));
}

async function sdkMixedRestartAtRoot(
  root: string,
  reverse: boolean,
  paths: SdkProbePaths,
  mutant?: string,
) {
  const { home, project } = await preparePlanProject(
    root,
    paths.vendors ?? resolve(Packaging.VendorSources),
    8,
    1,
  );
  const cli = paths.cli ?? resolve(Packaging.CliSource);
  const controllerHash = paths.cli
    ? hash(await readFileBytes(cli, Packaging.BundleMaximumBytes))
    : null;
  const children: ReturnType<typeof spawnServer>[] = [];
  async function start() {
    const child = spawnServer(home, cli, SdkDelivery.DaemonTimeout);
    children.push(child);
    assert(await waitUntil(() => serverReady(home, child.pid)), "Recovery daemon did not start");
    return child;
  }
  try {
    const first = await start();
    const client = createRunClient(home);
    const workflow = resolve(root, "recovery.yaml");
    await writeFile(
      workflow,
      JSON.stringify(await recoveryWorkflow(root, reverse, Boolean(paths.cli))),
    );
    await runCliCommand(cli, home, [CliCommand.Check, workflow, ProbeOption.Project, project]);
    const dryRun = WorkflowCheckItemSchema.omit({ path: true }).parse(
      await runCliCommand(cli, home, [
        CliCommand.Run,
        workflow,
        ProbeOption.Project,
        project,
        "--dry-run",
      ]),
    );
    assert.deepEqual(
      dryRun.nodes.map(({ id }) => id),
      ["left", "right", "finish"],
    );
    assert.equal((await client.list({ limit: 1 })).runs.length, 0);
    const submitted = RunSchema.parse(
      await runCliCommand(cli, home, [
        CliCommand.Run,
        workflow,
        ProbeOption.Project,
        project,
        "--detach",
        "--backend",
        Backend.Codex,
      ]),
    );
    const interrupted = reverse ? RunStatus.Blocked : RunStatus.Recovering;
    assert(
      await waitUntil(
        async () => (await client.get(submitted.run_id)).state === interrupted,
        SdkDelivery.SettleAttempts,
        SdkDelivery.PollMilliseconds,
      ),
      "Expected SDK interruption was not observed",
    );
    const before = RunSchema.parse(await client.get(submitted.run_id));
    assert.equal(before.state, interrupted);
    assert.equal(before.nodes.left?.state, StepStatus.Passed);
    assert.equal(before.nodes.right?.state, StepStatus.Passed);
    assert.deepEqual(
      (await readdir(resolve(root, "overlap"))).filter((file) => file.endsWith(".checked")).sort(),
      ["left.checked", "right.checked"],
    );
    const phase = `${ExecutionPhase.FalsifierPrefix}0`;
    assert.ok(before.nodes.finish?.phases[phase]?.session_id);
    await assertStubDispatches(before, false);
    first.kill("SIGKILL");
    await first.exited;
    await start();
    await runCliCommand(cli, home, ["resume", before.run_id, "--watch"]);
    const [after] = await settledPlans(client, [before.run_id]);
    assert.ok(after);
    assert.equal(after.state, RunStatus.Passed, after.nodes.finish?.phases[phase]?.error ?? "");
    assert.equal(after.runtime_version, before.runtime_version);
    if (controllerHash) {
      assert.equal(before.runtime_build, controllerHash);
      assert.equal(after.runtime_build, controllerHash);
      assert.equal(hash(await readFileBytes(cli, Packaging.BundleMaximumBytes)), controllerHash);
    }
    assertMixedRestart(before, after);
    await assertStubDispatches(after, true);
    if (mutant) {
      const changed = structuredClone(after);
      const node = changed.nodes[mutant === "attempt" ? "finish" : "left"];
      assert.ok(node);
      if (mutant === "attempt") node.attempt++;
      else {
        const worker = node.phases[ExecutionPhase.Worker];
        assert.ok(worker);
        worker.executions++;
      }
      assert.throws(() => assertMixedRestart(before, changed), assert.AssertionError);
    }
    const eventKind = reverse ? RunEventKind.ExecutionBlocked : RunEventKind.ExecutionRecovering;
    assert((await client.events(after.run_id)).events.some((event) => event.type === eventKind));
    assert.equal((await client.usage(after.run_id)).executions, 7);
    await inspectRestartDelivery(cli, home, after, project);
    return true;
  } finally {
    for (const child of children) await stopCommand(child);
  }
}

async function assertStubDispatches(run: Run, recovered: boolean) {
  for (const id of ["left", "right", "finish"]) {
    const work = run.nodes[id]?.work;
    assert.ok(work);
    const review = resolve(work, "..", `${RunFile.ReviewPrefix}0`);
    for (const directory of [work, review]) {
      const bytes = await readFileBytes(
        resolve(directory, VendorFixture.StateDirectory, "calls.jsonl"),
        IoLimit.DataBytes,
      );
      const resumed = bytes
        .toString(FileEncoding.Utf8)
        .trim()
        .split("\n")
        .map((line) => VendorStubCallSchema.parse(JSON.parse(line)).resume);
      assert.deepEqual(
        resumed,
        recovered && id === "finish" && directory === review ? [false, true] : [false],
      );
    }
  }
}

function assertMixedRestart(before: Run, after: Run) {
  const phase = `${ExecutionPhase.FalsifierPrefix}0`;
  for (const id of ["left", "right"]) assert.deepEqual(after.nodes[id], before.nodes[id]);
  assert.deepEqual(
    after.nodes.finish?.phases[ExecutionPhase.Worker],
    before.nodes.finish?.phases[ExecutionPhase.Worker],
  );
  assert.equal(before.nodes.finish?.attempt, 1);
  assert.equal(after.nodes.finish?.attempt, 1);
  assert.equal(after.nodes.finish?.refutations, 0);
  assert.equal(before.nodes.finish?.phases[phase]?.executions, 1);
  assert.equal(
    after.nodes.finish?.phases[phase]?.session_id,
    before.nodes.finish?.phases[phase]?.session_id,
  );
  assert.equal(after.nodes.finish?.phases[phase]?.executions, 2);
}

async function inspectRestartDelivery(cli: string, home: string, run: Run, project: string) {
  const artifact = ArtifactInspectionSchema.parse(
    await runCliCommand(cli, home, ["artifacts", "list", run.run_id]),
  );
  assert.deepEqual(artifact.files.map(({ path }) => path).sort(), [
    "finish.txt",
    "left.txt",
    "right.txt",
    "source.txt",
  ]);
  const file = artifact.files.find(({ path }) => path === "finish.txt");
  assert.ok(file);
  const page = ArtifactPageSchema.parse(
    await runCliCommand(cli, home, ["artifacts", "show", run.run_id, file.id]),
  );
  assert.equal(page.has_more, false);
  assert.equal(Buffer.from(page.content, FileEncoding.Base64).toString(), "Delivered finish");
  const delivery = ArtifactExportSchema.parse(
    await runCliCommand(cli, home, [
      "artifacts",
      "export",
      run.run_id,
      file.id,
      "--output",
      resolve(home, "review"),
    ]),
  );
  assert.equal(delivery.delivery.delivery_hash, artifact.hash);
  const exported = resolve(delivery.directory, delivery.delivery.content);
  const target = resolve(project, file.path);
  assert.equal((await readFile(exported)).toString(), "Delivered finish");
  assert.equal(await exists(target), false);
  await copyFile(exported, target, constants.COPYFILE_EXCL);
  await assert.rejects(copyFile(exported, target, constants.COPYFILE_EXCL), { code: "EEXIST" });
  assert.equal((await readFile(target)).toString(), "Delivered finish");
}

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
