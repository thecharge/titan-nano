import type { CodexOptions, ThreadOptions } from "@openai/codex-sdk";
import { CodexDisabledFeatures, CodexPolicy } from "@titan/constants";
import type {
  AgentSpec,
  BackendLaunch,
  NativeToolBinding,
  NativeToolEnvironmentFactory,
} from "@titan/types";
import { codexNativeTools } from "./native-tools.ts";

export function codexThreadOptions(spec: AgentSpec): ThreadOptions {
  return {
    workingDirectory: spec.cwd,
    skipGitRepoCheck: true,
    sandboxMode: spec.writable ? CodexPolicy.WorkspaceWrite : CodexPolicy.ReadOnly,
    approvalPolicy: CodexPolicy.NeverApprove,
    networkAccessEnabled: false,
    webSearchMode: CodexPolicy.Disabled,
    ...(spec.model ? { model: spec.model } : {}),
  };
}

export function codexClientOptions(
  spec: AgentSpec,
  launch: BackendLaunch,
  binding?: NativeToolBinding,
  environment?: NativeToolEnvironmentFactory,
): CodexOptions {
  const native = binding ? codexNativeTools(binding, environment) : undefined;
  const config = {
    developer_instructions: spec.role,
    web_search: CodexPolicy.Disabled,
    features: CodexDisabledFeatures,
    ...(native ? { mcp_servers: native.servers } : {}),
  };
  return {
    ignoreUserConfig: true,
    config,
    ...(native ? { env: native.environment } : {}),
    ...(launch.executable ? { codexPathOverride: launch.executable } : {}),
  };
}
