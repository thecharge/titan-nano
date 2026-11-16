import { readdir, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { HookFile, ScriptSandbox } from "@titan/constants";
import { ScriptSandboxMessage } from "@titan/messages";
import { ScriptSandboxInventorySchema } from "@titan/types";

export function verifySandboxFiles(names: readonly string[]): void {
  if (
    names.some((name) =>
      ScriptSandbox.Source.RemovedFiles.some((removed) => basename(name) === removed),
    )
  )
    throw new Error(ScriptSandboxMessage.Distribution);
}

export async function verifySandboxDistribution(
  directory: string,
  linux = process.platform === ScriptSandbox.Linux,
  root = resolve(import.meta.dir, HookFile.RepositoryRoot),
): Promise<void> {
  const source = ScriptSandbox.Source;
  verifySandboxFiles(await readdir(directory, { recursive: true }));
  if (!linux) return;
  for (const name of [
    ScriptSandbox.Binary,
    source.LicenseOutput,
    source.NoticesOutput,
    source.InventoryOutput,
    source.Archive,
  ]) {
    const entry = await stat(resolve(directory, name));
    if (!entry.isFile() || !entry.size) throw new Error(ScriptSandboxMessage.Distribution);
  }
  const inventory = ScriptSandboxInventorySchema.parse(
    await Bun.file(resolve(directory, source.InventoryOutput)).json(),
  );
  const expected = ScriptSandboxInventorySchema.parse(
    await Bun.file(resolve(root, source.Inventory)).json(),
  );
  if (JSON.stringify(inventory) !== JSON.stringify(expected))
    throw new Error(ScriptSandboxMessage.Distribution);
  const notices = await Bun.file(resolve(directory, source.NoticesOutput)).text();
  if (
    inventory.source_sha256 !== source.Sha256 ||
    inventory.components.some(
      (component) =>
        !notices.includes(
          component.name + ScriptSandbox.Source.NoticeSeparator + component.version,
        ),
    )
  )
    throw new Error(ScriptSandboxMessage.Distribution);
}
