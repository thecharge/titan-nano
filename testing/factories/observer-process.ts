import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import {
  AgentTool,
  Backend,
  CliCommand,
  ExecutionPhase,
  ExitCode,
  IoLimit,
  Packaging,
  ProbeOption,
  ProcessIo,
  ProcessSignal,
  RunEventKind,
  RunStatus,
  SdkProcessFixture,
  Verdict,
} from "@titan/constants";
import { startServer } from "@titan/server";
import { createRunClient } from "@titan/server/client";
import { readFileBytes } from "@titan/streams";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { RunSchema } from "@titan/types";
import { stopCommand } from "../support/command.ts";
import { writeIsolatedHome } from "../support/isolated.ts";
import { checkedWorkflow } from "./hardening.ts";

export async function cliObserverProcess(
  parallel: boolean,
  interrupt: boolean,
  cli = resolve(Packaging.CliSource),
): Promise<boolean> {
  return withTemporaryDirectory(async (root) => {
    await using resources = new AsyncDisposableStack();
    const project = resolve(root, "project");
    const home = resolve(root, "home");
    const output = resolve(root, "stdout");
    const error = resolve(root, "stderr");
    const file = resolve(project, "workflow.yaml");
    await mkdir(project);
    await writeFile(output, Buffer.alloc(0));
    const base = checkedWorkflow();
    const worker = { ...base.personas.worker, tools: [AgentTool.Write] };
    const workflow = { ...base, personas: { ...base.personas, worker } };
    const first = workflow.steps[0];
    assert.ok(first);
    const steps = [first, { ...first, id: "two" }];
    const source = Buffer.from(
      Bun.YAML.stringify({ ...workflow, steps: parallel ? [{ parallel: steps }] : [steps[0]] }),
    );
    await writeFile(file, source);
    const release = Promise.withResolvers<void>();
    let workers = 0;
    await writeIsolatedHome(home);
    const server = await startServer(
      home,
      () =>
        new FakeBackend(async (spec) => {
          if (!spec.writable)
            return { json: { verdict: Verdict.Survived, evidence: "Independent check" } };
          workers++;
          await release.promise;
          return { json: { note: "Visible progress" } };
        }),
    );
    resources.defer(() => server.stop());
    resources.defer(() => release.resolve());
    const child = Bun.spawn(
      [
        process.execPath,
        cli,
        CliCommand.Run,
        file,
        ProbeOption.Home,
        home,
        ProbeOption.Project,
        project,
        ProbeOption.Backend,
        Backend.Fake,
      ],
      {
        stdin: ProcessIo.Ignore,
        stdout: Bun.file(output),
        stderr: Bun.file(error),
        timeout: SdkProcessFixture.CommandTimeout,
      },
    );
    resources.defer(() => stopCommand(child));
    assert.ok(
      await waitUntil(
        async () =>
          workers === (parallel ? 2 : 1) &&
          (await readFileBytes(output, IoLimit.ResponseBytes))
            .toString()
            .includes(` ${RunEventKind.ExecutionStarted} `),
      ),
    );
    const client = createRunClient(home);
    const page = await client.list();
    assert.equal(page.runs.length, 1);
    const identity = page.runs[0];
    assert.ok(identity);
    assert.equal((await client.get(identity.run_id)).state, RunStatus.Running);
    if (interrupt) {
      child.kill(ProcessSignal.Interrupt);
      assert.equal(await child.exited, ExitCode.Interrupted);
      assert.equal((await client.get(identity.run_id)).state, RunStatus.Running);
    }
    release.resolve();
    assert.equal(await child.exited, interrupt ? ExitCode.Interrupted : ExitCode.Success);
    assert.ok(
      await waitUntil(async () => (await client.get(identity.run_id)).state === RunStatus.Passed),
    );
    const run = RunSchema.parse(await client.get(identity.run_id));
    assert.equal(workers, parallel ? 2 : 1);
    assert.equal((await client.list()).runs.length, 1);
    for (const node of Object.values(run.nodes)) {
      assert.equal(node.attempt, 1);
      assert.equal(node.refutations, 0);
      assert.equal(node.phases[ExecutionPhase.Worker]?.executions, 1);
    }
    assert.deepEqual(await readFileBytes(file, IoLimit.DataBytes), source);
    assert.equal((await readFileBytes(error, IoLimit.ResponseBytes)).byteLength, 0);
    return true;
  });
}
