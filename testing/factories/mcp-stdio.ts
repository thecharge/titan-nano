import { strict as assert } from "node:assert";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  CliCommand,
  CliRuntime,
  HookFile,
  IoLimit,
  McpIdentity,
  McpStdioFixture,
  Newline,
  Packaging,
  ProbeOption,
  ProcessIo,
  RunAction,
  TestProcessLimit,
} from "@titan/constants";
import { startServer } from "@titan/server";
import { readFileBytes } from "@titan/streams";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { McpStdioFrameSchema } from "@titan/types";
import { createFakeBackend } from "../support/backend.ts";
import { stopCommand } from "../support/command.ts";

async function readFrames(file: string, settled = false) {
  const bytes = await readFileBytes(file, IoLimit.DataBytes);
  const end = bytes.lastIndexOf(Newline) + 1;
  if (settled) assert.equal(bytes.length, end);
  const complete = bytes.subarray(0, end).toString();
  const lines = complete.split(Newline).filter(Boolean);
  assert(lines.length <= McpStdioFixture.FrameCount);
  return lines.map((line) => McpStdioFrameSchema.parse(JSON.parse(line)));
}

export async function mcpStdioFrames(
  method: string,
  params: Record<string, unknown>,
  rejected: boolean,
  cli = resolve(import.meta.dir, HookFile.RepositoryRoot, Packaging.CliSource),
): Promise<boolean> {
  return withTemporaryDirectory((root) => observeMcpFrames(root, method, params, rejected, cli));
}

async function observeMcpFrames(
  root: string,
  method: string,
  params: Record<string, unknown>,
  rejected: boolean,
  cli: string,
): Promise<boolean> {
  await using resources = new AsyncDisposableStack();
  const output = resolve(root, "stdout");
  const error = resolve(root, "stderr");
  const home = resolve(root, "home");
  await writeFile(output, Buffer.alloc(0));
  const server = await startServer(home, createFakeBackend);
  resources.defer(() => server.stop());
  const child = Bun.spawn([process.execPath, cli, CliCommand.Mcp, ProbeOption.Home, home], {
    stdin: ProcessIo.Pipe,
    stdout: Bun.file(output),
    stderr: Bun.file(error),
    timeout: TestProcessLimit.DefaultMilliseconds,
  });
  resources.defer(() => stopCommand(child));
  const initialization = {
    protocolVersion: McpStdioFixture.ProtocolVersion,
    capabilities: {},
    clientInfo: { name: McpIdentity.Name, version: McpIdentity.Version },
  };
  const messages = [
    {
      jsonrpc: McpStdioFixture.RpcVersion,
      id: McpStdioFixture.InitializationId,
      method: McpStdioFixture.Initialize,
      params: initialization,
    },
    { jsonrpc: McpStdioFixture.RpcVersion, method: McpStdioFixture.Initialized },
    { jsonrpc: McpStdioFixture.RpcVersion, id: McpStdioFixture.RequestId, method, params },
  ];
  child.stdin.write(JSON.stringify(messages[0]) + Newline);
  await child.stdin.flush();
  assert(
    await waitUntil(
      async () =>
        (await readFrames(output)).some((frame) => frame.id === McpStdioFixture.InitializationId),
      TestProcessLimit.DefaultMilliseconds / CliRuntime.PollMilliseconds,
      CliRuntime.PollMilliseconds,
    ),
  );
  for (const message of messages.slice(1)) child.stdin.write(JSON.stringify(message) + Newline);
  await child.stdin.flush();
  assert(
    await waitUntil(
      async () =>
        (await readFrames(output)).some((frame) => frame.id === McpStdioFixture.RequestId),
      TestProcessLimit.DefaultMilliseconds / CliRuntime.PollMilliseconds,
      CliRuntime.PollMilliseconds,
    ),
  );
  await stopCommand(child);
  assert.equal((await readFileBytes(error, IoLimit.DataBytes)).length, 0);
  const frames = await readFrames(output, true);
  assert.equal(frames.length, McpStdioFixture.FrameCount);
  assert(frames.some((frame) => frame.id === McpStdioFixture.InitializationId && frame.result));
  const response = frames.find((frame) => frame.id === McpStdioFixture.RequestId);
  assert(response);
  assert.equal(Boolean(response.error || response.result?.isError), rejected);
  if (method === McpStdioFixture.ToolsList) {
    const tools = response.result?.tools;
    assert(tools);
    assert(tools.some((tool) => tool.name === McpIdentity.Run));
    assert(tools.some((tool) => tool.name === McpIdentity.Prefix + RunAction.Resume));
  }
  return true;
}
