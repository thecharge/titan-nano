import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  Backend,
  ConfigFile,
  ConfigInspection,
  ErrorCode,
  ExitCode,
  FakeScriptLimit,
  McpIdentity,
  RunStatus,
  SdkProcessFixture,
  Verdict,
} from "@titan/constants";
import { hash } from "@titan/core";
import { startServer } from "@titan/server";
import { createRunClient, readAddress } from "@titan/server/client";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  CliOutputErrorSchema,
  ConfigSchema,
  McpTextContentSchema,
  type Run,
  RunSchema,
  type SdkProbePaths,
} from "@titan/types";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { createFakeBackend } from "../support/backend.ts";
import { withClientAddress } from "../support/client.ts";
import { runCliCommand, stopCommand } from "../support/command.ts";
import { withMemoryMcp, withStdioMcp } from "../support/mcp.ts";
import { serverReady, spawnServer } from "./server-process.ts";

export function frozenConfigReport(parallel = 2) {
  const value = ConfigSchema.parse({ limits: { max_parallel: parallel } });
  const sources = { "limits.max_parallel": ["built-in", "workflow"] };
  return {
    schema_version: ConfigInspection.Version,
    run_id: "run",
    workflow_id: "workflow",
    workflow_revision: hash("workflow"),
    through: 8,
    config: {
      value,
      hash: hash(JSON.stringify(value)),
      sources,
    },
  };
}

export async function frozenConfigResponse(value: unknown) {
  return withClientAddress(Response.json(value), async (home) => {
    let connections = 0;
    const client = createRunClient(home, async () => {
      connections += 1;
    });
    try {
      return await client.configuration("run");
    } finally {
      assert.equal(connections, 1);
    }
  });
}

async function inspectFrozenConfig(home: string, run: Run, cli: string, selected: boolean) {
  const client = createRunClient(home);
  const id = selected ? run.run_id : "missing-run";
  if (!selected) {
    await assert.rejects(() => client.configuration(id), { code: ErrorCode.RunNotFound });
    const response = await runCliCommand(
      cli,
      home,
      ["config", "show", "--run-id", id],
      ExitCode.Input,
    );
    assert.equal(CliOutputErrorSchema.parse(response).code, ErrorCode.RunNotFound);
    return withStdioMcp(process.execPath, [cli, "mcp", "--home", home], async (mcp) => {
      assert.equal(
        (await mcp.callTool({ name: McpIdentity.Config, arguments: { run_id: id } })).isError,
        true,
      );
    });
  }
  const expected = {
    schema_version: ConfigInspection.Version,
    run_id: run.run_id,
    workflow_id: run.workflow_id,
    workflow_revision: run.workflow_revision,
    through: run.version,
    config: run.config,
  };
  assert.deepEqual(await client.configuration(id), expected);
  assert.deepEqual(
    await runCliCommand(cli, home, ["config", "show", "--run-id", id, "--sources"]),
    expected,
  );
  assert.deepEqual(await runCliCommand(cli, home, ["config", "show", "--run-id", id]), {
    ...expected,
    config: { value: run.config.value, hash: run.config.hash },
  });
  await withStdioMcp(process.execPath, [cli, "mcp", "--home", home], async (mcp) => {
    const response = await mcp.callTool({ name: McpIdentity.Config, arguments: { run_id: id } });
    assert.notEqual(response.isError, true);
    const content = McpTextContentSchema.parse(response.content)[0];
    assert.ok(content);
    assert.deepEqual(JSON.parse(content.text), expected);
  });
  const address = await readAddress(home);
  for (const suffix of ["?cursor=1", "/extra"]) {
    const response = await fetch(`${address.url}/runs/${id}/config${suffix}`, {
      headers: { authorization: `Bearer ${address.token}` },
    });
    assert.equal(response.status, 400);
  }
  assert.deepEqual(RunSchema.parse(await client.get(id)), run);
}

export async function frozenConfigProcess(
  blocked: boolean,
  selected: boolean,
  paths: SdkProbePaths = {},
) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    const project = resolve(root, "project");
    const cli = paths.cli ?? resolve("apps/cli/src/main.ts");
    await mkdir(home);
    await mkdir(resolve(project, ".titan"), { recursive: true });
    await writeFile(
      resolve(home, ConfigFile.User),
      Buffer.from(JSON.stringify({ limits: { max_parallel: 3 } })),
    );
    await writeFile(
      resolve(project, ConfigFile.Project),
      Buffer.from(JSON.stringify({ limits: { max_parallel: 2 } })),
    );
    await using resources = new AsyncDisposableStack();
    const first = spawnServer(home, cli, SdkProcessFixture.DaemonTimeout);
    resources.defer(() => stopCommand(first));
    assert.ok(await waitUntil(() => serverReady(home, first.pid)));
    const plan = vendorRecoveryWorkflow("Inspect configuration");
    const worker = { ok: true, marker: "configuration", turn: 1 };
    const checker = { verdict: Verdict.Survived, evidence: "Checked configuration" };
    const answers = blocked
      ? []
      : [
          { persona: "worker", task: "complete", answer: worker },
          { persona: "checker", task: "Inspect configuration", answer: checker },
        ];
    const script = { version: FakeScriptLimit.Version, answers };
    const backends = { fake: { script } };
    const workflow = { ...plan, backends };
    const client = createRunClient(home);
    const created = await client.submit({
      project,
      workflow,
      backend: Backend.Fake,
      client_id: "config-inspection",
      submission_id: "one",
    });
    assert.ok(
      await waitUntil(
        async () =>
          (await client.get(created.run_id)).state ===
          (blocked ? RunStatus.Blocked : RunStatus.Passed),
      ),
    );
    const run = RunSchema.parse(await client.get(created.run_id));
    assert.equal(run.config.value.limits.max_parallel, 2);
    await inspectFrozenConfig(home, run, cli, selected);
    await stopCommand(first);
    await writeFile(
      resolve(home, ConfigFile.User),
      Buffer.from(JSON.stringify({ limits: { max_parallel: 7 } })),
    );
    await writeFile(
      resolve(project, ConfigFile.Project),
      Buffer.from(JSON.stringify({ limits: { max_parallel: 6 } })),
    );
    const next = spawnServer(home, cli, SdkProcessFixture.DaemonTimeout);
    resources.defer(() => stopCommand(next));
    assert.ok(await waitUntil(() => serverReady(home, next.pid)));
    await inspectFrozenConfig(home, run, cli, selected);
    return true;
  });
}

async function inspectMemoryConfiguration(home: string, id: string) {
  return withMemoryMcp(home, (mcp) =>
    mcp.callTool({ name: McpIdentity.Config, arguments: { run_id: id } }),
  );
}

export async function frozenConfigInspection(sources: boolean, selected: boolean) {
  return withTemporaryDirectory(async (project) => {
    const home = resolve(project, "home");
    await using resources = new AsyncDisposableStack();
    const server = await startServer(home, createFakeBackend);
    resources.defer(() => server.stop());
    const client = createRunClient(home);
    const created = await client.submit({
      project,
      workflow: vendorRecoveryWorkflow("Inspect configuration"),
      backend: Backend.Fake,
      client_id: "inspect",
      submission_id: "local",
    });
    assert.ok(
      await waitUntil(async () => (await client.get(created.run_id)).state === RunStatus.Passed),
    );
    const output: unknown[] = [];
    const cli = createCli({ ...defaultServices, output: (value) => output.push(value) });
    const id = selected ? created.run_id : "missing-run";
    const mcp = await inspectMemoryConfiguration(home, id);
    const args = ["config", "show", "--run-id", id, "--home", home, "--json"];
    if (sources) args.push("--sources");
    if (!selected) {
      await assert.rejects(() => cli(args), { code: ErrorCode.RunNotFound });
      assert.equal(output.length, 0);
      assert.equal(mcp.isError, true);
      return true;
    }
    const expected = await client.configuration(id);
    assert.notEqual(mcp.isError, true);
    const content = McpTextContentSchema.parse(mcp.content)[0];
    assert.ok(content);
    assert.deepEqual(JSON.parse(content.text), expected);
    assert.equal(await cli(args), ExitCode.Success);
    const config = sources
      ? expected.config
      : { value: expected.config.value, hash: expected.config.hash };
    assert.deepEqual(output, [{ ...expected, config }]);
    return true;
  });
}
