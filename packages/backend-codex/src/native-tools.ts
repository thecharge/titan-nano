import {
  CodexNativeToolReadiness,
  ErrorCode,
  NativeTool,
  NativeToolEnvironment,
  NativeToolPolicy,
  NativeToolTransport,
} from "@titan/constants";
import { OperationalError } from "@titan/errors";
import { NativeToolBridgeMessage } from "@titan/messages";
import type { NativeToolBinding, NativeToolEnvironmentFactory } from "@titan/types";

export function codexNativeTools(
  binding: NativeToolBinding,
  environment?: NativeToolEnvironmentFactory,
) {
  if (!environment)
    throw new OperationalError(ErrorCode.PermissionDenied, NativeToolBridgeMessage.Startup);
  const transport =
    binding.transport === NativeToolTransport.Http
      ? { url: binding.connection.url, bearer_token_env_var: NativeToolEnvironment.Token }
      : {
          command: binding.launch.command,
          args: binding.launch.args,
          env_vars: Object.values(NativeToolEnvironment),
        };
  const servers = {
    [NativeTool.Name]: {
      ...transport,
      required: true,
      startup_readiness: CodexNativeToolReadiness,
      startup_timeout_sec: binding.connection.timeout_ms / 1000,
      tool_timeout_sec: binding.connection.timeout_ms / 1000,
      enabled_tools: [...NativeToolPolicy[binding.connection.scope.role]],
    },
  };
  return { environment: environment(binding.connection), servers };
}
