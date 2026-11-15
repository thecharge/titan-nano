import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { Backend, FakeScriptLimit, IoLimit, RunStatus, Verdict } from "@titan/constants";
import { FakeMessage } from "@titan/messages";
import { call, readAddress } from "@titan/server";
import { readFileBytes } from "@titan/streams";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { RunSchema, ServerErrorSchema } from "@titan/types";
import { checkedWorkflow } from "./hardening.ts";

export function spawnServer(
  home: string,
  cli = resolve("apps/cli/src/main.ts"),
  timeout = 5000,
  diagnostics?: string,
  cwd?: string,
) {
  return Bun.spawn([process.execPath, cli, "serve", "--home", home, "--json"], {
    ...(cwd ? { cwd } : {}),
    stdin: "ignore",
    stdout: diagnostics ? Bun.file(`${diagnostics}.out`) : "ignore",
    stderr: diagnostics ? Bun.file(diagnostics) : "ignore",
    timeout,
  });
}

export async function serverReady(home: string, pid: number): Promise<boolean> {
  try {
    if ((await readAddress(home)).pid !== pid) return false;
    return Reflect.get(Object(await call(home, "/health")), "ready") === true;
  } catch {
    return false;
  }
}

export async function serverProcessRecovery(mode: string) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    const project = resolve(root, "project");
    await mkdir(project);
    const children: ReturnType<typeof spawnServer>[] = [];
    try {
      const first = spawnServer(home, undefined, undefined, resolve(root, "first.stderr"));
      children.push(first);
      if (mode !== "race" && !(await waitUntil(() => serverReady(home, first.pid))))
        throw new Error("First server never became ready");
      if (mode === "live" || mode === "race") {
        const second = spawnServer(home, undefined, undefined, resolve(root, "second.stderr"));
        children.push(second);
        const decided = await waitUntil(
          async () => first.exitCode !== null || second.exitCode !== null,
          300,
        );
        if (!decided) throw new Error("Competing server was not refused");
        const rejected = first.exitCode !== null ? first : second;
        const owner = first.exitCode === null ? first : second;
        return {
          rejected: await rejected.exited,
          ownerReady: await waitUntil(() => serverReady(home, owner.pid)),
          ownerExit: owner.exitCode,
          ownerResponse: await startupError(
            resolve(root, owner === first ? "first.stderr.out" : "second.stderr.out"),
          ),
          ownerError: (
            await readFileBytes(
              resolve(root, owner === first ? "first.stderr" : "second.stderr"),
              IoLimit.ResponseBytes,
            )
          ).toString(),
        };
      }
      const workerAnswer = { message: FakeMessage.Completed };
      const checkerAnswer = { verdict: Verdict.Survived, evidence: FakeMessage.Response };
      const answers = [
        { persona: "worker", task: "Solve", answer: workerAnswer },
        { persona: "checker", task: "Refute", answer: checkerAnswer },
      ];
      const script = { version: FakeScriptLimit.Version, answers };
      const backends = { fake: { script } };
      const workflow = { ...checkedWorkflow(), backends };
      const run = RunSchema.parse(
        await call(home, "/runs", "POST", {
          project,
          workflow,
          backend: Backend.Fake,
          client_id: "process-recovery",
          submission_id: "preserved",
        }),
      );
      const passed = await waitUntil(
        async () =>
          RunSchema.parse(await call(home, `/runs/${run.run_id}`)).state === RunStatus.Passed,
      );
      if (!passed) throw new Error("Original run never passed");
      const before = await call(home, `/runs/${run.run_id}`);
      first.kill(mode === "crash" ? "SIGKILL" : "SIGTERM");
      await first.exited;
      const next = spawnServer(home);
      children.push(next);
      if (!(await waitUntil(() => serverReady(home, next.pid))))
        throw new Error("Replacement server never became ready");
      return {
        recovered:
          JSON.stringify(await call(home, `/runs/${run.run_id}`)) === JSON.stringify(before),
        ownerChanged: (await readAddress(home)).pid === next.pid && first.pid !== next.pid,
      };
    } finally {
      for (const child of children) {
        if (child.exitCode === null) child.kill("SIGKILL");
        await child.exited;
      }
    }
  });
}

async function startupError(file: string) {
  const bytes = await readFileBytes(file, IoLimit.ResponseBytes);
  const parsed = ServerErrorSchema.safeParse(JSON.parse(bytes.toString() || "null"));
  return parsed.success ? parsed.data : null;
}
