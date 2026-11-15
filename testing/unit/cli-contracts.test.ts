import { expect, test } from "bun:test";
import { loadData } from "@titan/config";
import { ErrorCode, ExitCode, RunStatus } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { loadKnowledge } from "@titan/knowledge";
import { fetchLocalModel, inspectLocalModel } from "@titan/runtime";
import { createRunClient } from "@titan/server/client";
import { createDashboardClient } from "@titan/server/dashboard-client";
import { createKnowledgeClient } from "@titan/server/knowledge";
import { createRequestClient } from "@titan/server/requests";
import type { CliServices, RunSnapshot } from "@titan/types";
import { createCli } from "../../apps/cli/src/application.ts";
import { prepareSubmission } from "../../apps/cli/src/submissions.ts";

function fixture(state: RunStatus = RunStatus.Passed) {
  const output: unknown[] = [];
  const reads: string[] = [];
  const run: RunSnapshot = {
    run_id: "run-one",
    state,
    root: "/project/.titan/runs/run-one",
    artifacts: null,
    nodes: {},
  };
  const protocol = async () => {};
  const services: CliServices = {
    inspectModel: inspectLocalModel,
    fetchModel: fetchLocalModel,
    notice: () => undefined,
    prepareSubmission,
    loadData,
    loadKnowledge,
    knowledge: createKnowledgeClient,
    requests: createRequestClient,
    dashboard: createDashboardClient,
    improve: async () => ({ run_id: "run-one", rounds: [], kept: false }),
    output: (value) => {
      output.push(value);
    },
    client: () => ({
      usage: createRunClient("/unused").usage,
      configuration: createRunClient("/unused").configuration,
      artifact: async () => {
        throw new TitanError(ErrorCode.ArtifactUnavailable, "No kept delivery");
      },
      artifacts: async () => {
        throw new TitanError(ErrorCode.ArtifactUnavailable, "No kept delivery");
      },
      get: async (id) => {
        reads.push(id);
        return run;
      },
      submit: async () => run,
      control: async () => run,
      list: async () => ({
        schema_version: 1,
        runs: [],
        before: Number.MAX_SAFE_INTEGER,
        next_before: Number.MAX_SAFE_INTEGER,
        has_more: false,
      }),
      events: async () => ({
        schema_version: 1,
        run_id: "run",
        after: 0,
        events: [],
        next_cursor: 0,
        has_more: false,
      }),
    }),
    serve: async (_home, ready) => {
      ready({ url: "http://127.0.0.1:12345", pid: 1 });
    },
    mcp: protocol,
    toolServer: protocol,
    wait: async () => {
      run.state = RunStatus.Passed;
    },
    launch: async () => 0,
    program: () => null,
    sdk: () => false,
    environment: {},
    cwd: () => "/project",
    version: "0.1.0-alpha.1",
    runtimeVersion: "1.3.10",
  };
  return { main: createCli(services), output, reads };
}

test.each(
  [
    ["status", "run-one", "--backend", "fake"],
    ["status", "run-one", "extra"],
    ["events", "run-one", "--watch"],
    ["schema", "not-a-schema"],
    ["run", "missing.yaml", "--watch", "--dry-run"],
    ["run", "missing.yaml", "--dry-run", "--submission-id", "unneeded"],
    ["run", "missing.yaml", "--dry-run", "--harness-session-id", "caller"],
    ["run", "missing.yaml", "--dry-run", "--harness-session-id", ""],
    ["run", "missing.yaml", "--max-parallel", "1.5"],
    ["run", "missing.yaml", "--max-parallel", "9007199254740992"],
    ["run", "missing.yaml", "--backend", "unimplemented"],
    ["run", "missing.yaml", "--config", "missing-config.yaml"],
    ["status", "../escape"],
    ["status"],
    ["--home", "/project"],
    ["status", "run-one", "--version"],
    ["mcp", "--json"],
    ["constructor"],
  ].map((args) => ({ args })),
)("invalid invocation fails before any client access: %j", async ({ args }) => {
  const { main, output, reads } = fixture();
  await expect(main(args)).rejects.toThrow();
  expect(output).toEqual([]);
  expect(reads).toEqual([]);
});

test.each(
  [
    [RunStatus.Passed, ExitCode.Success],
    [RunStatus.Failed, ExitCode.Unsuccessful],
    [RunStatus.Cancelled, ExitCode.Unsuccessful],
    [RunStatus.TimedOut, ExitCode.Unsuccessful],
    [RunStatus.Blocked, ExitCode.Blocked],
    [RunStatus.Paused, ExitCode.Blocked],
  ].map(([state, code]) => ({ state: state as RunStatus, code: Number(code) })),
)("watched status maps %j", async ({ state, code }) => {
  const { main, output } = fixture(state);
  expect(await main(["status", "run-one", "--watch", "--json"])).toBe(code);
  expect(output).toHaveLength(1);
});

test("a read query succeeds independently of the run outcome", async () => {
  expect(await fixture(RunStatus.Failed).main(["status", "run-one"])).toBe(ExitCode.Success);
});
test("watch polls through the client port until the run settles", async () => {
  const { main, reads } = fixture(RunStatus.Running);
  expect(await main(["status", "run-one", "--watch"])).toBe(ExitCode.Success);
  expect(reads).toEqual(["run-one", "run-one"]);
});
test("command help exposes only the options accepted by that command", async () => {
  const { main, output } = fixture();
  expect(await main(["events", "--help", "--json"])).toBe(0);
  expect(output[0]).toMatchObject({
    command: "events",
    options: ["help", "json", "home", "after", "limit", "follow", "format"],
  });
  expect(await main(["apply", "--help"])).toBe(0);
});
test("MCP uses protocol framing without an ordinary result object", async () => {
  const { main, output } = fixture();
  expect(await main(["mcp"])).toBe(0);
  expect(output).toEqual([]);
});
test("serve emits one readiness object through its lifecycle port", async () => {
  const { main, output } = fixture();
  expect(await main(["serve", "--home", "/engine", "--json"])).toBe(0);
  expect(output).toEqual([{ ready: true, url: "http://127.0.0.1:12345", pid: 1, home: "/engine" }]);
});

test("signal wait removes both listeners after either termination signal", async () => {
  const { EventEmitter } = await import("node:events");
  const { waitForStop } = await import("@titan/runtime");
  const signals = new EventEmitter();
  const stopped = waitForStop(signals);
  expect(signals.listenerCount("SIGINT")).toBe(1);
  signals.emit("SIGTERM");
  await stopped;
  expect(signals.listenerCount("SIGINT")).toBe(0);
  expect(signals.listenerCount("SIGTERM")).toBe(0);
});

test.each([RunStatus.Failed, RunStatus.Paused])(
  "artifact command propagates unavailable delivery for %s",
  async (state) => {
    const { main } = fixture(state);
    await expect(main(["artifacts", "run-one"])).rejects.toMatchObject({
      code: ErrorCode.ArtifactUnavailable,
    });
  },
);
