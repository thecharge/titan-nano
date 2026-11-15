import { strict as assert } from "node:assert";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  ApprovalLevel,
  Backend,
  CliCommand,
  ExecutionPhase,
  IoLimit,
  McpIdentity,
  RequestDecision,
  RequestKind,
  RunAction,
  RunEventKind,
  SdkDelivery,
  VendorFixture,
} from "@titan/constants";
import { all } from "@titan/core";
import { createRunClient } from "@titan/server/client";
import { createRequestClient } from "@titan/server/requests";
import { readFileBytes } from "@titan/streams";
import { waitUntil } from "@titan/test-framework";
import {
  type BackendId,
  McpTextContentSchema,
  type Run,
  RunSchema,
  VendorSessionEventSchema,
} from "@titan/types";
import { exists } from "@titan/workspace";
import { withStdioMcp } from "./mcp.ts";

export async function duplicateRequestContinuation(
  run: Run,
  step: string,
  phase: string,
  home: string,
  cli: string,
  backend: BackendId,
) {
  const work = run.nodes[step]?.work;
  const session = run.nodes[step]?.phases[phase]?.session_id;
  assert.ok(work && session);
  const cwd = phase === ExecutionPhase.Worker ? work : resolve(work, "..", "review-0");
  const directory = resolve(cwd, VendorFixture.StateDirectory);
  const entered = resolve(directory, VendorFixture.ResumeEntered);
  const release = resolve(directory, VendorFixture.ResumeRelease);
  await writeFile(resolve(directory, VendorFixture.ResumeHold), Buffer.alloc(0));
  const client = createRunClient(home);
  try {
    await client.control(run.run_id, RunAction.Resume);
    assert.ok(
      await waitUntil(
        () => exists(entered),
        SdkDelivery.SettleAttempts,
        SdkDelivery.PollMilliseconds,
      ),
    );
    assert.deepEqual(await readFileBytes(entered, IoLimit.DataBytes), Buffer.from(session));
    if (backend === Backend.Claude)
      assert.ok(
        await waitUntil(
          async () => {
            const current = RunSchema.parse(await client.get(run.run_id));
            const execution = current.nodes[step]?.phases[phase]?.execution_id;
            const page = await client.events(run.run_id);
            return page.events.some((event) => {
              if (event.type !== RunEventKind.AgentEvent) return false;
              const parsed = VendorSessionEventSchema.safeParse(event.data);
              return (
                parsed.success &&
                parsed.data.execution_id === execution &&
                parsed.data.phase === phase &&
                parsed.data.session_id === session
              );
            });
          },
          SdkDelivery.SettleAttempts,
          SdkDelivery.PollMilliseconds,
        ),
      );
    const held = RunSchema.parse(await client.get(run.run_id));
    const usage = await client.usage(run.run_id);
    assert.equal(usage.unreported_executions, 1);
    const compareReplies = (replies: readonly unknown[]): void => {
      for (const reply of replies) assert.deepEqual(RunSchema.parse(reply), held);
    };
    await withStdioMcp(process.execPath, [cli, CliCommand.Mcp, "--home", home], async (mcp) => {
      const replies = await all([
        () => client.control(run.run_id, RunAction.Resume),
        async () => {
          const reply = await mcp.callTool({
            name: `${McpIdentity.Prefix}${CliCommand.Resume}`,
            arguments: { run_id: run.run_id },
          });
          assert.ok(!reply.isError);
          const content = McpTextContentSchema.parse(reply.content)[0];
          assert.ok(content);
          return RunSchema.parse(JSON.parse(content.text));
        },
      ]);
      compareReplies(replies);
    });
    assert.deepEqual(await client.get(run.run_id), held);
    assert.deepEqual(await client.usage(run.run_id), usage);
    const node = held.nodes[step];
    const execution = node?.phases[phase]?.execution_id;
    assert.ok(node && execution);
    const requests = createRequestClient(home);
    const content_hashes = {};
    const originExecution = {
      step_id: step,
      attempt: node.attempt,
      phase,
      execution_id: execution,
    };
    const observer = await requests.open(run.run_id, {
      request_id: `${step}-${phase}-active-resume`,
      kind: RequestKind.Resource,
      scope: {
        operation: "read",
        resource: "reference",
        content_hashes,
        arguments: [],
        environment_names: [],
      },
      origin: {
        client_id: held.client_id,
        harness_session_id: session,
        execution: originExecution,
      },
      expires_at: Date.now() + 60000,
    });
    await requests.answer(
      {
        run_id: run.run_id,
        request_id: observer.request_id,
        version: observer.version,
        client_id: "parallel-reviewer",
        decision: RequestDecision.Deny,
        reason: "Reviewed duplicate continuation origin",
      },
      ApprovalLevel.Main,
    );
  } finally {
    await writeFile(release, Buffer.alloc(0));
  }
}
