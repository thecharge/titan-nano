import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import {
  Backend,
  CliCommand,
  CliEventFormat,
  ExitCode,
  HookFile,
  IoLimit,
  Newline,
  Packaging,
  ProbeOption,
  ProcessIo,
  ProcessSignal,
  RunStatus,
  SdkProcessFixture,
  Verdict,
} from "@titan/constants";
import { startServer } from "@titan/server";
import { createRunClient } from "@titan/server/client";
import { readFileBytes } from "@titan/streams";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { CliEventLineSchema, RunSchema } from "@titan/types";
import { stopCommand } from "../support/command.ts";
import { checkedWorkflow } from "./hardening.ts";

export async function cliEventFollowProcess(
  parallel: boolean,
  jsonl: boolean,
  cli = resolve(import.meta.dir, HookFile.RepositoryRoot, Packaging.CliSource),
): Promise<boolean> {
  return withTemporaryDirectory((root) => observeFollowProcess(root, parallel, jsonl, cli));
}

async function observeFollowProcess(
  root: string,
  parallel: boolean,
  jsonl: boolean,
  cli: string,
): Promise<boolean> {
  await using resources = new AsyncDisposableStack();
  const home = resolve(root, "home");
  const project = resolve(root, "project");
  const output = resolve(root, "stdout");
  const error = resolve(root, "stderr");
  await mkdir(project);
  await writeFile(output, Buffer.alloc(0));
  const workflow = checkedWorkflow();
  const step = workflow.steps[0];
  assert(step);
  const steps = [step, { ...step, id: "two" }];
  const release = Promise.withResolvers<void>();
  const server = await startServer(
    home,
    () =>
      new FakeBackend(async (spec) => {
        if (spec.persona_id !== step.do.persona)
          return { json: { verdict: Verdict.Survived, evidence: "Independent check" } };
        await release.promise;
        return { json: { note: "Work survives observer exit" } };
      }),
  );
  resources.defer(() => server.stop());
  resources.defer(() => release.resolve());
  const client = createRunClient(home);
  const plan = { ...workflow, steps: parallel ? [{ parallel: steps }] : steps };
  const run = await client.submit({
    project,
    workflow: plan,
    backend: Backend.Fake,
    client_id: "follow-test",
    submission_id: "once",
  });
  const args = [cli, CliCommand.Events, run.run_id, ProbeOption.Home, home, ProbeOption.Follow];
  if (jsonl) args.push(ProbeOption.Format, CliEventFormat.JsonLines);
  const child = Bun.spawn([process.execPath, ...args], {
    stdin: ProcessIo.Ignore,
    stdout: Bun.file(output),
    stderr: Bun.file(error),
    timeout: SdkProcessFixture.CommandTimeout,
  });
  resources.defer(() => stopCommand(child));
  assert(
    await waitUntil(async () =>
      (await readFileBytes(output, IoLimit.ResponseBytes)).includes(Buffer.from(Newline)),
    ),
  );
  child.kill(ProcessSignal.Interrupt);
  assert.equal(await child.exited, ExitCode.Interrupted);
  assert.equal((await readFileBytes(error, IoLimit.ResponseBytes)).length, 0);
  const lines = (await readFileBytes(output, IoLimit.ResponseBytes)).toString().trim().split("\n");
  assert(lines.length > 0);
  if (jsonl) {
    const events = lines.map((line) => CliEventLineSchema.parse(JSON.parse(line)));
    assert(events.every((event, index) => event.run_id === run.run_id && event.id === index + 1));
  } else assert(lines.every((line, index) => line.startsWith(`${index + 1} `)));
  const continuing = RunSchema.parse(await client.get(run.run_id));
  assert.equal(continuing.state, RunStatus.Running);
  for (const node of Object.values(continuing.nodes)) assert.equal(node.refutations, 0);
  release.resolve();
  assert(await waitUntil(async () => (await client.get(run.run_id)).state === RunStatus.Passed));
  return true;
}
