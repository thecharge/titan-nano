import { appendFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ExitCode, FakeCodexInstall, HarnessPlugin, InstallPart } from "@titan/constants";

const [area, action, name] = Bun.argv.slice(2);
const home = process.env[HarnessPlugin.CodexHome] ?? "";
const servers = resolve(home, FakeCodexInstall.Servers);
const status = Number(process.env[FakeCodexInstall.ExitVariable] ?? ExitCode.Success);

if (area === InstallPart.Mcp && action === FakeCodexInstall.Add) {
  await writeFile(resolve(home, InstallPart.Calls), `${Bun.argv.slice(2).join(" ")}\n`);
  if (status === ExitCode.Success) await appendFile(servers, `${name}\n`);
  process.exit(status);
}
if (area === InstallPart.Mcp && action === InstallPart.List) {
  const file = Bun.file(servers);
  if (await file.exists()) process.stdout.write(await file.text());
  process.exit(ExitCode.Success);
}
process.exit(FakeCodexInstall.Unknown);
