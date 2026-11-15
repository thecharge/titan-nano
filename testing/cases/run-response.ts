import { ErrorCode, ExitCode, HttpStatus, RunAction, RunStatus } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

const invalid = { code: ErrorCode.InvalidResponse, exitCode: ExitCode.Transport };

export const runStatusResponseCases = {
  positive: [
    positive("selected active run is retained", [null, "selected-run", RunStatus.Running], {
      run_id: "selected-run",
      state: RunStatus.Running,
    }),
    positive("selected settled run is retained", [null, "selected-run", RunStatus.Passed], {
      run_id: "selected-run",
      state: RunStatus.Passed,
    }),
  ],
  negative: [
    negative(
      "another active run cannot replace status",
      [null, "other-run", RunStatus.Running],
      invalid,
    ),
    negative(
      "another passed run cannot claim completion",
      [null, "other-run", RunStatus.Passed],
      invalid,
    ),
  ],
};

export const runControlResponseCases = {
  positive: [
    positive("resume retains its target", [RunAction.Resume, "selected-run", RunStatus.Running], {
      run_id: "selected-run",
      state: RunStatus.Running,
    }),
    positive("pause retains its target", [RunAction.Pause, "selected-run", RunStatus.Paused], {
      run_id: "selected-run",
      state: RunStatus.Paused,
    }),
    positive("cancel retains its target", [RunAction.Cancel, "selected-run", RunStatus.Cancelled], {
      run_id: "selected-run",
      state: RunStatus.Cancelled,
    }),
  ],
  negative: [
    negative(
      "resume refuses another active run",
      [RunAction.Resume, "other-run", RunStatus.Running],
      invalid,
    ),
    negative(
      "pause refuses another paused run",
      [RunAction.Pause, "other-run", RunStatus.Paused],
      invalid,
    ),
    negative(
      "cancel refuses another cancelled run",
      [RunAction.Cancel, "other-run", RunStatus.Cancelled],
      invalid,
    ),
  ],
};

export const mcpRunResponseCases = {
  positive: [
    positive(
      "MCP status retains the selected active run",
      [null, "selected-run", RunStatus.Running],
      true,
    ),
    positive(
      "MCP status retains the selected passed run",
      [null, "selected-run", RunStatus.Passed],
      true,
    ),
    positive(
      "MCP resume retains its target",
      [RunAction.Resume, "selected-run", RunStatus.Running],
      true,
    ),
    positive(
      "MCP pause retains its target",
      [RunAction.Pause, "selected-run", RunStatus.Paused],
      true,
    ),
    positive(
      "MCP cancel retains its target",
      [RunAction.Cancel, "selected-run", RunStatus.Cancelled],
      true,
    ),
  ],
  negative: [
    rejected(
      "MCP status refuses another active run",
      [null, "other-run", RunStatus.Running],
      false,
    ),
    rejected("MCP status refuses another passed run", [null, "other-run", RunStatus.Passed], false),
    rejected(
      "MCP resume refuses another run",
      [RunAction.Resume, "other-run", RunStatus.Running],
      false,
    ),
    rejected(
      "MCP pause refuses another run",
      [RunAction.Pause, "other-run", RunStatus.Paused],
      false,
    ),
    rejected(
      "MCP cancel refuses another run",
      [RunAction.Cancel, "other-run", RunStatus.Cancelled],
      false,
    ),
  ],
};

const snapshot = {
  run_id: "selected-run",
  state: RunStatus.Passed,
  root: "/kept/run",
  artifacts: null,
  nodes: {},
};
export const rawRunResponseCases = {
  positive: [
    positive("valid completed snapshot reaches the client", [snapshot], RunStatus.Passed),
    positive(
      "valid active snapshot reaches the client",
      [{ ...snapshot, state: RunStatus.Running }],
      RunStatus.Running,
    ),
  ],
  negative: [
    negative("missing run fields cannot enter the client", [{ state: RunStatus.Passed }], invalid),
    negative(
      "unknown state cannot enter the client",
      [{ ...snapshot, state: "invented" }],
      invalid,
    ),
    negative(
      "non-path artifacts cannot enter the client",
      [{ ...snapshot, artifacts: 42 }],
      invalid,
    ),
    negative("non-JSON server response is a transport failure", ["invalid JSON"], invalid),
    negative(
      "malformed server error is a transport failure",
      [{ code: 42 }, HttpStatus.Internal],
      invalid,
    ),
  ],
};
