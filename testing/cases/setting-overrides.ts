import { Backend, ErrorCode, RequestDefaults, SettingOverrideLimit } from "@titan/constants";
import { negative, positive } from "@titan/test-factories";
import { ConfigSchema, RequestSettingsSchema, SettingOverrideRegistry } from "@titan/types";

const defaults = ConfigSchema.parse({});
const registeredDefaults = Object.entries(SettingOverrideRegistry).map(
  ([name, schema]) => `${name}=${JSON.stringify(schema.parse(undefined))}`,
);
const invalid = { code: ErrorCode.Arguments };
export const settingAssignmentCases = {
  positive: [
    positive("every registered default retains its schema value", [registeredDefaults], {
      defaults: defaults.defaults,
      limits: defaults.limits,
      recovery: defaults.recovery,
      approvals: RequestDefaults,
      requests: RequestSettingsSchema.parse({}),
    }),
    positive("omitted overrides are empty", [], {}),
    positive(
      "numeric and fractional settings share schema",
      [["limits.max_parallel=3", "recovery.jitter_ratio=0.5"]],
      { limits: { max_parallel: 3 }, recovery: { jitter_ratio: 0.5 } },
    ),
    positive(
      "enum and nullable settings retain typed values",
      [[`defaults.backend=${Backend.Codex}`, "limits.max_minutes=null"]],
      { defaults: { backend: Backend.Codex }, limits: { max_minutes: null } },
    ),
    positive(
      "existing distinct companion values are retained",
      [["limits.max_steps=12"], { limits: { max_parallel: 2 } }],
      { limits: { max_parallel: 2, max_steps: 12 } },
    ),
    positive(
      "zero retries and quoted enums are valid",
      [["recovery.max_retries=0", 'recovery.session_mode="native_only"']],
      { recovery: { max_retries: 0, session_mode: "native_only" } },
    ),
  ],
  negative: [
    negative(
      "initial owner settings are refused",
      [[], { server: { max_active_agents: 2 } }],
      invalid,
    ),
    negative("initial unknown keys are refused", [[], { unknown: true }], invalid),
    negative("initial invalid values are refused", [[], { limits: { max_parallel: 0 } }], invalid),
    negative("assignment needs a separator", [["limits.max_parallel"]], invalid),
    negative("empty value is refused", [["limits.max_parallel="]], invalid),
    negative("unknown setting is refused", [["limits.unknown=1"]], invalid),
    negative("owner settings are refused", [["server.max_active_agents=10"]], invalid),
    negative(
      "owner request queue is refused",
      [["server.max_pending_request_operations=2"]],
      invalid,
    ),
    negative("prototype key is refused", [["__proto__.polluted=1"]], invalid),
    negative("zero parallel work is refused", [["limits.max_parallel=0"]], invalid),
    negative("quoted number does not become numeric", [['limits.max_parallel="2"']], invalid),
    negative("boolean does not become numeric", [["limits.max_parallel=true"]], invalid),
    negative("structured value does not become numeric", [["limits.max_parallel={}"]], invalid),
    negative("infinite number is refused", [["limits.max_parallel=1e999"]], invalid),
    negative("unknown backend is refused", [["defaults.backend=other"]], invalid),
    negative("owner ceiling is retained", [["limits.max_workspace_depth=129"]], invalid),
    negative(
      "duplicate assignment is refused",
      [["limits.max_parallel=2", "limits.max_parallel=3"]],
      invalid,
    ),
    negative(
      "companion collision is refused",
      [["limits.max_parallel=2"], { limits: { max_parallel: 3 } }],
      invalid,
    ),
    negative(
      "too many entries are refused",
      [Array.from({ length: SettingOverrideLimit.Entries + 1 }, () => "limits.max_parallel=2")],
      invalid,
    ),
    negative(
      "oversized entry is refused",
      [["x".repeat(SettingOverrideLimit.Characters + 1)]],
      invalid,
    ),
  ],
};
export const cliSettingAssignmentCases = {
  positive: [
    positive(
      "typed settings override home layer",
      [["--set", "limits.max_parallel=3", "--set", "recovery.max_retries=0"]],
      { parallel: 3, retries: 0, backend: null, minutes: null },
    ),
    positive(
      "enum and deadline values reach effective config",
      [["--set", `defaults.backend=${Backend.Claude}`, "--set", "limits.max_minutes=1.5"]],
      { parallel: 2, retries: 4, backend: Backend.Claude, minutes: 1.5 },
    ),
    positive(
      "companion and general setting are composed",
      [["--max-parallel", "4", "--set", "recovery.max_retries=1"]],
      { parallel: 4, retries: 1, backend: null, minutes: null },
    ),
  ],
  negative: [
    negative(
      "owner flag fails before configuration work",
      [["--set", "server.max_active_agents=2"]],
      invalid,
    ),
    negative(
      "invalid enum fails before configuration work",
      [["--set", "defaults.backend=other"]],
      invalid,
    ),
    negative(
      "companion and general setting conflict",
      [["--max-parallel", "2", "--set", "limits.max_parallel=3"]],
      invalid,
    ),
    negative(
      "invalid combined recovery delays fail",
      [["--set", "recovery.base_delay_s=10", "--set", "recovery.max_delay_s=2"]],
      { code: ErrorCode.InvalidConfig },
    ),
  ],
};

export const cliSettingSubmissionCases = {
  positive: [
    positive(
      "submission freezes two general overrides",
      [["--set", "limits.max_parallel=2", "--set", "recovery.max_retries=0"]],
      { parallel: 2, retries: 0 },
    ),
    positive(
      "submission composes companion and general overrides",
      [["--max-parallel", "3", "--set", "recovery.max_retries=1"]],
      { parallel: 3, retries: 1 },
    ),
  ],
  negative: [
    negative(
      "submission rejects owner settings",
      [["--set", "server.max_active_agents=2"]],
      invalid,
    ),
    negative(
      "submission rejects invalid typed setting",
      [["--set", "limits.max_parallel=wrong"]],
      invalid,
    ),
  ],
};
