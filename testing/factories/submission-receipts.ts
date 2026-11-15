import { expect } from "bun:test";
import { strict as assert } from "node:assert";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { resolveConfig } from "@titan/config";
import {
  ConfigFile,
  ConfigSource,
  ErrorCode,
  ExitCode,
  HookFile,
  HttpMethod,
  HttpStatus,
  LocalServer,
  Packaging,
  RunStatus,
  SdkProcessFixture,
  ServerDatabaseAdapter,
  ServerLimit,
  SubmissionReceipt,
  SubmissionReceiptFixture,
  SubmissionReceiptSql,
  Verdict,
} from "@titan/constants";
import { all, hash } from "@titan/core";
import { startServer } from "@titan/server";
import { createRunClient } from "@titan/server/client";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  CliOutputSchema,
  ConfigSchema,
  SubmissionReceiptSchema,
  SubmissionSchema,
} from "@titan/types";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { prepareSubmission } from "../../apps/cli/src/submissions.ts";
import { captureCli } from "../support/command.ts";
import { checkedWorkflow } from "./hardening.ts";

export async function submissionReceipt(mode: SubmissionReceiptFixture): Promise<boolean> {
  return withTemporaryDirectory(async (home) => {
    const input = { request_hash: hash("first"), submission_id: "submission" };
    if (mode === SubmissionReceiptFixture.Damaged || mode === SubmissionReceiptFixture.Directory) {
      const file = resolve(home, SubmissionReceipt.File);
      await (mode === SubmissionReceiptFixture.Damaged
        ? writeFile(file, Buffer.from("damaged database"))
        : mkdir(file));
      await expect(prepareSubmission(home, input)).rejects.toMatchObject({
        code: ErrorCode.SubmissionReceipt,
      });
      return true;
    }
    if (mode === SubmissionReceiptFixture.Invalid) {
      await expect(prepareSubmission(home, { ...input, client_id: "" })).rejects.toBeDefined();
      await expect(stat(resolve(home, SubmissionReceipt.File))).rejects.toBeDefined();
      return true;
    }
    if (mode === SubmissionReceiptFixture.Generated) {
      const first = await prepareSubmission(home, { request_hash: input.request_hash });
      const second = await prepareSubmission(home, {
        ...input,
        submission_id: first.submission_id,
      });
      expect(second).toEqual(first);
      expect(first.client_id.length).toBeGreaterThan(0);
      return true;
    }
    if (mode === SubmissionReceiptFixture.Concurrent) {
      const receipts = await all(
        [() => prepareSubmission(home, input), () => prepareSubmission(home, input)],
        2,
      );
      expect(receipts[0]).toEqual(receipts[1]);
      return true;
    }
    const first = await prepareSubmission(home, { ...input, client_id: "first", max_receipts: 1 });
    expect((await stat(resolve(home, SubmissionReceipt.File))).mode & 0o777).toBe(
      ServerLimit.FileMode,
    );
    if (mode === SubmissionReceiptFixture.Explicit) {
      expect(
        await prepareSubmission(home, { ...input, client_id: "first", max_receipts: 1 }),
      ).toEqual(first);
      return true;
    }
    if (mode === SubmissionReceiptFixture.Full) {
      await expect(
        prepareSubmission(home, { ...input, submission_id: "new", max_receipts: 1 }),
      ).rejects.toMatchObject({ code: ErrorCode.SubmissionReceipt });
      expect(await prepareSubmission(home, { ...input, max_receipts: 1 })).toEqual(first);
      return true;
    }
    if (mode === SubmissionReceiptFixture.Conflict) {
      await expect(
        prepareSubmission(home, { ...input, request_hash: hash("changed") }),
      ).rejects.toMatchObject({ code: ErrorCode.SubmissionConflict });
      expect(await prepareSubmission(home, input)).toEqual(first);
      return true;
    }
    const second = await prepareSubmission(home, { ...input, client_id: "second" });
    expect(second.client_id).not.toBe(first.client_id);
    if (mode === SubmissionReceiptFixture.Ambiguous)
      await expect(prepareSubmission(home, input)).rejects.toMatchObject({
        code: ErrorCode.SubmissionReceipt,
      });
    return true;
  });
}

export function cliSubmissionReceiptProcess(
  explicit: boolean,
  loseResponse: boolean,
  cli = resolve(import.meta.dir, HookFile.RepositoryRoot, Packaging.CliSource),
): Promise<boolean> {
  return cliSubmissionReceipt(explicit, loseResponse, cli);
}

export async function cliSubmissionReceipt(
  explicit: boolean,
  loseResponse: boolean,
  cli?: string,
): Promise<boolean> {
  return withTemporaryDirectory(async (home) => {
    const file = resolve(home, "workflow.yaml");
    const workflow = checkedWorkflow();
    await writeFile(file, Buffer.from(Bun.YAML.stringify(workflow)));
    await using resources = new AsyncDisposableStack();
    let workers = 0;
    let checkers = 0;
    const backend = new FakeBackend(async (spec) => {
      if (spec.persona_id === workflow.steps[0]?.do.persona) {
        workers++;
        return { json: { note: "One submitted worker" } };
      }
      checkers++;
      return { json: { verdict: Verdict.Survived, evidence: "One independent check" } };
    });
    const server = await startServer(home, () => backend);
    resources.defer(() => server.stop());
    const client = createRunClient(home);
    const output: unknown[] = [];
    let posts = 0;
    let lost = loseResponse;
    const proxy = Bun.serve({
      hostname: LocalServer.Host,
      port: 0,
      maxRequestBodySize: ServerLimit.RequestBytes,
      async fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === LocalServer.Runs && request.method === HttpMethod.Post) {
          posts++;
          await assertCommittedReceipt(home, await request.clone().json());
        }
        const response = await fetch(
          new URL(url.pathname + url.search, server.address.url),
          request,
        );
        if (url.pathname === LocalServer.Runs && request.method === HttpMethod.Post && lost) {
          lost = false;
          await response.body?.cancel();
          return new Response("{", { status: HttpStatus.Ok });
        }
        return response;
      },
    });
    resources.defer(() => proxy.stop(true));
    await writeFile(
      resolve(home, LocalServer.File),
      Buffer.from(JSON.stringify({ ...server.address, url: proxy.url.href })),
    );
    const main = cli
      ? async (args: string[]) => {
          const result = await captureCli(cli, args);
          expect(result.code).toBe(ExitCode.Success);
          output.push(CliOutputSchema.parse(JSON.parse(result.output.toString())).data);
          return result.code;
        }
      : createCli({ ...defaultServices, output: (value) => output.push(value) });
    const project = resolve(home, "project");
    await mkdir(project, { recursive: true });
    const args = [
      "run",
      file,
      "--home",
      home,
      "--project",
      project,
      "--backend",
      "fake",
      "--detach",
      "--json",
    ];
    if (explicit) args.push("--client-id", "caller", "--submission-id", "submission");
    if (loseResponse) {
      const errors: string[] = [];
      expect(await receiptFailure(cli, args, errors)).toBe(ExitCode.Transport);
      const failure = JSON.parse(errors[0] ?? "null");
      expect(failure.error).toMatchObject({
        code: ErrorCode.SubmissionUncertain,
        recovery: { receipt_path: resolve(home, SubmissionReceipt.File) },
      });
      expect(output).toEqual([]);
      args.push(...(explicit ? [] : ["--submission-id", failure.error.recovery.submission_id]));
    }
    expect(await main(args)).toBe(ExitCode.Success);
    const runs = await client.list();
    expect(runs.runs).toHaveLength(1);
    const id = runs.runs[0]?.run_id;
    assert(id);
    assert.ok(
      await waitUntil(
        async () => (await client.get(id)).state === RunStatus.Passed,
        SdkProcessFixture.ObserveAttempts,
      ),
    );
    const run = await client.get(id);
    expect(run.nodes.one).toMatchObject({ attempt: 1 });
    expect(posts).toBe(loseResponse ? 2 : 1);
    expect(workers).toBe(1);
    expect(checkers).toBe(1);
    expect(output).toHaveLength(1);
    return true;
  });
}

export async function clientReceiptConfig(
  source: ConfigSource,
  limit: number,
): Promise<number | undefined> {
  return withTemporaryDirectory(async (home) => {
    const project = resolve(home, "project");
    await mkdir(resolve(project, ".titan"), { recursive: true });
    const value = { client: { max_submission_receipts: limit } };
    if (source === ConfigSource.User)
      await writeFile(resolve(home, ConfigFile.User), Buffer.from(Bun.YAML.stringify(value)));
    if (source === ConfigSource.Project)
      await writeFile(resolve(project, ConfigFile.Project), Buffer.from(Bun.YAML.stringify(value)));
    const settings = await resolveConfig({
      home,
      project,
      ...(source === ConfigSource.Workflow ? { workflow: value } : {}),
      ...(source === ConfigSource.Cli ? { overrides: value } : {}),
    });
    expect(ConfigSchema.parse({}).client).toBeUndefined();
    return settings.value.client?.max_submission_receipts;
  });
}

async function assertCommittedReceipt(home: string, input: unknown): Promise<void> {
  const body = SubmissionSchema.parse(input);
  const database = new Bun.SQL({
    adapter: ServerDatabaseAdapter,
    filename: resolve(home, SubmissionReceipt.File),
    strict: true,
  });
  try {
    const receipt = SubmissionReceiptSchema.parse(
      (await database.unsafe(SubmissionReceiptSql.Pair, [body.client_id, body.submission_id]))[0],
    );
    expect(receipt.client_id).toBe(body.client_id);
  } finally {
    await database.close();
  }
}

async function receiptFailure(
  cli: string | undefined,
  args: string[],
  errors: string[],
): Promise<number> {
  if (!cli) {
    const { runEntry } = await import("../../apps/cli/src/main.ts");
    return runEntry(args, (line) => errors.push(line));
  }
  const result = await captureCli(cli, args);
  errors.push(result.output.toString());
  return result.code;
}
