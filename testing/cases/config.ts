import {
  AgentRuntime,
  Backend,
  ConfigDefault,
  ErrorCode,
  IoLimit,
  NativeToolTransport,
} from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

export const cliConfigInspectionCases = {
  positive: [
    positive("configuration without workflow never loads one", [{}], {
      exit: 0,
      reads: 0,
      parallel: ConfigDefault.MaxParallel,
    }),
    positive(
      "configuration without workflow retains owner settings",
      [{ limits: { max_parallel: 2 } }],
      { exit: 0, reads: 0, parallel: 2 },
    ),
    positive("selected workflow settings are loaded once", [{}, { limits: { max_parallel: 2 } }], {
      exit: 0,
      reads: 1,
      parallel: 2,
    }),
  ],
  negative: [
    negative("invalid owner cannot pass without workflow", [{ limits: { max_parallel: 0 } }], {
      code: ErrorCode.InvalidConfig,
    }),
    negative(
      "invalid selected workflow cannot pass inspection",
      [{}, { limits: { max_parallel: 0 } }],
      { code: ErrorCode.InvalidConfig },
    ),
  ],
};

export const objectCases = {
  positive: [
    positive("empty settings", [{}], {}),
    positive("nested settings", [{ limits: { max_steps: 7 } }], { limits: { max_steps: 7 } }),
  ],
  negative: [
    negative("null is not settings", [null], { code: ErrorCode.InvalidObject }),
    negative("array is not settings", [[]], { code: ErrorCode.InvalidObject }),
  ],
};
export const mergeCases = {
  positive: [
    positive(
      "nested override retains sibling",
      [{ limits: { max_steps: 7, max_parallel: 4 } }, { limits: { max_parallel: 2 } }],
      { limits: { max_steps: 7, max_parallel: 2 } },
    ),
    positive(
      "array replacement retains other fields",
      [{ tools: ["Read"], count: 1 }, { tools: ["Write"] }],
      { tools: ["Write"], count: 1 },
    ),
  ],
  negative: [
    negative("constructor is forbidden", [{}, { constructor: { prototype: {} } }], {
      code: ErrorCode.InvalidConfig,
    }),
    negative("prototype is forbidden at depth", [{}, { limits: { prototype: {} } }], {
      code: ErrorCode.InvalidConfig,
    }),
  ],
};
export const yamlCases = {
  positive: [
    positive("YAML", ["limits: {max_steps: 7}"], { limits: { max_steps: 7 } }),
    positive("JSON", ['{"limits":{"max_steps":7}}'], { limits: { max_steps: 7 } }),
  ],
  negative: [
    negative("unclosed sequence", ["["], { code: ErrorCode.InvalidYaml }),
    negative("unclosed nested sequence", ["limits: ["], { code: ErrorCode.InvalidYaml }),
  ],
};
export const fileConfigCases = {
  positive: [
    positive("explicit file", ["limits: {max_parallel: 2}", true], 2),
    positive("absent optional files with CLI override", [null, false], 3),
  ],
  negative: [
    negative(
      "oversized explicit file",
      [`#${"x".repeat(IoLimit.DataBytes)}\nlimits: {max_parallel: 2}`, true],
      {
        code: ErrorCode.InvalidConfig,
      },
    ),
    negative("missing explicit file", [null, true], { code: ErrorCode.InvalidConfig }),
    negative("malformed explicit file", ["limits: [", true], { code: ErrorCode.InvalidYaml }),
    negative("project cannot set owner capacity", ["server: {max_active_agents: 50}", true], {
      code: ErrorCode.OwnerSetting,
    }),
    negative("unknown setting", ["unknown: 1", true], { code: ErrorCode.InvalidConfig }),
    negative("invalid value", ["limits: {max_parallel: 0}", true], {
      code: ErrorCode.InvalidConfig,
    }),
  ],
};
export const suiteValidationCases = {
  positive: [
    positive("two cases of each polarity", [2, 2], true),
    positive("more than two cases of each polarity", [3, 4], true),
  ],
  negative: [
    rejected("one positive is insufficient", [1, 2], false),
    rejected("one negative is insufficient", [2, 1], false),
  ],
};

export const backendLaunchCases = {
  positive: [
    positive(
      "home owner selects Codex executable",
      [Backend.Codex, { executable: "/usr/local/bin/codex" }, true],
      {
        [Backend.Codex]: { executable: "/usr/local/bin/codex" },
        [Backend.Claude]: {},
      },
    ),
    positive(
      "home owner selects Claude executable and runtime",
      [Backend.Claude, { executable: "/opt/claude/cli.js", runtime: AgentRuntime.Bun }, true],
      {
        [Backend.Codex]: {},
        [Backend.Claude]: { executable: "/opt/claude/cli.js", runtime: AgentRuntime.Bun },
      },
    ),
  ],
  negative: [
    negative("relative executable is rejected", [Backend.Codex, { executable: "./codex" }, true], {
      code: ErrorCode.InvalidConfig,
    }),
    negative("unknown runtime is rejected", [Backend.Claude, { runtime: "unknown" }, true], {
      code: ErrorCode.InvalidConfig,
    }),
    negative(
      "Codex cannot silently ignore a runtime setting",
      [Backend.Codex, { runtime: AgentRuntime.Bun }, true],
      { code: ErrorCode.InvalidConfig },
    ),
    negative(
      "project cannot select an executable",
      [Backend.Codex, { executable: "/tmp/codex" }, false],
      { code: ErrorCode.OwnerSetting },
    ),
  ],
};

export const agentHostConfigCases = {
  positive: [
    positive("owner defaults bound host overhead", [{}, true], {
      gc_markers: 1,
      worker_threads: 2,
      startup_timeout_ms: 10000,
    }),
    positive(
      "owner chooses bounded host settings",
      [{ gc_markers: 2, worker_threads: 4, startup_timeout_ms: 2500 }, true],
      { gc_markers: 2, worker_threads: 4, startup_timeout_ms: 2500 },
    ),
  ],
  negative: [
    negative("zero GC markers", [{ gc_markers: 0 }, true], { code: ErrorCode.InvalidConfig }),
    negative("worker pool below Bun minimum", [{ worker_threads: 1 }, true], {
      code: ErrorCode.InvalidConfig,
    }),
    negative("excessive worker pool", [{ worker_threads: 17 }, true], {
      code: ErrorCode.InvalidConfig,
    }),
    negative("excessive GC markers", [{ gc_markers: 17 }, true], { code: ErrorCode.InvalidConfig }),
    negative("unbounded startup", [{ startup_timeout_ms: 0 }, true], {
      code: ErrorCode.InvalidConfig,
    }),
    negative("project cannot tune daemon hosts", [{ gc_markers: 2 }, false], {
      code: ErrorCode.OwnerSetting,
    }),
  ],
};

export const nativeTransportConfigCases = {
  positive: [
    positive(
      "owner defaults native connections to HTTP",
      [undefined, true],
      NativeToolTransport.Http,
    ),
    positive(
      "owner selects the stdio bridge",
      [NativeToolTransport.Stdio, true],
      NativeToolTransport.Stdio,
    ),
  ],
  negative: [
    negative("unknown native transport is rejected", ["unknown", true], {
      code: ErrorCode.InvalidConfig,
    }),
    negative("project cannot replace the native transport", [NativeToolTransport.Stdio, false], {
      code: ErrorCode.OwnerSetting,
    }),
  ],
};
