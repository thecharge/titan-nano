import { homedir } from "node:os";
import { resolve } from "node:path";
import {
  AgentHost,
  ApprovalRank,
  ConfigDefault,
  ConfigFile,
  ConfigScope,
  ConfigSection,
  ConfigSource,
  EnvVar,
  ErrorCode,
  ErrorField,
  ExitCode,
  FileEncoding,
  FileErrorCode,
  IoLimit,
  JsonSchemaDirection,
  MessageId,
  Newline,
  Packaging,
  RequestDefaults,
  RequestKind,
  RequestLimit,
  SecretEnvironmentPattern,
  SubmissionReceipt,
  TextSymbol,
  UnsafeSettingNames,
  WorkflowConfigFields,
} from "@titan/constants";
import { hash, jsonByteLength } from "@titan/core";
import { errorMessage, TitanError } from "@titan/errors";
import {
  ConfigMessage,
  configReadFailed,
  invalidConfig,
  limitedApprovalLevel,
  ownerSetting,
  requestBudgetExceeded,
  SubmissionReceiptMessage,
  secretValue,
  UpdateMessage,
  workflowApprovalLevel,
} from "@titan/messages";
import { readFileBytes } from "@titan/streams";
import {
  type ConfigLayer,
  type ConfigResolution,
  ConfigSchema,
  type ConfigSources,
  type EffectiveConfig,
  ObjectSchema,
  RequestQueueSettingsSchema,
  RunQueueSettingsSchema,
  RunResidencySettingsSchema,
  type SecretScanner,
} from "@titan/types";
import { z } from "zod";

export function object(value: unknown): Record<string, unknown> {
  const result = ObjectSchema.safeParse(value);
  if (!result.success)
    throw new TitanError(ErrorCode.InvalidObject, ConfigMessage[MessageId.SettingsObjectRequired]);
  return result.data;
}

function mergeSetting(result: Record<string, unknown>, key: string, value: unknown): void {
  if (UnsafeSettingNames.some((name) => name === key))
    throw new TitanError(ErrorCode.InvalidConfig, ConfigMessage[MessageId.UnsafeSettingName]);
  result[key] = ObjectSchema.safeParse(value).success ? merge(result[key] ?? {}, value) : value;
}

export function merge(base: unknown, patch: unknown): unknown {
  const entry = ObjectSchema.safeParse(patch);
  if (!entry.success) return patch;
  const result = { ...object(base) };
  for (const [key, value] of Object.entries(entry.data)) mergeSetting(result, key, value);
  return result;
}

export function workflowSettings(value: unknown): Record<string, unknown> {
  const entry = object(value);
  return Object.fromEntries(
    WorkflowConfigFields.filter((key) => entry[key] !== undefined).map((key) => [key, entry[key]]),
  );
}

export function parseData(text: string): unknown {
  try {
    return Bun.YAML.parse(text);
  } catch {
    throw new TitanError(ErrorCode.InvalidYaml, ConfigMessage[MessageId.InvalidYaml]);
  }
}

export async function loadData(path: string): Promise<unknown> {
  return parseData((await readFileBytes(path, IoLimit.DataBytes)).toString(FileEncoding.Utf8));
}

export function homePath(explicit?: string): string {
  return resolve(
    explicit ?? process.env[EnvVar.TitanHome] ?? resolve(homedir(), ConfigFile.HomeDirectory),
  );
}

async function fileLayer(
  source: ConfigSource,
  path: string,
  required: boolean,
): Promise<ConfigLayer[]> {
  let text: string;
  try {
    text = (await readFileBytes(path, IoLimit.DataBytes)).toString(FileEncoding.Utf8);
  } catch (error) {
    if (
      !required &&
      error instanceof Error &&
      Reflect.get(error, ErrorField.Code) === FileErrorCode.Missing
    )
      return [];
    throw new TitanError(ErrorCode.InvalidConfig, configReadFailed(path, errorMessage(error)));
  }
  return [{ source, path, value: parseData(text), limited: source === ConfigSource.Project }];
}

function layerName(layer: ConfigLayer): string {
  return layer.path ? [layer.source, layer.path].join(TextSymbol.Colon) : layer.source;
}

function recordSource(
  sources: ConfigSources,
  source: string,
  entry: unknown,
  prefix: string = TextSymbol.Empty,
): void {
  for (const [key, child] of Object.entries(object(entry))) {
    recordSetting(sources, source, child, prefix ? [prefix, key].join(TextSymbol.Dot) : key);
  }
}

function recordSetting(sources: ConfigSources, source: string, child: unknown, path: string): void {
  if (ObjectSchema.safeParse(child).success) {
    recordSource(sources, source, child, path);
    return;
  }
  sources[path] ??= [];
  sources[path].push(source);
}

function builtInLayer(): ConfigLayer {
  const server = {
    ...RequestQueueSettingsSchema.parse({}),
    ...RunQueueSettingsSchema.parse({}),
    ...RunResidencySettingsSchema.parse({}),
    agent_host: { worker_threads: ConfigDefault.HostWorkerThreads },
    native_tools: { transport: ConfigDefault.NativeTransport },
  };
  const value = ConfigSchema.parse({
    approvals: RequestDefaults,
    client: { max_submission_receipts: SubmissionReceipt.Maximum },
    requests: { max_per_run: RequestLimit.PerRun },
    server,
  });
  return { source: ConfigSource.BuiltIn, value, limited: false };
}

async function layers(options: ConfigResolution): Promise<ConfigLayer[]> {
  const result: ConfigLayer[] = [
    builtInLayer(),
    ...(await fileLayer(ConfigSource.User, resolve(options.home, ConfigFile.User), false)),
    ...(await fileLayer(
      ConfigSource.Project,
      options.configFile
        ? resolve(options.configFile)
        : resolve(options.project, ConfigFile.Project),
      Boolean(options.configFile),
    )),
  ];
  if (options.workflow !== undefined)
    result.push({ source: ConfigSource.Workflow, value: options.workflow, limited: true });
  if (options.overrides !== undefined)
    result.push({ source: ConfigSource.Cli, value: options.overrides, limited: true });
  return result;
}

function applyLayer(value: unknown, layer: ConfigLayer) {
  const source = layerName(layer);
  if (layer.limited && ConfigSection.Server in object(layer.value))
    throw new TitanError(ErrorCode.OwnerSetting, ownerSetting(source));
  if (layer.limited && ConfigSection.Client in object(layer.value))
    throw new TitanError(ErrorCode.OwnerSetting, SubmissionReceiptMessage.Owner);
  if (layer.limited && ConfigSection.Update in object(layer.value))
    throw new TitanError(ErrorCode.OwnerSetting, UpdateMessage.Owner);
  const parsed = ConfigSchema.safeParse(merge(value, layer.value));
  if (!parsed.success)
    throw new TitanError(
      ErrorCode.InvalidConfig,
      invalidConfig(
        source,
        parsed.error.issues
          .map((issue) => invalidConfig(issue.path.join(TextSymbol.Dot), issue.message))
          .join(Newline),
      ),
      ExitCode.Input,
      [...new Set(parsed.error.issues.map((issue) => issue.path.join(TextSymbol.Dot)))],
    );
  const inherited = ConfigSchema.parse(value);
  const allowance = inherited.requests?.max_per_run ?? RequestLimit.PerRun;
  if (layer.limited && (parsed.data.requests?.max_per_run ?? RequestLimit.PerRun) > allowance)
    throw new TitanError(ErrorCode.InvalidConfig, requestBudgetExceeded(source, allowance));
  const previous = inherited.approvals ?? RequestDefaults;
  const next = parsed.data.approvals ?? RequestDefaults;
  for (const kind of Object.values(RequestKind)) {
    if (layer.limited && ApprovalRank[next[kind]] < ApprovalRank[previous[kind]])
      throw new TitanError(
        ErrorCode.InvalidConfig,
        layer.source === ConfigSource.Workflow
          ? workflowApprovalLevel(kind)
          : limitedApprovalLevel(kind),
      );
  }
  return parsed.data;
}

function resolveLayers(entries: ConfigLayer[]): EffectiveConfig {
  let value = ConfigSchema.parse({});
  const sources: ConfigSources = {};
  for (const layer of entries) {
    value = applyLayer(value, layer);
    recordSource(sources, layerName(layer), layer.value);
  }
  const script = value.backends?.fake?.script;
  if (script) jsonByteLength(script, IoLimit.DataBytes);
  return { value, hash: hash(JSON.stringify(value)), sources };
}

export async function resolveConfig(options: ConfigResolution): Promise<EffectiveConfig> {
  return resolveLayers(await layers(options));
}

export async function validateConfigDocument(
  document: unknown,
  scope: ConfigScope,
  home: string,
  path?: string,
): Promise<EffectiveConfig> {
  const entries = [builtInLayer()];
  if (scope === ConfigScope.Project)
    entries.push(...(await fileLayer(ConfigSource.User, resolve(home, ConfigFile.User), false)));
  entries.push({
    source: scope === ConfigScope.User ? ConfigSource.User : ConfigSource.Project,
    path,
    value: document,
    limited: scope === ConfigScope.Project,
  });
  return resolveLayers(entries);
}

export const configJsonSchema = (): Record<string, unknown> =>
  z.toJSONSchema(ConfigSchema, { io: JsonSchemaDirection.Input });

export function assertNoSecrets(bytes: Uint8Array): void {
  createSecretScanner().accept(bytes);
}

export function createSecretScanner(
  environment: Record<string, string | undefined> = process.env,
): SecretScanner {
  const secrets = Object.entries(environment)
    .filter(([name, value]) => value && SecretEnvironmentPattern.test(name))
    .map(([name, value]) => ({ name, bytes: Buffer.from(value ?? TextSymbol.Empty) }));
  const overlap = Math.max(0, ...secrets.map((secret) => secret.bytes.length - 1));
  let tail = Buffer.alloc(0);
  return {
    accept(chunk) {
      const input = Buffer.concat([tail, chunk]);
      const secret = secrets.find((entry) => input.includes(entry.bytes));
      if (secret) throw new TitanError(ErrorCode.SecretValue, secretValue(secret.name));
      tail = Buffer.from(input.subarray(Math.max(0, input.length - overlap)));
    },
  };
}

export function agentHostEnvironment(
  markers: number,
  workers: number = ConfigDefault.HostWorkerThreads,
): Record<string, string | undefined> {
  return {
    ...process.env,
    [AgentHost.GcMarkersEnvironment]: String(markers),
    [AgentHost.WorkerThreadsEnvironment]: String(workers),
  };
}

export { describeRunConfiguration, readRunConfiguration } from "./frozen.ts";
export { detectHarness } from "./harness.ts";
export {
  nativeAgentEnvironment,
  nativeToolConnection,
  nativeToolEnvironment,
} from "./native-tools.ts";
export { settingOverrides } from "./setting-overrides.ts";
export { verificationEnvironment } from "./verification.ts";

export async function runtimeBuild(entry: string): Promise<string | null> {
  if (entry.endsWith(AgentHost.SourceExtension)) return null;
  return hash(await readFileBytes(entry, Packaging.BundleMaximumBytes));
}

export { matchesClaudeRegistration } from "./harness-registration.ts";
