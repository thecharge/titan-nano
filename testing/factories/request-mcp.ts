import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  ApprovalLevel,
  CliCommand,
  CliOption,
  ErrorCode,
  McpIdentity,
  RequestDecision,
  RequestKind,
  RequestMcpFixture,
  RequestState,
  RequestVersion,
} from "@titan/constants";
import { startMcp } from "@titan/server/mcp";
import { createRequestClient } from "@titan/server/requests";
import {
  McpRequestResultSchema,
  McpTextContentSchema,
  type OperationRequest,
  type Run,
} from "@titan/types";
import { withStdioMcp } from "../support/mcp.ts";
import { withArtifactRun } from "./artifacts.ts";

export async function requestMcp(mode: RequestMcpFixture) {
  const inspect = async (run: Run, home: string) => {
    const [left, right] = InMemoryTransport.createLinkedPair();
    let server = await startMcp(home, left);
    let client = new Client({ name: "request-fixture", version: "1" });
    const requests = createRequestClient(home);
    try {
      await client.connect(right);
      const tools = (await client.listTools()).tools.map((tool) => tool.name);
      for (const name of [
        McpIdentity.RequestOpen,
        McpIdentity.RequestRead,
        McpIdentity.RequestAnswer,
      ])
        assert.ok(tools.includes(name));
      const content_hashes = {};
      const input = {
        request_id: "permission",
        kind:
          mode === RequestMcpFixture.OpenHuman || mode === RequestMcpFixture.HumanAnswer
            ? RequestKind.Action
            : RequestKind.Tool,
        scope: {
          operation: "start",
          resource: "candidate",
          content_hashes,
          arguments: [],
          environment_names: [],
        },
        origin: { client_id: "origin", harness_session_id: "session" },
        expires_at: Date.now() + 60000,
      };
      let opened: OperationRequest | null = null;
      const retry = mode === RequestMcpFixture.Retry || mode === RequestMcpFixture.AnsweredRetry;
      const opening =
        retry ||
        [
          RequestMcpFixture.OpenTool,
          RequestMcpFixture.OpenHuman,
          RequestMcpFixture.InvalidScope,
        ].includes(mode);
      if (!opening || retry) opened = await requests.open(run.run_id, input);
      if (mode === RequestMcpFixture.AnsweredRetry) {
        await requests.answer(
          {
            run_id: run.run_id,
            request_id: input.request_id,
            version: RequestVersion.Open,
            decision: RequestDecision.Approve,
            reason: "Reviewed exact scope",
            client_id: "reviewer",
          },
          ApprovalLevel.Main,
        );
      }
      let name: string = McpIdentity.RequestAnswer;
      let args: Record<string, unknown> = {
        run_id: run.run_id,
        request_id: input.request_id,
        version: RequestVersion.Open,
        decision: mode === RequestMcpFixture.Deny ? RequestDecision.Deny : RequestDecision.Approve,
        reason: "Reviewed exact scope",
        client_id: "reviewer",
      };
      if (opening) {
        name = McpIdentity.RequestOpen;
        args = { run_id: run.run_id, input };
      }
      if (mode === RequestMcpFixture.InvalidScope) args.input = { ...input, scope: {} };
      if (mode === RequestMcpFixture.Read || mode === RequestMcpFixture.Missing) {
        name = McpIdentity.RequestRead;
        args = {
          run_id: run.run_id,
          request_id: mode === RequestMcpFixture.Missing ? "missing" : input.request_id,
        };
      }
      if (mode === RequestMcpFixture.ForgedAuthority) args.authority = ApprovalLevel.Human;
      if (mode === RequestMcpFixture.Stale) args.version = RequestVersion.Answered;
      if (mode === RequestMcpFixture.MissingReason) delete args.reason;
      if (mode === RequestMcpFixture.WrongRun) args.run_id = "other-run";
      if (mode === RequestMcpFixture.Repeated) {
        const first = await client.callTool({ name, arguments: args });
        assert.notEqual(first.isError, true);
        opened = McpRequestResultSchema.parse(
          JSON.parse(McpTextContentSchema.parse(first.content)[0]?.text ?? ""),
        ).request;
      }
      if (mode === RequestMcpFixture.Restart) {
        await client.close();
        await server.close();
        const [nextLeft, nextRight] = InMemoryTransport.createLinkedPair();
        server = await startMcp(home, nextLeft);
        client = new Client({ name: "request-reloaded", version: "1" });
        await client.connect(nextRight);
      }
      const response = [
        RequestMcpFixture.Read,
        RequestMcpFixture.Approve,
        RequestMcpFixture.HumanAnswer,
        RequestMcpFixture.Stale,
      ].includes(mode)
        ? await withStdioMcp(
            process.execPath,
            [resolve("apps/cli/src/main.ts"), CliCommand.Mcp, `--${CliOption.Home}`, home],
            async (stdio) => stdio.callTool({ name, arguments: args }),
          )
        : await client.callTool({ name, arguments: args });
      const negative = [
        RequestMcpFixture.HumanAnswer,
        RequestMcpFixture.ForgedAuthority,
        RequestMcpFixture.Stale,
        RequestMcpFixture.Repeated,
        RequestMcpFixture.MissingReason,
        RequestMcpFixture.WrongRun,
        RequestMcpFixture.InvalidScope,
        RequestMcpFixture.Missing,
      ].includes(mode);
      assert.equal(response.isError === true, negative);
      const verifyRefusal = async (): Promise<void> => {
        if (mode === RequestMcpFixture.InvalidScope)
          await assert.rejects(requests.get(run.run_id, input.request_id));
        else assert.deepEqual(await requests.get(run.run_id, input.request_id), opened);
        if (
          [
            RequestMcpFixture.HumanAnswer,
            RequestMcpFixture.Stale,
            RequestMcpFixture.Repeated,
            RequestMcpFixture.Missing,
          ].includes(mode)
        ) {
          const failure = JSON.parse(McpTextContentSchema.parse(response.content)[0]?.text ?? "");
          assert.equal(
            failure.code,
            mode === RequestMcpFixture.HumanAnswer
              ? ErrorCode.PermissionDenied
              : mode === RequestMcpFixture.Missing
                ? ErrorCode.RequestNotFound
                : ErrorCode.RequestConflict,
          );
        }
      };
      if (negative) {
        await verifyRefusal();
        return true;
      }
      const payload = McpRequestResultSchema.parse(
        JSON.parse(McpTextContentSchema.parse(response.content)[0]?.text ?? ""),
      );
      const observed = payload.request;
      const waiting =
        (opening && mode !== RequestMcpFixture.AnsweredRetry) || mode === RequestMcpFixture.Read;
      assert.equal(payload.state, waiting ? RequestState.Waiting : RequestState.Answered);
      assert.deepEqual(await requests.get(run.run_id, input.request_id), observed);
      assert.equal(observed.run_id, run.run_id);
      assert.deepEqual(observed.origin, input.origin);
      assert.deepEqual(observed.scope, input.scope);
      if (waiting) assert.equal(observed.answer, null);
      else {
        assert.equal(
          observed.answer?.decision,
          mode === RequestMcpFixture.Deny ? RequestDecision.Deny : RequestDecision.Approve,
        );
        assert.equal(observed.answer?.actor.authority, ApprovalLevel.Main);
        assert.equal(observed.answer?.actor.client_id, "reviewer");
      }
      return true;
    } finally {
      await client.close();
      await server.close();
    }
  };
  return withArtifactRun(false, inspect);
}
