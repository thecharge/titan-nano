import { strict as assert } from "node:assert";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  ConfigFile,
  ErrorCode,
  KnowledgeAttemptState,
  KnowledgeTool,
  NativeToolAudit,
  NativeToolOutcome,
  RunFormat,
  RunStatus,
  SdkProcessFixture,
  VendorStubMode,
  WorkspaceModeSetting,
} from "@titan/constants";
import { uuidFromText } from "@titan/core";
import { KnowledgeHub, projectHubHome } from "@titan/knowledge";
import { runKnowledgeScope } from "@titan/runner";
import { createRunClient } from "@titan/server/client";
import { createKnowledgeClient } from "@titan/server/knowledge";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  ConfigSchema,
  type NativeBackendId,
  NativeFileListingSchema,
  NativeFileObservationSchema,
  NativeToolBoardSchema,
  RunSchema,
  type SdkProbePaths,
} from "@titan/types";
import { prepareSdkProject } from "./sdk-process.ts";
import { serverReady, spawnServer } from "./server-process.ts";

export async function nativeProjectWrite(
  backend: NativeBackendId,
  refused: boolean,
  paths: SdkProbePaths = {},
) {
  return withTemporaryDirectory(async (root) => {
    const { home, project } = await prepareSdkProject(root, backend, 0, false, paths.vendors);
    const file = resolve(home, ConfigFile.User);
    const config = ConfigSchema.parse(JSON.parse((await readFile(file)).toString()));
    config.workspace = { ...config.workspace, mode: WorkspaceModeSetting.Live };
    config.defaults.max_attempts = 1;
    await writeFile(file, Buffer.from(JSON.stringify(config)));
    const child = spawnServer(home, paths.cli, SdkProcessFixture.DaemonTimeout);
    try {
      assert.ok(
        await waitUntil(() => serverReady(home, child.pid), SdkProcessFixture.ObserveAttempts),
      );
      const mode = refused
        ? VendorStubMode.NativeProjectRefused
        : VendorStubMode.NativeProjectWrite;
      const workflow = vendorRecoveryWorkflow(mode);
      for (const step of workflow.steps) step.do.task = mode;
      const client = createRunClient(home);
      const submitted = await client.submit({
        project,
        workflow,
        backend,
        client_id: "native-project-write",
        submission_id: "project",
      });
      assert.ok(
        await waitUntil(async () => {
          const state = (await client.get(submitted.run_id)).state;
          return (
            state === RunStatus.Passed || state === RunStatus.Failed || state === RunStatus.Blocked
          );
        }, SdkProcessFixture.ObserveAttempts),
      );
      const run = RunSchema.parse(await client.get(submitted.run_id));
      assert.equal(
        run.state,
        refused ? RunStatus.Failed : RunStatus.Passed,
        JSON.stringify(run.nodes),
      );
      assert.equal(
        run.schema_version,
        run.runtime_build ? RunFormat.PinnedBuild : RunFormat.PersonaBindings,
      );
      for (const phase of Object.values(run.nodes.deliver?.phases ?? {})) {
        assert.equal(phase.file_reads?.length, 3);
        assert.equal(NativeFileObservationSchema.parse(phase.file_reads[0]).path, "source.txt");
        assert.equal(NativeFileObservationSchema.parse(phase.file_reads[1]).version, null);
        assert.equal(
          NativeFileListingSchema.parse(phase.file_reads[2]).files.includes("source.txt"),
          true,
        );
      }
      const id = uuidFromText(JSON.stringify([run.run_id, "deliver", "native-project"]));
      await assert.rejects(() => createKnowledgeClient(home).get(id), {
        code: ErrorCode.KnowledgeMissing,
      });
      let added = false;
      let checkerRefused = false;
      let after = 0;
      while (after < run.version) {
        const page = await client.events(run.run_id, { after });
        assert.ok(page.events.length);
        for (const event of page.events) {
          if (event.type !== NativeToolAudit.Kind) continue;
          const record = NativeToolBoardSchema.parse(event.data);
          added ||= record.tool === KnowledgeTool.Add && record.entry_ids.includes(id);
          checkerRefused ||=
            record.tool === KnowledgeTool.Get && record.outcome === NativeToolOutcome.Refused;
        }
        after = page.next_cursor;
      }
      assert.equal(added, true);
      assert.equal(checkerRefused, true);
      child.kill("SIGTERM");
      await child.exited;
      const hub = await KnowledgeHub.open(projectHubHome(project));
      try {
        const step = run.plan.nodes[0];
        assert.ok(step);
        const state = run.nodes[step.id];
        assert.ok(state);
        const attempt = await hub.attempts.read(runKnowledgeScope(run, step, state));
        assert.equal(
          attempt?.state,
          refused ? KnowledgeAttemptState.Discarded : KnowledgeAttemptState.Published,
        );
        if (refused) await assert.rejects(() => hub.get(id), { code: ErrorCode.KnowledgeMissing });
        else assert.equal((await hub.get(id)).entry.id, id);
      } finally {
        await hub.close();
      }
      return true;
    } finally {
      if (child.exitCode === null) child.kill("SIGTERM");
      await child.exited;
    }
  });
}
