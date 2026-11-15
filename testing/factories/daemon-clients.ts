import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DaemonClientFixture, DaemonStartup, ExitCode } from "@titan/constants";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { exists } from "@titan/workspace";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { probeDaemon } from "../../apps/cli/src/daemon.ts";
import { stopOwnedDaemon } from "../support/daemon.ts";

async function clientOperation(home: string, mode: DaemonClientFixture): Promise<void> {
  if (mode === DaemonClientFixture.Runs) {
    assert.deepEqual((await defaultServices.client(home).list()).runs, []);
    return;
  }
  if (mode === DaemonClientFixture.Requests) {
    assert.deepEqual((await defaultServices.requests(home).list()).requests, []);
    return;
  }
  if (mode === DaemonClientFixture.Knowledge) {
    await defaultServices.knowledge(home).reindex();
    return;
  }
  if (mode === DaemonClientFixture.Mcp) {
    const server = await defaultServices.mcp(home);
    assert.ok(server instanceof McpServer);
    await server.close();
    return;
  }
  if (mode === DaemonClientFixture.EmptyKnowledge)
    return void (await defaultServices.knowledge(home).get(""));
  if (mode === DaemonClientFixture.UnsafeKnowledge)
    return void (await defaultServices.knowledge(home).get("../escape"));
  if (mode === DaemonClientFixture.UnsafeRun)
    return void (await defaultServices.requests(home).get("../escape", "request"));
  return void (await defaultServices.requests(home).get("run", "../escape"));
}

export async function daemonClients(mode: DaemonClientFixture, invalid: boolean) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    try {
      await assertClientOperation(home, mode, invalid);
      return true;
    } finally {
      await stopOwnedDaemon(home);
    }
  });
}

async function assertClientOperation(home: string, mode: DaemonClientFixture, invalid: boolean) {
  if (invalid) {
    await assert.rejects(clientOperation(home, mode), { exitCode: ExitCode.Input });
    assert.equal(await exists(home), false);
    return;
  }
  await clientOperation(home, mode);
  assert.ok(await probeDaemon(home, DaemonStartup.ProbeMilliseconds));
}
