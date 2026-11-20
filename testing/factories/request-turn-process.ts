import { strict as assert } from "node:assert";
import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  ApprovalLevel,
  CliCommand,
  ExecutionPhase,
  ExitCode,
  McpIdentity,
  NativeTool,
  OperationWebRead,
  RequestDecision,
  RequestEscalationSurface,
  RequestProjection,
  RunFormat,
  RunStatus,
  SdkProcessFixture,
  StepStatus,
} from "@titan/constants";
import { call } from "@titan/server";
import { createRunClient } from "@titan/server/client";
import { createRequestClient } from "@titan/server/requests";
import { vendorRecoveryWorkflow } from "@titan/test-factories";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  type BackendId,
  McpRequestResultSchema,
  McpTextContentSchema,
  NativeToolBoardSchema,
  ObjectSchema,
  type OperationRequest,
  OperationRequestSchema,
  RunSchema,
  type SdkProbePaths,
} from "@titan/types";
import { runCliCommand, stopCommand } from "../support/command.ts";
import { withStdioMcp } from "../support/mcp.ts";
import { projectionMatches } from "../support/request-projection.ts";
import { prepareSdkProject } from "./sdk-process.ts";
import { serverReady, spawnServer } from "./server-process.ts";

export async function requestTurnProcess(
  backend: BackendId,
  checker: boolean,
  crash: boolean,
  pending: boolean,
  surface: RequestEscalationSurface,
  web: boolean,
  paths: SdkProbePaths = {},
) {
  return withTemporaryDirectory((root) =>
    requestTurnProcessAtRoot(root, backend, checker, crash, pending, surface, web, paths),
  );
}

async function requestTurnProcessAtRoot(
  root: string,
  ...args: Parameters<typeof requestTurnProcess>
) {
  const [backend, checker, crash, pending, surface, web, paths = {}] = args;
  const { home, project } = await prepareSdkProject(root, backend, 0, false, paths.vendors);
  const cli = paths.cli ?? resolve("apps/cli/src/main.ts");
  const children: ReturnType<typeof spawnServer>[] = [];
  const key = checker ? `${ExecutionPhase.FalsifierPrefix}0` : ExecutionPhase.Worker;
  try {
    const first = spawnServer(home, cli, SdkProcessFixture.DaemonTimeout);
    children.push(first);
    assert.ok(
      await waitUntil(() => serverReady(home, first.pid), SdkProcessFixture.ObserveAttempts),
    );
    const workflow = vendorRecoveryWorkflow("complete");
    for (const persona of Object.values(workflow.personas))
      Object.assign(persona, { request_turns: true });
    const target = workflow.steps[0];
    assert.ok(target?.falsify[0]);
    if (checker) target.falsify[0].task = "request_turn";
    else target.do.task = web ? "request_turn_web" : "request_turn";
    const path = resolve(project, "request-turn.json");
    await writeFile(path, Buffer.from(JSON.stringify(workflow)));
    const waiting = RunSchema.parse(
      await runCliCommand(
        cli,
        home,
        [
          CliCommand.Run,
          path,
          "--project",
          project,
          "--backend",
          backend,
          "--harness-session-id",
          "outer-process-caller",
          "--watch",
        ],
        ExitCode.Blocked,
      ),
    );
    assert.equal(waiting.state, RunStatus.Waiting);
    assert.equal(waiting.harness_session_id, "outer-process-caller");
    assert.equal(
      waiting.schema_version,
      waiting.runtime_build ? RunFormat.PinnedBuild : RunFormat.PersonaBindings,
    );
    assert.equal(waiting.nodes.deliver?.state, StepStatus.Waiting);
    const phase = waiting.nodes.deliver?.phases[key];
    assert.ok(phase?.session_id);
    assert.equal(phase.executions, 1);
    assert.equal(phase.retries, 0);
    const requests = createRequestClient(home);
    const page = await requests.list({ run_id: waiting.run_id });
    const request = page.requests[0]?.request;
    assert.ok(request);
    assert.equal(page.requests.length, 1);
    assert.equal(request.origin.harness_session_id, phase.session_id);
    assert.notEqual(phase.session_id, waiting.harness_session_id);
    await projectionMatches(waiting, [request]);
    first.kill(crash ? "SIGKILL" : "SIGTERM");
    await first.exited;
    const projection = resolve(waiting.root, RequestProjection.File);
    if (crash) await writeFile(projection, Buffer.from("stale malformed projection"));
    else await rm(projection);
    const second = spawnServer(home, cli, SdkProcessFixture.DaemonTimeout);
    children.push(second);
    assert.ok(
      await waitUntil(() => serverReady(home, second.pid), SdkProcessFixture.ObserveAttempts),
    );
    assert.deepEqual(await requests.get(waiting.run_id, request.request_id), request);
    await projectionMatches(waiting, [request]);
    if (pending) {
      const unchanged = RunSchema.parse(
        await runCliCommand(
          cli,
          home,
          [CliCommand.Resume, waiting.run_id, "--watch"],
          ExitCode.Blocked,
        ),
      );
      assert.equal(unchanged.state, RunStatus.Waiting);
      assert.equal(unchanged.harness_session_id, waiting.harness_session_id);
      assert.equal(unchanged.schema_version, waiting.schema_version);
      assert.equal(unchanged.nodes.deliver?.phases[key]?.executions, 1);
      assert.equal(unchanged.nodes.deliver?.phases[key]?.session_id, phase.session_id);
      assert.deepEqual(await requests.get(waiting.run_id, request.request_id), request);
    }
    const input = {
      run_id: waiting.run_id,
      request_id: request.request_id,
      version: request.version,
      client_id: "turn-reviewer",
      reason: "Reviewed request turn",
      decision: crash ? RequestDecision.Deny : RequestDecision.Approve,
    };
    let answered: OperationRequest;
    if (surface === RequestEscalationSurface.Http)
      answered = await requests.answer(input, ApprovalLevel.Main);
    else if (surface === RequestEscalationSurface.Cli)
      answered = OperationRequestSchema.parse(
        await runCliCommand(
          cli,
          home,
          [
            CliCommand.Answer,
            input.run_id,
            input.request_id,
            input.decision,
            "--request-version",
            String(input.version),
            "--client-id",
            input.client_id,
            "--reason",
            input.reason,
          ],
          ExitCode.Success,
        ),
      );
    else
      answered = await withStdioMcp(
        process.execPath,
        [cli, CliCommand.Mcp, "--home", home],
        async (client) => {
          const result = await client.callTool({
            name: McpIdentity.RequestAnswer,
            arguments: input,
          });
          assert.ok(!result.isError);
          return McpRequestResultSchema.parse(
            JSON.parse(McpTextContentSchema.parse(result.content)[0]?.text ?? ""),
          ).request;
        },
      );
    assert.deepEqual(answered, await requests.get(waiting.run_id, request.request_id));
    assert.equal(answered.answer?.decision, input.decision);
    await projectionMatches(waiting, []);
    const after = RunSchema.parse(
      await runCliCommand(
        cli,
        home,
        [CliCommand.Resume, waiting.run_id, "--watch"],
        ExitCode.Success,
      ),
    );
    assert.equal(after.state, RunStatus.Passed);
    assert.equal(after.harness_session_id, waiting.harness_session_id);
    assert.equal(
      after.schema_version,
      after.runtime_build ? RunFormat.PinnedBuild : RunFormat.PersonaBindings,
    );
    const node = after.nodes.deliver;
    assert.equal(node?.phases[key]?.session_id, phase.session_id);
    assert.equal(node?.phases[key]?.executions, 2);
    assert.equal(node?.phases[key]?.retries, 0);
    assert.equal(node?.attempt, 1);
    assert.deepEqual(node?.evidence, []);
    assert.ok(after.artifacts);
    assert.equal(
      await readFile(resolve(after.artifacts, "DELIVERED.txt"), "utf8"),
      "Delivered by SDK stub",
    );
    assert.equal(
      await readFile(resolve(project, "source.txt"), "utf8"),
      "Original project content",
    );
    assert.deepEqual(await requests.get(waiting.run_id, request.request_id), answered);
    assert.equal(
      RunSchema.parse(await call(home, `/runs/${waiting.run_id}`)).state,
      RunStatus.Passed,
    );
    if (web) {
      assert.equal(request.scope.operation, OperationWebRead);
      const events = await createRunClient(home).events(after.run_id, { limit: 1000 });
      const acquisitions = events.events.filter((event) => {
        if (event.type !== "tool") return false;
        const record = NativeToolBoardSchema.safeParse(event.data);
        return record.success && record.data.tool === NativeTool.ReadWeb && record.data.web;
      });
      assert.equal(acquisitions.length, crash ? 0 : 1);
      if (!crash) {
        const event = acquisitions[0];
        assert.ok(event);
        const record = NativeToolBoardSchema.parse(event.data);
        assert.equal(record.web?.request_id, request.request_id);
        assert.equal(record.web?.requested, request.scope.resource);
        assert.match(record.web?.error ?? "", /public addresses/);
      }

      const url = request.scope.resource;
      const read = [CliCommand.WebRead, after.run_id, url];
      const pendingCli = ObjectSchema.parse(await runCliCommand(cli, home, read, ExitCode.Success));
      const cliRequest = OperationRequestSchema.parse(pendingCli.request);
      assert.notEqual(cliRequest.request_id, request.request_id);
      assert.equal(cliRequest.origin.execution, undefined);
      await requests.answer(
        {
          ...input,
          request_id: cliRequest.request_id,
          version: cliRequest.version,
        },
        ApprovalLevel.Main,
      );
      const cliResult = ObjectSchema.parse(
        await runCliCommand(cli, home, [...read, cliRequest.request_id], ExitCode.Success),
      );
      if (crash) {
        assert.equal(
          OperationRequestSchema.parse(cliResult.request).answer?.decision,
          RequestDecision.Deny,
        );
      } else {
        assert.equal(cliResult.request_id, cliRequest.request_id);
        assert.match(String(cliResult.error), /public addresses/);
      }
    }
    return true;
  } finally {
    for (const child of children) await stopCommand(child);
  }
}
