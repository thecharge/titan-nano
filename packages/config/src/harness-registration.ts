import { lstat, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import {
  EnvVar,
  ErrorField,
  FileErrorCode,
  HarnessPlugin,
  IoLimit,
  WorkspaceFile,
} from "@titan/constants";
import { readFileBytes } from "@titan/streams";
import { ClaudeLocalConfigurationSchema, ClaudeStdioRegistrationSchema } from "@titan/types";

async function projectRoot(project: string): Promise<string> {
  const original = await realpath(project);
  let folder = original;
  for (let depth = 0; depth < HarnessPlugin.ParentLimit; depth++) {
    try {
      await lstat(resolve(folder, WorkspaceFile.Git));
      return folder;
    } catch (error) {
      if (
        !(error instanceof Error) ||
        Reflect.get(error, ErrorField.Code) !== FileErrorCode.Missing
      )
        throw error;
    }
    const parent = dirname(folder);
    if (parent === folder) return original;
    folder = parent;
  }
  return original;
}

export async function matchesClaudeRegistration(
  project: string,
  executable: readonly string[],
  environment: Record<string, string | undefined> = process.env,
): Promise<boolean> {
  try {
    const configured = environment[HarnessPlugin.ClaudeConfigHome];
    const file = resolve(
      project,
      configured ?? environment[EnvVar.Home] ?? homedir(),
      HarnessPlugin.ClaudeConfiguration,
    );
    const configuration = ClaudeLocalConfigurationSchema.parse(
      JSON.parse((await readFileBytes(file, IoLimit.DataBytes)).toString()),
    );
    const selected = configuration.projects[await projectRoot(project)];
    if (selected?.disabledMcpServers?.includes(HarnessPlugin.Server)) return false;
    const parsed = ClaudeStdioRegistrationSchema.safeParse(
      selected?.mcpServers?.[HarnessPlugin.Server],
    );
    return (
      parsed.success &&
      Object.keys(parsed.data.env).length === 0 &&
      JSON.stringify([parsed.data.command, ...parsed.data.args]) === JSON.stringify(executable)
    );
  } catch {
    return false;
  }
}
