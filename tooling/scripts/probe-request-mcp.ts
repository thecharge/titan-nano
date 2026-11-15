import { strict as assert } from "node:assert";
import {
  ApprovalLevel,
  CliCommand,
  ErrorCode,
  McpIdentity,
  ProbeOption,
  ProbeRequest,
  RequestDecision,
  RequestKind,
  RequestState,
  RequestVersion,
  TextSymbol,
} from "@titan/constants";
import { createRequestClient } from "@titan/server/requests";
import {
  McpRequestResultSchema,
  McpTextContentSchema,
  type RequestPage,
  RequestPageSchema,
  ServerErrorSchema,
} from "@titan/types";
import { withStdioMcp } from "../../testing/support/mcp.ts";

export async function probeRequestMcp(
  cli: string,
  home: string,
  runId: string,
  resource: string,
): Promise<void> {
  await withStdioMcp(cli, [CliCommand.Mcp, ProbeOption.Home, home], async (client) => {
    const tools = (await client.listTools()).tools.map((tool) => tool.name);
    for (const name of [
      McpIdentity.Requests,
      McpIdentity.RequestOpen,
      McpIdentity.RequestRead,
      McpIdentity.RequestAnswer,
      McpIdentity.RequestEscalate,
    ])
      assert.ok(tools.includes(name));
    const selections = [RequestKind.Tool, RequestKind.Action, RequestKind.Resource].flatMap(
      (kind) =>
        [RequestDecision.Approve, RequestDecision.Deny].map((decision) => ({ kind, decision })),
    );
    const probeDecision = async (kind: RequestKind, decision: RequestDecision): Promise<void> => {
      const content_hashes = {};
      const input = {
        request_id: [McpIdentity.Name, kind, decision].join(ProbeRequest.Separator),
        kind,
        scope: {
          operation: ProbeRequest.Operation,
          resource,
          content_hashes,
          arguments: [],
          environment_names: [],
        },
        origin: { client_id: ProbeRequest.Client, harness_session_id: ProbeRequest.Session },
        expires_at: Date.now() + ProbeRequest.LifetimeMilliseconds,
      };
      const opened = await client.callTool({
        name: McpIdentity.RequestOpen,
        arguments: { run_id: runId, input },
      });
      assert.notEqual(opened.isError, true);
      const pending = McpRequestResultSchema.parse(
        JSON.parse(McpTextContentSchema.parse(opened.content)[0]?.text ?? TextSymbol.Empty),
      );
      assert.equal(pending.state, RequestState.Waiting);
      assert.equal(pending.request.run_id, runId);
      assert.equal(pending.request.request_id, input.request_id);
      const selection = { run_id: runId, request_id: input.request_id };
      const read = await client.callTool({ name: McpIdentity.RequestRead, arguments: selection });
      assert.notEqual(read.isError, true);
      assert.deepEqual(
        McpRequestResultSchema.parse(
          JSON.parse(McpTextContentSchema.parse(read.content)[0]?.text ?? TextSymbol.Empty),
        ),
        pending,
      );
      const answer = {
        ...selection,
        version: pending.request.version,
        decision,
        reason: ProbeRequest.Reason,
        client_id: ProbeRequest.Reviewer,
      };
      if (kind === RequestKind.Resource) {
        const { decision: selectedDecision, ...selection } = answer;
        const response = await client.callTool({
          name: McpIdentity.RequestEscalate,
          arguments: selection,
        });
        assert.notEqual(response.isError, true);
        const raised = McpRequestResultSchema.parse(
          JSON.parse(McpTextContentSchema.parse(response.content)[0]?.text ?? TextSymbol.Empty),
        );
        assert.equal(raised.state, RequestState.Waiting);
        assert.equal(raised.request.version, RequestVersion.Escalated);
        assert.equal(raised.request.level, ApprovalLevel.Human);
        assert.deepEqual(raised.request.scope, pending.request.scope);
        const input = { ...answer, version: raised.request.version, decision: selectedDecision };
        const refused = await client.callTool({
          name: McpIdentity.RequestAnswer,
          arguments: input,
        });
        assert.equal(refused.isError, true);
        assert.equal(
          ServerErrorSchema.parse(
            JSON.parse(McpTextContentSchema.parse(refused.content)[0]?.text ?? TextSymbol.Empty),
          ).code,
          ErrorCode.PermissionDenied,
        );
        const decided = await createRequestClient(home).answer(input, ApprovalLevel.Human);
        assert.equal(decided.version, RequestVersion.EscalatedAnswered);
        assert.equal(decided.answer?.decision, selectedDecision);
        assert.deepEqual(decided.escalation, raised.request.escalation);
        return;
      }
      const forged = await client.callTool({
        name: McpIdentity.RequestAnswer,
        arguments: { ...answer, authority: ApprovalLevel.Human },
      });
      assert.equal(forged.isError, true);
      const answered = await client.callTool({
        name: McpIdentity.RequestAnswer,
        arguments: answer,
      });
      if (kind === RequestKind.Action) {
        assert.equal(answered.isError, true);
        assert.equal(
          ServerErrorSchema.parse(
            JSON.parse(McpTextContentSchema.parse(answered.content)[0]?.text ?? TextSymbol.Empty),
          ).code,
          ErrorCode.PermissionDenied,
        );
      } else {
        assert.notEqual(answered.isError, true);
        const kept = McpRequestResultSchema.parse(
          JSON.parse(McpTextContentSchema.parse(answered.content)[0]?.text ?? TextSymbol.Empty),
        );
        assert.equal(kept.state, RequestState.Answered);
        assert.equal(kept.request.answer?.decision, decision);
        assert.equal(kept.request.answer?.actor.authority, ApprovalLevel.Main);
        const repeat = await client.callTool({
          name: McpIdentity.RequestAnswer,
          arguments: answer,
        });
        assert.equal(repeat.isError, true);
        assert.equal(
          ServerErrorSchema.parse(
            JSON.parse(McpTextContentSchema.parse(repeat.content)[0]?.text ?? TextSymbol.Empty),
          ).code,
          ErrorCode.RequestConflict,
        );
      }
      const retry = await client.callTool({
        name: McpIdentity.RequestOpen,
        arguments: { run_id: runId, input },
      });
      assert.notEqual(retry.isError, true);
      const kept = McpRequestResultSchema.parse(
        JSON.parse(McpTextContentSchema.parse(retry.content)[0]?.text ?? TextSymbol.Empty),
      );
      assert.equal(
        kept.state,
        kind === RequestKind.Action ? RequestState.Waiting : RequestState.Answered,
      );
      assert.equal(
        kept.request.answer?.decision ?? null,
        kind === RequestKind.Action ? null : decision,
      );
    };
    for (const { kind, decision } of selections) await probeDecision(kind, decision);
    const selected: string[] = [];
    const appendPage = (page: RequestPage): void => {
      for (const item of page.requests) {
        assert.equal(item.request.run_id, runId);
        selected.push(item.request.request_id);
      }
    };
    let cursor: string | undefined;
    do {
      const query = {
        run_id: runId,
        client_id: ProbeRequest.Client,
        harness_session_id: ProbeRequest.Session,
        limit: 1,
        ...(cursor === undefined ? {} : { cursor }),
      };
      const response = await client.callTool({ name: McpIdentity.Requests, arguments: query });
      assert.notEqual(response.isError, true);
      const page = RequestPageSchema.parse(
        JSON.parse(McpTextContentSchema.parse(response.content)[0]?.text ?? TextSymbol.Empty),
      );
      assert.deepEqual(page.unavailable, []);
      appendPage(page);
      cursor = page.next_cursor ?? undefined;
      assert.ok(selected.length <= 6);
    } while (cursor !== undefined);
    assert.equal(selected.length, 6);
    assert.equal(new Set(selected).size, 6);
  });
  console.log(
    JSON.stringify({
      installed_mcp_requests: 6,
      listed_requests: 6,
      decisions: 4,
      role_refusals: 4,
      authority_refusals: 4,
      repeat_refusals: 2,
    }),
  );
}
