import { settingOverrides } from "@titan/config";
import { Backend, CliOption, ErrorCode, HarnessBackends } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { CliDiagnostic, unsupportedBackend } from "@titan/messages";
import type { CliOptions } from "@titan/types";

export function cliSettingOverrides(
  options: CliOptions,
  script?: unknown,
): Record<string, unknown> {
  if (options.backend !== undefined && options.harness !== undefined)
    throw new TitanError(ErrorCode.Arguments, CliDiagnostic.BackendConflict);
  const harness = Object.entries(HarnessBackends).find(([name]) => name === options.harness)?.[1];
  if (options.harness !== undefined && !harness)
    throw new TitanError(ErrorCode.Backend, unsupportedBackend(options.harness));
  const backend = options.backend ?? harness;
  const fake = { script };
  const backends = { [Backend.Fake]: fake };
  const limits = { max_parallel: Number(options[CliOption.MaxParallel]) };
  const defaults = { backend };
  return settingOverrides(options.set, {
    ...(options[CliOption.MaxParallel] ? { limits } : {}),
    ...(backend ? { defaults } : {}),
    ...(script !== undefined ? { backends } : {}),
  });
}
