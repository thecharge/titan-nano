import { strict as assert } from "node:assert";
import { chmod, mkdir, readFile, rename, rm, stat, symlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { inspectArtifacts } from "@titan/artifacts";
import { FakeBackend } from "@titan/backend-fake";
import { describeRunConfiguration, readRunConfiguration } from "@titan/config";
import {
  ArtifactInspectionTransport,
  ArtifactMutation,
  ArtifactResultFixture,
  Backend,
  BoardFile,
  BoardLimit,
  ErrorCode,
  IoLimit,
  McpIdentity,
  RunArtifactFile,
  RunEventKind,
  RunStatus,
  WorkspaceMode,
} from "@titan/constants";
import { hash } from "@titan/core";
import { RunnerMessage, resultDocument } from "@titan/messages";
import { startServer } from "@titan/server";
import { createRunClient, readAddress } from "@titan/server/client";
import { createDashboardClient } from "@titan/server/dashboard-client";
import { startMcp } from "@titan/server/mcp";
import { readFileBytes } from "@titan/streams";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { thrownBy, waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  ArtifactInspectionSchema,
  ArtifactManifestSchema,
  ArtifactPageSchema,
  type ArtifactRunAction,
  McpTextContentSchema,
  type Run,
  RunEventSchema,
  RunResultSchema,
  RunSchema,
  ServerErrorSchema,
} from "@titan/types";
import { readTree, treeHash } from "@titan/workspace";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { withClientResponse } from "../support/client.ts";
import { writeIsolatedHome } from "../support/isolated.ts";

export async function withArtifactRun<T>(
  executable: boolean,
  action: ArtifactRunAction<T>,
  extraPath = "added.txt",
  content = Buffer.from("delivered"),
): Promise<T> {
  return withTemporaryDirectory(async (root) => {
    const project = resolve(root, "project");
    const home = resolve(root, "home");
    await mkdir(project);
    await writeFile(resolve(project, "source.txt"), Buffer.from("original"));
    const backend = new FakeBackend(async (spec) => {
      if (spec.writable) {
        await writeFile(resolve(spec.cwd, "source.txt"), content);
        await mkdir(dirname(resolve(spec.cwd, extraPath)), { recursive: true });
        await writeFile(resolve(spec.cwd, extraPath), Buffer.from("new file"));
        await chmod(
          resolve(spec.cwd, "source.txt"),
          executable ? WorkspaceMode.PrivateExecutable : WorkspaceMode.PrivateFile,
        );
      }
      return {
        json: spec.writable
          ? { ok: true, marker: "delivered", turn: 1 }
          : { verdict: "survived", evidence: "Inspected files" },
      };
    });
    await writeIsolatedHome(home);
    const server = await startServer(home, () => backend);
    const client = createRunClient(home);
    try {
      const submitted = await client.submit({
        project,
        workflow: vendorRecoveryWorkflow("Inspect delivery"),
        backend: Backend.Fake,
        client_id: "artifact-fixture",
        submission_id: "one",
      });
      assert.ok(
        await waitUntil(
          async () => (await client.get(submitted.run_id)).state === RunStatus.Passed,
        ),
      );
      const run = RunSchema.parse(await client.get(submitted.run_id));
      return await action(run, home);
    } finally {
      await server.stop();
    }
  });
}

export async function dashboardArtifactDelivery(file: boolean, tampered: boolean) {
  return withArtifactRun(false, async (run, home) => {
    const inspection = await inspectArtifacts(run);
    const selected = inspection.files.find((entry) => entry.path === "source.txt");
    assert.ok(selected);
    const { link } = await createDashboardClient(home).login();
    const login = await fetch(link, { redirect: "manual" });
    assert.equal(login.status, 303);
    const cookie = login.headers.get("set-cookie")?.split(";")[0];
    assert.ok(cookie);
    if (tampered) await writeFile(resolve(inspection.directory, selected.path), "changed");
    const path = `/ui/api/runs/${run.run_id}/artifacts${file ? `/${selected.id}?offset=1&limit=3` : ""}`;
    const response = await fetch(new URL(path, link), { headers: { cookie } });
    const value: unknown = await response.json();
    if (tampered)
      return {
        status: response.status,
        valid: ServerErrorSchema.parse(value).code === ErrorCode.ArtifactInvalid,
      };
    if (file) {
      const page = ArtifactPageSchema.parse(value);
      return {
        status: response.status,
        valid:
          Buffer.from(page.content, "base64").toString() === "eli" &&
          page.next_offset === 4 &&
          page.has_more,
      };
    }
    assert.deepEqual(ArtifactInspectionSchema.parse(value), inspection);
    return { status: response.status, valid: true };
  });
}

export async function dashboardConfigurationDelivery(edited: boolean, refused: boolean) {
  return withArtifactRun(false, async (run, home) => {
    const expected = describeRunConfiguration(run);
    const { link } = await createDashboardClient(home).login();
    const login = await fetch(link, { redirect: "manual" });
    const cookie = login.headers.get("set-cookie")?.split(";")[0];
    assert.ok(cookie);
    if (edited)
      await writeFile(
        resolve(home, "config.yaml"),
        JSON.stringify({ limits: { max_parallel: 7 } }),
      );
    const path = `/ui/api/runs/${run.run_id}/config${refused && edited ? "?scope=user" : ""}`;
    const response = await fetch(new URL(path, link), {
      headers: refused && !edited ? {} : { cookie },
    });
    if (refused) {
      assert.equal(response.status, edited ? 400 : 401);
      return true;
    }
    assert.equal(response.status, 200);
    assert.deepEqual(readRunConfiguration(await response.json(), run.run_id), expected);
    return true;
  });
}

export async function mutateArtifacts(run: Run, mutation: ArtifactMutation): Promise<void> {
  const directory = run.artifacts ?? "";
  const manifestPath = resolve(run.root, RunArtifactFile.Manifest);
  const result = resolve(run.root, RunArtifactFile.Result);
  const source = resolve(directory, "source.txt");
  if (mutation === ArtifactMutation.None) return;
  if (mutation === ArtifactMutation.NotPassed) {
    run.state = RunStatus.Blocked;
    return;
  }
  if (mutation === ArtifactMutation.MissingDirectory) {
    run.artifacts = null;
    return;
  }
  if (mutation === ArtifactMutation.WrongDirectory) {
    run.artifacts = run.project;
    return;
  }
  if (mutation === ArtifactMutation.Content) {
    await writeFile(source, Buffer.from("tampered"));
    return;
  }
  if (mutation === ArtifactMutation.Mode) {
    await chmod(
      source,
      (await stat(source)).mode & WorkspaceMode.ExecutableBits
        ? WorkspaceMode.PrivateFile
        : WorkspaceMode.PrivateExecutable,
    );
    return;
  }
  if (mutation === ArtifactMutation.Result) {
    await writeFile(result, Buffer.from("unverified result"));
    return;
  }
  if (mutation === ArtifactMutation.Malformed) {
    await writeFile(manifestPath, Buffer.from("{"));
    return;
  }
  if (mutation === ArtifactMutation.MissingManifest) {
    await rm(manifestPath);
    return;
  }
  if (
    mutation === ArtifactMutation.DirectoryLink ||
    mutation === ArtifactMutation.ManifestLink ||
    mutation === ArtifactMutation.FileLink ||
    mutation === ArtifactMutation.ResultLink
  ) {
    const path =
      mutation === ArtifactMutation.DirectoryLink
        ? directory
        : mutation === ArtifactMutation.ManifestLink
          ? manifestPath
          : mutation === ArtifactMutation.FileLink
            ? source
            : result;
    await rename(path, `${path}.kept`);
    await symlink(`${path}.kept`, path);
    return;
  }
  if (
    mutation === ArtifactMutation.JournalType ||
    mutation === ArtifactMutation.JournalHash ||
    mutation === ArtifactMutation.JournalEmpty
  ) {
    const path = resolve(run.root, BoardFile.Journal);
    if (mutation === ArtifactMutation.JournalEmpty) {
      await writeFile(path, Buffer.alloc(0));
      return;
    }
    const lines = (await readFile(path))
      .toString()
      .trim()
      .split("\n")
      .map((line) => RunEventSchema.parse(JSON.parse(line)));
    const last = lines.at(-1);
    if (!last) throw new Error("Missing fixture journal event");
    if (mutation === ArtifactMutation.JournalType) last.type = RunEventKind.Failed;
    else last.data = { artifact_hash: "0".repeat(64) };
    await writeFile(path, Buffer.from(`${lines.map((line) => JSON.stringify(line)).join("\n")}\n`));
    return;
  }
  const manifest = ArtifactManifestSchema.parse(
    JSON.parse((await readFile(manifestPath)).toString()),
  );
  if (mutation === ArtifactMutation.Hash) manifest.hash = "0".repeat(64);
  if (mutation === ArtifactMutation.MissingPath) manifest.paths = ["source.txt"];
  if (mutation === ArtifactMutation.DuplicatePath) manifest.paths.push("source.txt");
  if (mutation === ArtifactMutation.ContentAndManifest) {
    await writeFile(source, Buffer.from("tampered"));
    manifest.hash = await treeHash(await readTree(directory, run.config.value.limits));
  }
  if (mutation === ArtifactMutation.Paths) manifest.paths = ["../outside"];
  if (mutation === ArtifactMutation.Outputs || mutation === ArtifactMutation.OutputsAndResult)
    manifest.outputs = { replacement: "unverified" };
  if (mutation === ArtifactMutation.OutputsAndResult)
    await writeFile(
      result,
      Buffer.from(resultDocument(run.plan.workflow.name, run.plan.workflow.goal, manifest.outputs)),
    );
  await writeFile(manifestPath, Buffer.from(JSON.stringify(manifest)));
}

export async function artifactReview(
  mutation: ArtifactMutation,
  executable = false,
  extraPath = "added.txt",
) {
  return withArtifactRun(
    executable,
    async (run) => {
      await mutateArtifacts(run, mutation);
      const result = await inspectArtifacts(run);
      return {
        paths: result.files.map((file) => file.path),
        bytes: result.files.map((file) => file.bytes),
        executable: result.files.map((file) => file.executable),
        contentHashes: result.files.map((file) => file.hash),
        stableIds: result.files.every((file) => file.id === hash(file.path)),
        workflowIdentity:
          result.workflow_id === run.workflow_id &&
          result.workflow_revision === run.workflow_revision,
        originalPreserved: (await readFile(resolve(run.project, "source.txt"))).equals(
          Buffer.from("original"),
        ),
      };
    },
    extraPath,
  );
}

export async function artifactInspection(
  transport: ArtifactInspectionTransport,
  mutation: ArtifactMutation,
  executable = false,
) {
  return withArtifactRun(executable, async (run, home) => {
    await mutateArtifacts(run, mutation);
    const rejected = mutation !== ArtifactMutation.None;
    let value: unknown;
    if (transport === ArtifactInspectionTransport.Http) {
      const address = await readAddress(home);
      const response = await fetch(`${address.url}/runs/${run.run_id}/artifacts`, {
        headers: { authorization: `Bearer ${address.token}` },
      });
      value = await response.json();
      assert.equal(response.status, rejected ? 400 : 200);
    } else if (transport === ArtifactInspectionTransport.Cli) {
      return inspectCliArtifact(run, home, rejected);
    } else {
      value = await readArtifactTool(home, run.run_id, rejected);
    }
    if (rejected) {
      assert.equal(ServerErrorSchema.parse(value).code, ErrorCode.ArtifactInvalid);
      return true;
    }
    assert.deepEqual(ArtifactInspectionSchema.parse(value), await inspectArtifacts(run));
    return true;
  });
}

export async function artifactResponseAdmission(value: unknown) {
  return withClientResponse(
    Response.json(value),
    async (client) => (await client.artifacts("delivery")).files.length,
  );
}

export async function artifactResultRecord(mode: ArtifactResultFixture): Promise<boolean> {
  return withArtifactRun(mode === ArtifactResultFixture.LegacyExecutable, async (run) => {
    const manifestPath = resolve(run.root, RunArtifactFile.Manifest);
    const resultPath = resolve(run.root, RunArtifactFile.Result);
    const manifest = ArtifactManifestSchema.parse(
      JSON.parse((await readFileBytes(manifestPath, IoLimit.DataBytes)).toString()),
    );
    if (mode === ArtifactResultFixture.Attempts) {
      const document = (await readFileBytes(resultPath, BoardLimit.RecordBytes)).toString();
      const summary = RunResultSchema.parse(
        JSON.parse(document.slice(document.indexOf("{"), document.lastIndexOf("}") + 1)),
      );
      const first = Object.values(summary.steps)[0];
      assert.ok(first);
      first.attempt += 1;
      await writeFile(
        resultPath,
        Buffer.from(
          `${RunnerMessage.PassedResultPrefix}${JSON.stringify(summary)}${RunnerMessage.FailedResultSuffix}`,
        ),
      );
    } else {
      delete manifest.result_format;
      await writeFile(manifestPath, Buffer.from(JSON.stringify(manifest)));
      await writeFile(
        resultPath,
        Buffer.from(
          resultDocument(run.plan.workflow.name, run.plan.workflow.goal, manifest.outputs),
        ),
      );
    }
    if (mode === ArtifactResultFixture.Downgrade || mode === ArtifactResultFixture.Attempts) {
      await assert.rejects(() => inspectArtifacts(run), { code: ErrorCode.ArtifactInvalid });
      return true;
    }
    const journal = resolve(run.root, BoardFile.Journal);
    const records = (await readFileBytes(journal, BoardLimit.RecordBytes))
      .toString()
      .trim()
      .split("\n")
      .map((line) => RunEventSchema.parse(JSON.parse(line)));
    const committed = records.find((event) => event.type === RunEventKind.Passed);
    assert.ok(committed);
    assert.ok(committed.data && typeof committed.data === "object");
    Reflect.deleteProperty(committed.data, "result_format");
    await writeFile(
      journal,
      Buffer.from(`${records.map((event) => JSON.stringify(event)).join("\n")}\n`),
    );
    const inspected = await inspectArtifacts(run);
    assert.equal(inspected.run_id, run.run_id);
    return true;
  });
}

async function readArtifactTool(home: string, runId: string, rejected: boolean): Promise<unknown> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const mcp = await startMcp(home, serverTransport);
  const client = new Client({ name: "artifact-fixture", version: "1" });
  try {
    await client.connect(clientTransport);
    const answer = await client.callTool({
      name: McpIdentity.Artifacts,
      arguments: { run_id: runId },
    });
    assert.equal(answer.isError === true, rejected);
    const content = McpTextContentSchema.parse(answer.content)[0];
    assert.ok(content);
    return JSON.parse(content.text);
  } finally {
    await client.close();
    await mcp.close();
  }
}

async function inspectCliArtifact(run: Run, home: string, rejected: boolean): Promise<boolean> {
  const output: unknown[] = [];
  const main = createCli({ ...defaultServices, output: (item) => output.push(item) });
  const error = await thrownBy(async () => {
    assert.equal(await main(["artifacts", run.run_id, "--home", home, "--json"]), 0);
  });
  if (rejected) {
    assert.equal(Reflect.get(Object(error), "code"), ErrorCode.ArtifactInvalid);
    return true;
  }
  assert.equal(error, undefined);
  assert.deepEqual(ArtifactInspectionSchema.parse(output[0]), await inspectArtifacts(run));
  return true;
}
