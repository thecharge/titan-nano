import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { resolveCommand } from "../../apps/cli/src/catalog.ts";

const GuidePath = resolve(import.meta.dir, "../../docs/install.md");
const CommandPattern = /`titan ([a-z][^`]*)`/g;
const Splitter = " ";

export async function installGuideCommands(text: string | null): Promise<boolean> {
  const source = text ?? (await Bun.file(GuidePath).text());
  const commands = [...source.matchAll(CommandPattern)].map((match) => match[1] ?? "");
  assert.ok(commands.length >= 1);
  for (const command of commands) {
    assert.ok(resolveCommand(command.split(Splitter)).definition?.handler, command);
  }
  return true;
}
