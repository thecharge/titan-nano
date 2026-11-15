import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ConfigFile, WorkspaceModeSetting } from "@titan/constants";

export const isolatedWorkspace = { workspace: { mode: WorkspaceModeSetting.Isolated } } as const;

export async function writeIsolatedHome(home: string): Promise<void> {
  await mkdir(home, { recursive: true });
  await writeFile(resolve(home, ConfigFile.User), Buffer.from(JSON.stringify(isolatedWorkspace)));
}
