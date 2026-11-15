import { strict as assert } from "node:assert";
import {
  BoardLimit,
  CliCommand,
  CliEventFormat,
  ErrorCode,
  ExitCode,
  ProbeOption,
  RunEventKind,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { cliRunEvent } from "@titan/messages";
import { createRunClient } from "@titan/server/client";
import { CliEventLineSchema, EventPageSchema, type RunClient } from "@titan/types";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";

export async function cliEventFollow(jsonl: boolean, fail: boolean): Promise<boolean> {
  const id = "event-follow";
  const events = [RunEventKind.Created, RunEventKind.Started].map((type, index) => ({
    id: index + 1,
    time: index,
    type,
    data: { note: "first\nsecond" },
  }));
  const output: unknown[] = [];
  const cursors: number[] = [];
  const stop = new Error("Stop observer fixture");
  const failure = new TitanError(ErrorCode.InvalidResponse, "Unavailable page", ExitCode.Transport);
  const client: RunClient = {
    ...createRunClient("unused-home"),
    async events(runId, query = {}) {
      assert.equal(runId, id);
      const after = query.after ?? 0;
      assert(cursors.length < events.length);
      cursors.push(after);
      if (fail && after === 1) throw failure;
      return EventPageSchema.parse({
        schema_version: BoardLimit.EventPageVersion,
        run_id: id,
        after,
        events: events.slice(after, after + 1),
        next_cursor: after + 1,
        has_more: after === 0,
      });
    },
  };
  const cli = createCli({
    ...defaultServices,
    client: () => client,
    output: (value) => output.push(value),
    wait: async () => {
      throw stop;
    },
  });
  const args = [CliCommand.Events, id, ProbeOption.Follow];
  if (jsonl) args.push(ProbeOption.Format, CliEventFormat.JsonLines);
  await assert.rejects(cli(args), (error) => error === (fail ? failure : stop));
  assert.deepEqual(cursors, [0, 1]);
  assert.equal(output.length, fail ? 1 : 2);
  assert(output.every((line) => typeof line === "string" && !line.includes("\n")));
  if (jsonl) {
    const lines = output.map((line) => CliEventLineSchema.parse(JSON.parse(String(line))));
    assert.deepEqual(
      lines.map((line) => line.id),
      fail ? [1] : [1, 2],
    );
    assert(lines.every((line) => line.run_id === id));
  } else
    assert.deepEqual(
      output,
      events.slice(0, output.length).map((event) => cliRunEvent(event.id, event.type, event.data)),
    );
  return true;
}
