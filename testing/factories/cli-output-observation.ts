import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import {
  BoardLimit,
  CliCommand,
  CliObservationFault,
  CliRecoveryAction,
  CliRuntime,
  EmbeddedRuntimeBuild,
  ErrorCode,
  ExitCode,
  HookFile,
  HttpHeader,
  McpIdentity,
  Packaging,
  ProbeOption,
  RunStatus,
  ServerRoute,
} from "@titan/constants";
import { RunObservationError, TitanError } from "@titan/errors";
import { createRunClient } from "@titan/server/client";
import { CliOutputSchema, EventPageSchema, type RunClient } from "@titan/types";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { runResult } from "../../apps/cli/src/commands/runs.ts";
import { failureEnvelope } from "../../apps/cli/src/output.ts";
import { withClientAddress } from "../support/client.ts";
import { captureCli } from "../support/command.ts";

const snapshot = {
  run_id: "selected-run",
  state: RunStatus.Running,
  root: "/kept/run",
  artifacts: null,
  nodes: {},
};
const page = EventPageSchema.parse({
  schema_version: BoardLimit.EventPageVersion,
  run_id: snapshot.run_id,
  after: 0,
  events: [],
  next_cursor: 0,
  has_more: false,
});

export async function cliOutputObservation(
  watch: boolean,
  fault: CliObservationFault,
): Promise<boolean> {
  const error =
    fault === CliObservationFault.Unexpected
      ? new Error("Unexpected observation error")
      : new TitanError(ErrorCode.InvalidResponse, "Unavailable observation", ExitCode.Transport);
  const client: RunClient = {
    ...createRunClient("unused-home"),
    async get() {
      if (fault === CliObservationFault.State) throw error;
      return { ...snapshot, state: RunStatus.Passed };
    },
    async events() {
      if (fault === CliObservationFault.Events || fault === CliObservationFault.Unexpected)
        throw error;
      return page;
    },
  };
  const emitted: unknown[] = [];
  const context = {
    home: "unused-home",
    project: "/project",
    positionals: [snapshot.run_id],
    options: { watch, json: true },
    emit: emitted.push.bind(emitted),
    services: { ...defaultServices, client: () => client, wait: async () => {} },
  };
  if (fault === CliObservationFault.None) {
    const result = await runResult(context, snapshot);
    assert.equal(emitted.length, 0);
    assert.equal(result.exitCode, ExitCode.Success);
    assert.deepEqual(result.events, page);
    return true;
  }
  if (fault === CliObservationFault.Unexpected) {
    await assert.rejects(runResult(context, snapshot), (caught) => caught === error);
    return true;
  }
  await assert.rejects(runResult(context, snapshot), (caught) => {
    assert(caught instanceof RunObservationError);
    assert.equal(caught.run_id, snapshot.run_id);
    assert.equal(caught.cause, error);
    const output = failureEnvelope(caught, CliCommand.Status);
    assert.equal(output.state, null);
    assert.equal(output.error.recovery?.action, CliRecoveryAction.Observe);
    assert.equal(output.identifiers.run_id, snapshot.run_id);
    return true;
  });
  return true;
}

export async function cliOutputObservationProcess(
  watch: boolean,
  invalid: boolean,
  cli = resolve(import.meta.dir, HookFile.RepositoryRoot, Packaging.CliSource),
): Promise<boolean> {
  let reads = 0;
  return withClientAddress(
    (request) => {
      if (new URL(request.url).pathname === ServerRoute.Health)
        return Response.json(
          {
            ready: true,
            version: McpIdentity.Version,
            diagnostics: { written: 0, filtered: 0, rejected: 0, failed: 0, disabled: true },
          },
          { headers: { [HttpHeader.RuntimeBuild]: EmbeddedRuntimeBuild } },
        );
      if (new URL(request.url).pathname.endsWith("/events"))
        return Response.json(invalid ? { ...page, next_cursor: 1 } : page);
      reads++;
      if (invalid && watch && reads > 1)
        return Response.json({ ...snapshot, run_id: "crossed-run" });
      return Response.json({
        ...snapshot,
        state: watch && reads > 1 ? RunStatus.Passed : RunStatus.Running,
      });
    },
    async (home) => {
      const result = await captureCli(cli, [
        CliCommand.Status,
        snapshot.run_id,
        ProbeOption.Home,
        home,
        ...(watch ? [ProbeOption.Watch] : []),
        CliRuntime.JsonFlag,
      ]);
      assert.equal(
        result.code,
        invalid ? ExitCode.Transport : ExitCode.Success,
        result.output.toString() + result.error.toString(),
      );
      assert.equal(result.error.length, 0);
      const envelope = CliOutputSchema.parse(JSON.parse(result.output.toString()));
      assert.equal(envelope.identifiers.run_id, snapshot.run_id);
      if (invalid) {
        assert.equal(envelope.state, null);
        assert.equal(envelope.error?.code, ErrorCode.InvalidResponse);
        assert.equal(envelope.error.recovery?.action, CliRecoveryAction.Observe);
      } else assert.equal(envelope.state, watch ? RunStatus.Passed : RunStatus.Running);
      return true;
    },
  );
}
