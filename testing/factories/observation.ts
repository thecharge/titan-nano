import { strict as assert } from "node:assert";
import {
  BoardLimit,
  ErrorCode,
  ExitCode,
  ObservationFixture,
  RunEventKind,
  RunStatus,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { cliRunEvent, TransportMessage } from "@titan/messages";
import { createRunClient } from "@titan/server/client";
import { EventPageSchema, type RunClient, RunSnapshotSchema } from "@titan/types";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { observe } from "../../apps/cli/src/commands/runs.ts";

export async function cliLiveObservation(mode: ObservationFixture): Promise<boolean> {
  const run = RunSnapshotSchema.parse({
    run_id: "observer-test",
    state: mode === ObservationFixture.Settled ? RunStatus.Passed : RunStatus.Running,
    root: "/project/.titan/runs/observer-test",
    artifacts: null,
    nodes: {},
  });
  const events = [RunEventKind.Created, RunEventKind.Started, RunEventKind.Passed].map(
    (type, index) => ({
      id: index + 1,
      time: index,
      type,
      data: { note: "first\nsecond" },
    }),
  );
  const cursors: number[] = [];
  const emitted: unknown[] = [];
  let reads = 0;
  let waits = 0;
  const failure = new TitanError(
    ErrorCode.InvalidResponse,
    TransportMessage.InvalidEvents,
    ExitCode.Transport,
  );
  const client: RunClient = {
    ...createRunClient("unused-home"),
    async get(id: string) {
      assert.equal(id, run.run_id);
      reads++;
      if (mode === ObservationFixture.StateFailure) throw failure;
      return { ...run, state: RunStatus.Passed };
    },
    async events(id, query = {}) {
      assert.equal(id, run.run_id);
      const after = query.after ?? 0;
      cursors.push(after);
      if (mode === ObservationFixture.EventFailure) throw failure;
      let end = 3;
      if (mode !== ObservationFixture.Settled && after < 2) end = 2;
      if (mode === ObservationFixture.Paging && after === 0) end = 1;
      return EventPageSchema.parse({
        schema_version: BoardLimit.EventPageVersion,
        run_id: id,
        after,
        events: events.slice(after, end),
        next_cursor: end,
        has_more: end === 1,
      });
    },
  };
  const pending = observe(
    {
      options: {
        watch: mode !== ObservationFixture.Detached,
        json: mode === ObservationFixture.Json,
      },
      positionals: [],
      project: "/project",
      home: "unused-home",
      services: {
        ...defaultServices,
        client: () => client,
        wait: async () => {
          assert.equal(emitted.length, mode === ObservationFixture.Json ? 0 : 2);
          waits++;
        },
      },
      emit: (value) => emitted.push(value),
    },
    run,
  );
  if (mode === ObservationFixture.EventFailure || mode === ObservationFixture.StateFailure) {
    await assert.rejects(pending, (error) => error === failure);
    assert.deepEqual(
      emitted,
      mode === ObservationFixture.EventFailure
        ? []
        : events.slice(0, 2).map((event) => cliRunEvent(event.id, event.type, event.data)),
    );
    assert.deepEqual(cursors, [0]);
    assert.equal(run.state, RunStatus.Running);
    return true;
  }
  assert.equal(
    (await pending).state,
    mode === ObservationFixture.Detached ? RunStatus.Running : RunStatus.Passed,
  );
  assert.equal(
    reads,
    mode === ObservationFixture.Detached || mode === ObservationFixture.Settled ? 0 : 1,
  );
  assert.equal(waits, reads);
  if (mode === ObservationFixture.Json || mode === ObservationFixture.Detached) {
    assert.deepEqual(emitted, []);
    assert.deepEqual(cursors, []);
    return true;
  }
  assert.deepEqual(
    emitted,
    events.map((event) => cliRunEvent(event.id, event.type, event.data)),
  );
  assert.deepEqual(
    cursors,
    mode === ObservationFixture.Settled
      ? [0]
      : mode === ObservationFixture.Paging
        ? [0, 1, 2]
        : [0, 2],
  );
  assert.ok(emitted.every((value) => typeof value === "string" && !value.includes("\n")));
  return true;
}
