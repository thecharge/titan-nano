import { strict as assert } from "node:assert";
import { link, mkdir, readFile, stat, symlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  AgentTool,
  ApprovalLevel,
  Backend,
  ErrorCode,
  FileAccessMode,
  RequestDecision,
  RunStatus,
  ScriptSandbox,
} from "@titan/constants";
import { captureCommand, scriptSandbox } from "@titan/process";
import { createRunClient } from "@titan/server/client";
import { createRequestClient } from "@titan/server/requests";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { NodeStateSchema, ObjectSchema } from "@titan/types";
import { serverReady, spawnServer } from "./server-process.ts";

export function scriptBoundary(
  script: string,
  paths: string[],
  refused: boolean,
  kind = "ordinary",
) {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, "project");
    await mkdir(project);
    await mkdir(resolve(project, ".git"));
    await mkdir(resolve(project, "nested/.git"), { recursive: true });
    await mkdir(resolve(project, "runtime"));
    await writeFile(resolve(project, "allowed.txt"), "Original");
    await writeFile(resolve(root, "outside.txt"), "Outside");
    await writeFile(resolve(project, ".git/config"), "Protected");
    await writeFile(resolve(project, "nested/.git/config"), "Protected");
    await writeFile(resolve(project, "runtime/state"), "Protected");
    await symlink(resolve(root, "outside.txt"), resolve(project, "symbolic"));
    await link(resolve(root, "outside.txt"), resolve(project, "hard"));
    const before = await stat(resolve(root, "outside.txt"));
    const sandbox = await scriptSandbox(
      project,
      paths.map((path) => resolve(project, path)),
      [resolve(project, "runtime")],
      script,
    );
    const policy = sandbox.command[sandbox.command.indexOf(ScriptSandbox.File) + 1];
    assert.ok(policy);
    try {
      const result = await captureCommand(sandbox.command, project, { timeout_ms: 3000 });
      assert.equal(result.exit_code === 0, !refused, result.stderr.toString());
      assert.equal(await readFile(resolve(root, "outside.txt"), "utf8"), "Outside");
      assert.equal((await stat(resolve(root, "outside.txt"))).mode, before.mode);
      assert.equal(await readFile(resolve(project, ".git/config"), "utf8"), "Protected");
      assert.equal(await readFile(resolve(project, "nested/.git/config"), "utf8"), "Protected");
      assert.equal(await readFile(resolve(project, "runtime/state"), "utf8"), "Protected");
      if (refused)
        assert.ok(
          /"act":"deny"|Too many levels of symbolic links/.test(result.stderr.toString()),
          result.stderr.toString(),
        );
      if (!refused && paths.includes("allowed.txt"))
        assert.equal(await readFile(resolve(project, "allowed.txt"), "utf8"), "Changed");
      if (kind === "created")
        assert.equal(await readFile(resolve(project, "missing.txt"), "utf8"), "Created");
    } finally {
      await sandbox.close();
    }
    assert.equal(await Bun.file(policy).exists(), false);
    assert.equal(
      await Bun.file(resolve(dirname(policy), ScriptSandbox.Temporary, "output")).exists(),
      false,
    );
    return true;
  });
}

export function scriptPolicy(platform: string, paths: string[], fault = "none") {
  return withTemporaryDirectory(async (project) => {
    const selected = paths.map((path) => resolve(project, path));
    if (fault === "outside") selected.push(resolve(project, "../outside"));
    if (fault === "capacity") selected.push(...Array.from({ length: 100001 }, () => project));
    if (fault === "bytes")
      selected.push(
        ...Array.from({ length: 9000 }, (_, index) => resolve(project, "f".repeat(64) + index)),
      );
    if (fault === "metadata") selected.push(resolve(project, "n".repeat(4096)));
    if (fault !== "none") {
      await assert.rejects(() =>
        scriptSandbox(project, selected, [], "true", platform, "/missing-sandbox"),
      );
      return true;
    }
    const sandbox = await scriptSandbox(project, selected, [], "printf checked", platform);
    try {
      assert.equal(sandbox.command[0], ScriptSandbox.MacBinary);
      assert.ok(sandbox.command[2]?.includes("file-write"));
      assert.ok(sandbox.command[2]?.includes("regex"));
      return true;
    } finally {
      await sandbox.close();
    }
  });
}

export function scriptScopeProcess(
  script: string,
  paths: string[],
  refused: boolean,
  restart: boolean,
  cli?: string,
) {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, "project");
    const home = resolve(root, "home");
    await mkdir(project);
    await mkdir(resolve(project, ".git"));
    await writeFile(resolve(root, "outside.txt"), "Outside");
    await writeFile(resolve(project, ".git/config"), "Protected");
    let server = spawnServer(home, cli, 15000);
    const client = createRunClient(home);
    const requests = createRequestClient(home);
    try {
      assert.ok(await waitUntil(() => serverReady(home, server.pid)));
      const run = await client.submit({
        project,
        backend: Backend.Fake,
        client_id: "script-scope",
        submission_id: "script-scope",
        workflow: {
          name: "script-scope",
          goal: "Keep approved scripts inside their negotiated live file scope",
          personas: {},
          steps: [
            {
              id: "write",
              files: paths.includes(".") ? undefined : paths,
              do: { script },
              falsify: [{ script: "true" }],
              max_attempts: 1,
            },
          ],
        },
      });
      assert.ok(
        await waitUntil(async () => (await client.get(run.run_id)).state === RunStatus.Waiting),
      );
      assert.equal(await Bun.file(resolve(project, "allowed.txt")).exists(), false);
      if (restart) {
        server.kill("SIGTERM");
        await server.exited;
        server = spawnServer(home, cli, 15000);
        assert.ok(await waitUntil(() => serverReady(home, server.pid)));
      }
      for (let round = 0; round < 2; round++) {
        const pending = (await requests.list({ run_id: run.run_id })).requests
          .map((entry) => entry.request)
          .find((entry) => entry.answer === null);
        assert.ok(pending);
        await requests.answer(
          {
            run_id: run.run_id,
            request_id: pending.request_id,
            version: pending.version,
            decision: RequestDecision.Approve,
            reason: "Reviewed exact script with its live file claim",
            client_id: "owner",
          },
          ApprovalLevel.Human,
        );
        assert.ok(
          await waitUntil(async () => {
            const state = (await client.get(run.run_id)).state;
            return (
              state === RunStatus.Passed ||
              state === RunStatus.Failed ||
              state === RunStatus.Blocked ||
              (state === RunStatus.Waiting &&
                (await requests.list({ run_id: run.run_id })).requests.some(
                  (entry) => entry.request.answer === null,
                ))
            );
          }),
        );
      }
      const final = await client.get(run.run_id);
      assert.equal(final.state, RunStatus.Passed);
      assert.equal(await readFile(resolve(project, "allowed.txt"), "utf8"), "Created");
      assert.equal(await readFile(resolve(root, "outside.txt"), "utf8"), "Outside");
      assert.equal(await readFile(resolve(project, ".git/config"), "utf8"), "Protected");
      const stderr = String(
        ObjectSchema.parse(NodeStateSchema.parse(final.nodes.write).phases.worker?.answer).stderr,
      );
      assert.equal(stderr.includes('"act":"deny"'), refused);
      return true;
    } finally {
      if (server.exitCode === null) server.kill("SIGTERM");
      await server.exited;
    }
  });
}

export function scriptLifetime(mode: string, script: string) {
  return withTemporaryDirectory(async (project) => {
    const path = resolve(project, "allowed.txt");
    await writeFile(path, "Original");
    const sandbox = await scriptSandbox(project, [path], [], script);
    try {
      const operation = captureCommand(
        sandbox.command,
        project,
        {
          timeout_ms: mode === "timeout" ? 200 : 3000,
        },
        mode === "cancel" ? AbortSignal.timeout(200) : undefined,
      );
      if (mode === "complete") {
        assert.equal((await operation).exit_code, 0);
        assert.equal(await readFile(path, "utf8"), "Changed");
      } else {
        await assert.rejects(
          operation,
          mode === "cancel" ? { name: "TimeoutError" } : { code: ErrorCode.CommandTimeout },
        );
        await Bun.sleep(700);
        assert.equal(await readFile(path, "utf8"), "Original");
      }
      return true;
    } finally {
      await sandbox.close();
    }
  });
}

export function scriptReadClaim(script: string, refused: boolean, cli?: string) {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, "project");
    const home = resolve(root, "home");
    await mkdir(project);
    await writeFile(resolve(project, "allowed.txt"), "Original");
    const server = spawnServer(home, cli, 15000);
    const client = createRunClient(home);
    const requests = createRequestClient(home);
    try {
      assert.ok(await waitUntil(() => serverReady(home, server.pid)));
      const run = await client.submit({
        project,
        backend: Backend.Fake,
        client_id: "script-reader",
        submission_id: "script-reader",
        workflow: {
          name: "script-reader",
          goal: "Preserve a read claim during script verification",
          backends: {
            fake: {
              script: {
                version: 1,
                answers: [
                  { persona: "reader", task: "Read", answer: { ok: true } },
                  {
                    persona: "checker",
                    task: "Check",
                    answer: { verdict: "survived", evidence: "checked" },
                  },
                ],
              },
            },
          },
          personas: {
            reader: {
              description: "Reader",
              role: "Read files",
              tools: [AgentTool.Read],
              outputs: { ok: { type: "boolean" } },
            },
            checker: { description: "Checker", role: "Check files", tools: [AgentTool.Read] },
          },
          steps: [
            {
              id: "read",
              files: ["allowed.txt"],
              do: { persona: "reader", task: "Read" },
              falsify: [{ persona: "checker", task: "Check" }],
              verify: [{ kind: "script", run: script, deterministic: true, timeout_s: 3 }],
              max_attempts: 1,
            },
          ],
        },
      });
      assert.ok(
        await waitUntil(
          async () => (await client.get(run.run_id)).state === RunStatus.Waiting,
          400,
        ),
      );
      for (let round = 0; round < 2; round++) {
        const pending = (await requests.list({ run_id: run.run_id })).requests
          .map((entry) => entry.request)
          .find((entry) => entry.answer === null);
        assert.ok(pending);
        await requests.answer(
          {
            run_id: run.run_id,
            request_id: pending.request_id,
            version: pending.version,
            decision: RequestDecision.Approve,
            reason: "Reviewed proof under a read claim",
            client_id: "owner",
          },
          ApprovalLevel.Human,
        );
        assert.ok(
          await waitUntil(async () => {
            const state = (await client.get(run.run_id)).state;
            return (
              state === RunStatus.Passed ||
              state === RunStatus.Failed ||
              state === RunStatus.Blocked ||
              (state === RunStatus.Waiting &&
                (await requests.list({ run_id: run.run_id })).requests.some(
                  (entry) => entry.request.answer === null,
                ))
            );
          }, 400),
          JSON.stringify(await client.get(run.run_id)),
        );
      }
      const final = await client.get(run.run_id);
      const proof = NodeStateSchema.parse(final.nodes.read).phases["proof-0-0"];
      assert.equal(proof?.file_claim?.mode, FileAccessMode.Read);
      const answer = ObjectSchema.parse(proof?.answer);
      assert.equal(answer.exit_code === 0, !refused, String(answer.stderr));
      assert.equal(final.state === RunStatus.Passed, !refused);
      if (refused)
        assert.ok(
          String(
            ObjectSchema.parse(
              NodeStateSchema.parse(final.nodes.read).phases["proof-result-0"]?.answer,
            ).evidence,
          ).includes('"act":"deny"'),
        );
      assert.equal(await readFile(resolve(project, "allowed.txt"), "utf8"), "Original");
      assert.equal(await Bun.file(resolve(project, "extra.txt")).exists(), false);
      return true;
    } finally {
      if (server.exitCode === null) server.kill("SIGTERM");
      await server.exited;
    }
  });
}
