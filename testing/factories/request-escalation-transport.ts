import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  ApprovalLevel,
  CliCommand,
  CliOption,
  ErrorCode,
  ExitCode,
  HttpMethod,
  McpIdentity,
  RequestDecision,
  RequestEscalationSurface,
  RequestEscalationTransportFixture,
  RequestKind,
  RequestState,
  RequestVersion,
  RunEventKind,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { RequestMessage } from "@titan/messages";
import { call } from "@titan/server";
import { createRequestClient } from "@titan/server/requests";
import {
  EventPageSchema,
  McpRequestResultSchema,
  McpTextContentSchema,
  type OperationRequest,
  OperationRequestSchema,
  type RequestEscalationSubmission,
  ServerErrorSchema,
} from "@titan/types";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { withMemoryMcp, withStdioMcp } from "../support/mcp.ts";
import { withArtifactRun } from "./artifacts.ts";

export async function requestEscalationTransport(
  surface: RequestEscalationSurface,
  mode: RequestEscalationTransportFixture,
  memory = false,
) {
  return withArtifactRun(false, async (run, home) => {
    const client = createRequestClient(home);
    const original = {
      request_id: "permission",
      kind:
        mode === RequestEscalationTransportFixture.Human
          ? RequestKind.Action
          : RequestKind.Resource,
      scope: {
        operation: "start",
        resource: "candidate",
        content_hashes: {},
        arguments: [],
        environment_names: [],
      },
      origin: { client_id: "origin", harness_session_id: "session" },
      expires_at: Date.now() + 60000,
    };
    let previous = await client.open(run.run_id, original);
    const input: RequestEscalationSubmission = {
      run_id: run.run_id,
      request_id: previous.request_id,
      version: previous.version,
      reason: "Person review required",
      client_id: "main-reviewer",
    };
    if (mode === RequestEscalationTransportFixture.Stale) input.version++;
    if (mode === RequestEscalationTransportFixture.WrongRun) input.run_id = "missing-run";
    if (mode === RequestEscalationTransportFixture.Repeated)
      previous = await client.escalate(input);
    if (mode === RequestEscalationTransportFixture.Answered)
      previous = await client.answer(
        { ...input, decision: RequestDecision.Approve },
        ApprovalLevel.Main,
      );
    const before = EventPageSchema.parse(await call(home, `/runs/${run.run_id}/events`));
    let accesses = 0;
    const invoke = async () => {
      if (surface === RequestEscalationSurface.Cli) {
        const output: unknown[] = [];
        const cli = createCli({
          ...defaultServices,
          output: (value) => output.push(value),
          requests: (selected) => {
            accesses++;
            assert.equal(selected, home);
            return client;
          },
        });
        const args = [
          CliCommand.Answer,
          input.run_id,
          input.request_id,
          `--${CliOption.ToPerson}`,
          `--${CliOption.Home}`,
          home,
          `--${CliOption.Json}`,
          `--${CliOption.RequestVersion}`,
          String(input.version),
          `--${CliOption.ClientId}`,
          input.client_id,
          `--${CliOption.Reason}`,
          input.reason,
        ];
        if (mode === RequestEscalationTransportFixture.MissingReason)
          args.splice(args.indexOf(`--${CliOption.Reason}`), 2);
        if (mode === RequestEscalationTransportFixture.MissingVersion)
          args.splice(args.indexOf(`--${CliOption.RequestVersion}`), 2);
        if (mode === RequestEscalationTransportFixture.Decision)
          args.splice(3, 0, RequestDecision.Approve);
        if (mode === RequestEscalationTransportFixture.MissingDecision)
          args.splice(args.indexOf(`--${CliOption.ToPerson}`), 1);
        assert.equal(await cli(args), ExitCode.Success);
        assert.equal(accesses, 1);
        assert.equal(output.length, 1);
        return OperationRequestSchema.parse(output[0]);
      }
      const data: Record<string, unknown> = { ...input };
      if (mode === RequestEscalationTransportFixture.Authority)
        data.authority = ApprovalLevel.Human;
      if (mode === RequestEscalationTransportFixture.MissingReason) delete data.reason;
      if (mode === RequestEscalationTransportFixture.MissingVersion) delete data.version;
      if (surface === RequestEscalationSurface.Mcp) {
        const use = async (mcp: Client) => {
          assert.ok(
            (await mcp.listTools()).tools.some((tool) => tool.name === McpIdentity.RequestEscalate),
          );
          const result = await mcp.callTool({
            name: McpIdentity.RequestEscalate,
            arguments: data,
          });
          let payload: unknown;
          try {
            payload = JSON.parse(McpTextContentSchema.parse(result.content)[0]?.text ?? "");
          } catch {
            throw new TitanError(ErrorCode.InvalidRequest, RequestMessage.Invalid);
          }
          if (result.isError) {
            const failure = ServerErrorSchema.parse(payload);
            throw new TitanError(failure.code, failure.error);
          }
          const parsed = McpRequestResultSchema.parse(payload);
          assert.equal(parsed.state, RequestState.Waiting);
          return parsed.request;
        };
        return memory
          ? withMemoryMcp(home, use)
          : withStdioMcp(
              process.execPath,
              [resolve("apps/cli/src/main.ts"), CliCommand.Mcp, `--${CliOption.Home}`, home],
              use,
            );
      }
      let path = `/requests/${input.request_id}/escalate`;
      if (mode === RequestEscalationTransportFixture.WrongPath) path = "/requests/other/escalate";
      if (mode === RequestEscalationTransportFixture.Query) path += "?authority=human";
      return OperationRequestSchema.parse(
        await call(
          home,
          path,
          mode === RequestEscalationTransportFixture.Method ? HttpMethod.Get : HttpMethod.Post,
          mode === RequestEscalationTransportFixture.Method ? undefined : data,
        ),
      );
    };
    let escalated: OperationRequest;
    try {
      escalated = await invoke();
    } catch (error) {
      assert.deepEqual(await client.get(run.run_id, input.request_id), previous);
      assert.deepEqual(
        EventPageSchema.parse(await call(home, `/runs/${run.run_id}/events`)),
        before,
      );
      if (surface === RequestEscalationSurface.Cli)
        assert.equal(
          accesses,
          [
            RequestEscalationTransportFixture.MissingReason,
            RequestEscalationTransportFixture.MissingVersion,
            RequestEscalationTransportFixture.Decision,
            RequestEscalationTransportFixture.MissingDecision,
          ].includes(mode)
            ? 0
            : 1,
        );
      throw error;
    }
    assert.deepEqual(await client.get(run.run_id, input.request_id), escalated);
    assert.deepEqual(escalated.scope, previous.scope);
    assert.deepEqual(escalated.origin, previous.origin);
    assert.equal(escalated.created_at, previous.created_at);
    assert.equal(escalated.expires_at, previous.expires_at);
    assert.equal(escalated.version, RequestVersion.Escalated);
    assert.equal(escalated.level, ApprovalLevel.Human);
    assert.equal(escalated.answer, null);
    assert.equal(escalated.escalation?.reason, input.reason);
    assert.deepEqual(escalated.escalation?.actor, {
      client_id: input.client_id,
      authority: ApprovalLevel.Main,
    });
    const waiting = await client.list({ run_id: run.run_id, state: RequestState.Waiting });
    assert.deepEqual(
      waiting.requests.map((entry) => entry.request),
      [escalated],
    );
    assert.deepEqual(await client.open(run.run_id, original), escalated);
    const answer = {
      ...input,
      version: escalated.version,
      decision:
        mode === RequestEscalationTransportFixture.Deny
          ? RequestDecision.Deny
          : RequestDecision.Approve,
    };
    await assert.rejects(client.answer(answer, ApprovalLevel.Main), {
      code: ErrorCode.PermissionDenied,
    });
    assert.deepEqual(await client.get(run.run_id, input.request_id), escalated);
    const decided = await client.answer(answer, ApprovalLevel.Human);
    assert.equal(decided.version, RequestVersion.EscalatedAnswered);
    assert.equal(decided.answer?.decision, answer.decision);
    assert.equal(decided.answer?.actor.authority, ApprovalLevel.Human);
    assert.deepEqual(decided.escalation, escalated.escalation);
    const events = EventPageSchema.parse(await call(home, `/runs/${run.run_id}/events`));
    assert.equal(
      events.events.filter((event) => event.type === RunEventKind.RequestEscalated).length,
      1,
    );
    assert.equal(
      events.events.filter((event) => event.type === RunEventKind.RequestAnswered).length,
      1,
    );
    return true;
  });
}
