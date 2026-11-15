import { MessageId } from "@titan/constants";

export const ConfigMessage = {
  [MessageId.SettingsObjectRequired]: "Expected a settings object",
  [MessageId.UnsafeSettingName]: "Unsafe setting name",
  [MessageId.InvalidYaml]: "Cannot parse YAML or JSON",
  [MessageId.RecoveryDelayOrder]: "max_delay_s must be at least base_delay_s",
  [MessageId.ModelVersion]: "defaults.model must be a model name without a version",
  [MessageId.WorkflowShape]: "Supply exactly one of steps or graph.nodes",
  [MessageId.SafeIdentifierRequired]: "Expected a full safe identifier",
} as const;

export const configReadFailed = (path: string, reason: string): string =>
  `Cannot read configuration at ${path}: ${reason}`;
export const ownerSetting = (source: string): string =>
  `${source}: server settings belong to the home owner`;
export const invalidConfig = (source: string, reason: string): string => `${source}: ${reason}`;
export const secretValue = (name: string): string => `Input holds the value of ${name}`;
export const invalidConcurrencyLimit = "Concurrency limit must be a positive safe integer";
export const TransportMessage = {
  InvalidConfiguration: "Server returned invalid or mismatched frozen configuration",
  InvalidUsage: "Server returned invalid or mismatched run usage",
  StartServer: "Start titan serve in another terminal",
  Unavailable: "Titan server is unavailable; start titan serve",
  InvalidJson: "Server returned invalid JSON",
  InvalidError: "Server returned an invalid error response",
  InvalidRun: "Server returned an invalid run response",
  InvalidEvents: "Server returned an invalid event page",
} as const;
export const StoreMessage = {
  Capacity: "Store capacity reached; retry after active work finishes",
  Pending: "Operation queue capacity reached; retry after active work finishes",
} as const;

export const executablePathRequired = "Backend executable must be an absolute local path";

export const executableUnavailable = (path: string): string =>
  `Backend executable is not an accessible file: ${path}`;

export const SettingOverrideMessage = {
  Input: "Setting overrides exceed the count or text allowance",
  Assignment: "Use --set SECTION.KEY=VALUE with a supported run setting",
  Value: "Setting override has an invalid value",
  Duplicate: "Specify each setting once, including companion flags",
} as const;

export const requestBudgetExceeded = (source: string, allowance: number): string =>
  `${source}: requests.max_per_run cannot exceed inherited allowance ${allowance}`;

export const ConfigFileMessage = {
  Conflict: "Configuration changed; inspect its current version before editing again",
  Locked: "Another configuration writer is active; inspect the version and retry",
  Input: "Select user or project scope and a valid configuration version",
  Setting: "Supply a dotted setting name and a YAML or JSON value",
  Init: "Create a private scoped configuration file without replacing an existing file",
  Validate: "Validate scoped settings and inspect the file version",
  Set: "Change one scoped setting using its expected file version",
  Schema: "Export the configuration input schema",
  ShowTarget: "Select --scope user or project, or an exact --run-id",
  SelectorConflict: "Select a run or a file scope without combining their selectors",
} as const;
