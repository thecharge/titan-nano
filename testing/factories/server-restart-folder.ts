import { mkdir, readFile, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import {
  Backend,
  BoardFile,
  FakeScriptLimit,
  FileEncoding,
  HttpHeader,
  HttpMethod,
  LocalServer,
  RunStatus,
  ServerFolderCheck,
  ServerFolderFixture,
  Verdict,
} from "@titan/constants";
import { FakeMessage } from "@titan/messages";
import { call, readAddress } from "@titan/server";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { type Run, RunSchema } from "@titan/types";
import { checkedWorkflow } from "./hardening.ts";
import { serverReady, spawnServer } from "./server-process.ts";

function scriptedWorkflow() {
  const answers = [
    {
      persona: ServerFolderFixture.Worker,
      task: ServerFolderFixture.Solve,
      answer: { message: FakeMessage.Completed },
    },
    {
      persona: ServerFolderFixture.Checker,
      task: ServerFolderFixture.Refute,
      answer: { verdict: Verdict.Survived, evidence: FakeMessage.Response },
    },
  ];
  const script = { version: FakeScriptLimit.Version, answers };
  return { ...checkedWorkflow(), backends: { fake: { script } } };
}

async function statusOf(home: string, id: string): Promise<number> {
  const address = await readAddress(home);
  const response = await fetch(new URL(`${LocalServer.Runs}/${id}`, address.url), {
    headers: { [HttpHeader.Authorization]: `${LocalServer.Bearer}${address.token}` },
  });
  return response.status;
}

async function readRun(home: string, id: string): Promise<Run> {
  return RunSchema.parse(await call(home, `${LocalServer.Runs}/${id}`));
}

export async function serverRestartFolder(check: ServerFolderCheck) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, ServerFolderFixture.Home);
    const project = resolve(root, ServerFolderFixture.Project);
    const first = resolve(root, ServerFolderFixture.First);
    const second = resolve(root, ServerFolderFixture.Second);
    await mkdir(project);
    await mkdir(first);
    await mkdir(second);
    const children: ReturnType<typeof spawnServer>[] = [];
    try {
      const one = spawnServer(
        home,
        undefined,
        undefined,
        resolve(root, ServerFolderFixture.FirstLog),
        first,
      );
      children.push(one);
      if (!(await waitUntil(() => serverReady(home, one.pid))))
        throw new Error("First server never became ready");
      const created = RunSchema.parse(
        await call(home, LocalServer.Runs, HttpMethod.Post, {
          project,
          workflow: scriptedWorkflow(),
          backend: Backend.Fake,
          client_id: ServerFolderFixture.Client,
          submission_id: ServerFolderFixture.Submission,
        }),
      );
      const kept = await waitUntil(
        async () => (await readRun(home, created.run_id)).state === RunStatus.Passed,
      );
      if (!kept) throw new Error("Original run never passed");
      const before = await readRun(home, created.run_id);
      const journal = resolve(before.root, BoardFile.Journal);
      const journalBefore = await readFile(journal, FileEncoding.Utf8);
      const firstCwd = await realpath(
        resolve(ServerFolderFixture.Proc, `${one.pid}`, ServerFolderFixture.Cwd),
      );
      one.kill();
      await one.exited;
      const target =
        check === ServerFolderCheck.OtherHome ? resolve(root, ServerFolderFixture.OtherHome) : home;
      const two = spawnServer(
        target,
        undefined,
        undefined,
        resolve(root, ServerFolderFixture.SecondLog),
        second,
      );
      children.push(two);
      if (!(await waitUntil(() => serverReady(target, two.pid))))
        throw new Error("Second server never became ready");
      if (check === ServerFolderCheck.Missing)
        return await statusOf(home, ServerFolderFixture.MissingRun);
      if (check === ServerFolderCheck.OtherHome) return await statusOf(target, created.run_id);
      await Bun.sleep(ServerFolderFixture.SettleMs);
      const after = await readRun(home, created.run_id);
      if (check === ServerFolderCheck.Home)
        return `${(await readAddress(home)).pid === two.pid} ${after.run_id === created.run_id}`;
      if (check === ServerFolderCheck.Moved)
        return `${firstCwd === (await realpath(first))} ${
          (await realpath(
            resolve(ServerFolderFixture.Proc, `${two.pid}`, ServerFolderFixture.Cwd),
          )) === (await realpath(second))
        }`;
      if (check === ServerFolderCheck.Project)
        return `${after.project === before.project} ${after.project !== second}`;
      if (check === ServerFolderCheck.Backends) {
        const answers = after.config.value.backends?.fake?.script.answers ?? [];
        return (
          answers.length === ServerFolderFixture.ScriptedAnswers &&
          JSON.stringify(after.config.value.backends) ===
            JSON.stringify(before.config.value.backends)
        );
      }
      if (check === ServerFolderCheck.Journal)
        return (await readFile(journal, FileEncoding.Utf8)) === journalBefore;
      return after.artifacts !== null && after.artifacts === before.artifacts;
    } finally {
      for (const child of children) {
        if (child.exitCode === null) child.kill("SIGKILL");
        await child.exited;
      }
    }
  });
}
