import { strict as assert } from "node:assert";
import { chmod, rename, rm, symlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { parseArtifactSearch, readArtifact, readArtifactBytes } from "@titan/artifacts";
import {
  ArtifactContentMutation,
  ArtifactInspectionTransport,
  ArtifactMutation,
  FileEncoding,
  McpIdentity,
  WorkspaceMode,
} from "@titan/constants";
import { hash } from "@titan/core";
import { createRunClient, readAddress } from "@titan/server/client";
import { startMcp } from "@titan/server/mcp";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  ArtifactInspectionSchema,
  ArtifactPageSchema,
  type ArtifactQueryInput,
  McpTextContentSchema,
} from "@titan/types";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { withClientResponse } from "../support/client.ts";
import { mutateArtifacts, withArtifactRun } from "./artifacts.ts";

export async function artifactByteRange(
  content: Buffer,
  query: ArtifactQueryInput,
  mutation = ArtifactContentMutation.None,
) {
  return withTemporaryDirectory(async (root) => {
    const source = resolve(root, "file");
    await writeFile(source, content);
    const file = { source, hash: hash(content), bytes: content.length, executable: false };
    if (mutation === ArtifactContentMutation.Hash) file.hash = hash("wrong");
    if (mutation === ArtifactContentMutation.Short) file.bytes++;
    if (mutation === ArtifactContentMutation.Grown) file.bytes--;
    if (mutation === ArtifactContentMutation.Mode)
      await chmod(source, WorkspaceMode.PrivateExecutable);
    if (mutation === ArtifactContentMutation.Link) {
      await rename(source, resolve(root, "kept"));
      await symlink(resolve(root, "kept"), source);
    }
    if (mutation === ArtifactContentMutation.Missing) await rm(source);
    return readArtifactBytes(file, query);
  });
}

export async function artifactReadReview(
  id: string,
  query: ArtifactQueryInput = {},
  mutation = ArtifactMutation.None,
) {
  return withArtifactRun(false, async (run) => {
    await mutateArtifacts(run, mutation);
    const page = await readArtifact(run, id, query);
    return {
      content: Buffer.from(page.content, FileEncoding.Base64),
      offset: page.offset,
      next: page.next_offset,
      more: page.has_more,
      path: page.file.path,
      identity:
        page.run_id === run.run_id &&
        page.workflow_id === run.workflow_id &&
        page.workflow_revision === run.workflow_revision,
    };
  });
}

export async function artifactReadTransport(
  transport: ArtifactInspectionTransport,
  query: ArtifactQueryInput,
  mutation = ArtifactMutation.None,
) {
  return withArtifactRun(false, async (run, home) => {
    await mutateArtifacts(run, mutation);
    const id = hash("source.txt");
    let value: unknown;
    if (transport === ArtifactInspectionTransport.Http)
      value = await createRunClient(home).artifact(run.run_id, id, query);
    else if (transport === ArtifactInspectionTransport.Cli) {
      const output: unknown[] = [];
      const main = createCli({ ...defaultServices, output: (item) => output.push(item) });
      await main([
        "artifacts",
        "show",
        run.run_id,
        id,
        "--home",
        home,
        "--json",
        ...Object.entries(query).flatMap(([key, item]) => [`--${key}`, String(item)]),
      ]);
      value = output[0];
    } else {
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
      const mcp = await startMcp(home, serverTransport);
      const client = new Client({ name: "artifact-page-fixture", version: "1" });
      try {
        await client.connect(clientTransport);
        const response = await client.callTool({
          name: McpIdentity.Artifact,
          arguments: { run_id: run.run_id, artifact_id: id, ...query },
        });
        const content = McpTextContentSchema.parse(response.content)[0];
        assert.ok(content);
        value = JSON.parse(content.text);
        if (response.isError) return value;
      } finally {
        await client.close();
        await mcp.close();
      }
    }
    const page = ArtifactPageSchema.parse(value);
    assert.deepEqual(page, await readArtifact(run, id, query));
    return {
      content: Buffer.from(page.content, FileEncoding.Base64).toString(),
      offset: page.offset,
      next: page.next_offset,
      more: page.has_more,
    };
  });
}

export async function artifactReadResponse(value: unknown, query: ArtifactQueryInput = {}) {
  return withClientResponse(
    Response.json(value),
    async (client) => (await client.artifact("delivery", hash("source.txt"), query)).content,
  );
}

export async function artifactReadSearch(value: unknown) {
  return parseArtifactSearch(value);
}

export async function artifactMcpAdmission(input: Record<string, unknown>) {
  return withArtifactRun(false, async (run, home) => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const mcp = await startMcp(home, serverTransport);
    const client = new Client({ name: "artifact-admission-fixture", version: "1" });
    try {
      await client.connect(clientTransport);
      const response = await client.callTool({
        name: McpIdentity.Artifact,
        arguments: { run_id: run.run_id, artifact_id: hash("source.txt"), ...input },
      });
      return response.isError === true;
    } finally {
      await client.close();
      await mcp.close();
    }
  });
}

export async function artifactListAlias(mutation = ArtifactMutation.None, executable = false) {
  return withArtifactRun(executable, async (run, home) => {
    await mutateArtifacts(run, mutation);
    const output: unknown[] = [];
    const main = createCli({ ...defaultServices, output: (item) => output.push(item) });
    await main(["artifacts", "list", run.run_id, "--home", home, "--json"]);
    return ArtifactInspectionSchema.parse(output[0]).files.map((file) => file.path);
  });
}

export async function artifactReadHttpQuery(query: string, suffix = "artifacts") {
  return withArtifactRun(false, async (run, home) => {
    const address = await readAddress(home);
    const response = await fetch(`${address.url}/runs/${run.run_id}/${suffix}?${query}`, {
      headers: { authorization: `Bearer ${address.token}` },
    });
    const body = await response.json();
    return { status: response.status, code: body.code ?? null };
  });
}
