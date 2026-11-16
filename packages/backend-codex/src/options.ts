import type { CodexOptions, ThreadOptions } from "@openai/codex-sdk";
import { CodexDisabledFeatures, CodexPolicy, NativeWritePolicy, PathPart } from "@titan/constants";
import { nativeWriteRole } from "@titan/messages";
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
    ...(!spec.file_scope
      ? { sandboxMode: spec.writable ? CodexPolicy.WorkspaceWrite : CodexPolicy.ReadOnly }
      : {}),
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
  files: readonly string[] = [],
): CodexOptions {
  const native = binding ? codexNativeTools(binding, environment) : undefined;
  const config = {
    developer_instructions:
      spec.writable && spec.file_scope && binding ? nativeWriteRole(spec.role) : spec.role,
    web_search: CodexPolicy.Disabled,
    features: CodexDisabledFeatures,
    ...(native ? { mcp_servers: native.servers } : {}),
  };
  return {
    ignoreUserConfig: true,
    config,
    ...(spec.file_scope ? { configOverrides: scopedPermissions(files) } : {}),
    ...(native ? { env: native.environment } : {}),
    ...(launch.executable ? { codexPathOverride: launch.executable } : {}),
  };
}

function scopedPermissions(files: readonly string[]): string[] {
  const paths = [
    [PathPart.Current, NativeWritePolicy.Read],
    ...files.flatMap((path) => [
      [path, NativeWritePolicy.Write],
      ...NativeWritePolicy.Metadata.map((name) => [
        path + PathPart.Separator + name,
        NativeWritePolicy.Write,
      ]),
    ]),
  ];
  const entries = paths
    .map(
      ([path, access]) =>
        JSON.stringify(path) + NativeWritePolicy.Assignment + JSON.stringify(access),
    )
    .join(NativeWritePolicy.Separator);
  return [
    NativeWritePolicy.Default,
    NativeWritePolicy.Filesystem +
      NativeWritePolicy.Open +
      JSON.stringify(NativeWritePolicy.Root) +
      NativeWritePolicy.Assignment +
      JSON.stringify(NativeWritePolicy.Read) +
      NativeWritePolicy.Separator +
      JSON.stringify(NativeWritePolicy.Workspace) +
      NativeWritePolicy.Assignment +
      NativeWritePolicy.Open +
      entries +
      NativeWritePolicy.Close +
      NativeWritePolicy.Close,
    NativeWritePolicy.Network,
  ];
}
