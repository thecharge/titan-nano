import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getDefaultWritePaths, SandboxRuntimeConfigSchema } from "@anthropic-ai/sandbox-runtime";
import { ClaudeSandbox, ErrorCode, VendorPackage, WorkspaceMode } from "@titan/constants";
import { nativeWritableFiles } from "@titan/core";
import { OperationalError } from "@titan/errors";
import { NativeToolMessage } from "@titan/messages";
import { type AgentSpec, ClaudeBashInputSchema, type JsonSchema, ObjectSchema } from "@titan/types";

function quote(value: string): string {
  return (
    ClaudeSandbox.Quote +
    value.replaceAll(ClaudeSandbox.Quote, ClaudeSandbox.EscapedQuote) +
    ClaudeSandbox.Quote
  );
}

export class ClaudeShellSandbox {
  private directory: Promise<string> | undefined;
  private commands = new Set<string>();
  private commandBytes = 0;
  constructor(private spec: AgentSpec) {}

  private async settings(): Promise<string> {
    const files = await nativeWritableFiles(this.spec);
    const directory = await mkdtemp(resolve(tmpdir(), ClaudeSandbox.Prefix));
    try {
      await writeFile(
        resolve(directory, ClaudeSandbox.Settings),
        JSON.stringify(
          SandboxRuntimeConfigSchema.parse({
            network: { allowedDomains: [], deniedDomains: [] },
            filesystem: {
              allowWrite: files.map((path) => ({
                path: resolve(this.spec.cwd, path),
                literal: true,
              })),
              denyWrite: getDefaultWritePaths()
                .filter((path) => !path.startsWith(ClaudeSandbox.Devices))
                .map((path) => ({ path, literal: true })),
              denyRead: [],
            },
          }),
        ),
        { mode: WorkspaceMode.PrivateFile },
      );
      return directory;
    } catch (error) {
      await rm(directory, { recursive: true, force: true });
      throw error;
    }
  }

  known(input: unknown): boolean {
    const parsed = ClaudeBashInputSchema.safeParse(input);
    return parsed.success && this.commands.has(parsed.data.command);
  }

  async wrap(input: unknown): Promise<JsonSchema> {
    const parsed = ClaudeBashInputSchema.parse(input);
    if (this.commands.size >= ClaudeSandbox.MaximumCommands)
      throw new OperationalError(ErrorCode.Capacity, NativeToolMessage.ReadCapacity);
    this.directory ??= this.settings();
    const directory = await this.directory;
    const cli = fileURLToPath(
      new URL(ClaudeSandbox.Cli, import.meta.resolve(VendorPackage.Sandbox)),
    );
    const command = [
      process.execPath,
      cli,
      ClaudeSandbox.SettingsArgument,
      resolve(directory, ClaudeSandbox.Settings),
      ClaudeSandbox.CommandArgument,
      parsed.command,
    ]
      .map(quote)
      .join(ClaudeSandbox.Space);
    const bytes = Buffer.byteLength(command);
    if (
      bytes > ClaudeSandbox.MaximumCommandBytes ||
      this.commandBytes + bytes > ClaudeSandbox.MaximumRegistryBytes
    )
      throw new OperationalError(ErrorCode.Capacity, NativeToolMessage.ReadCapacity);
    this.commands.add(command);
    this.commandBytes += bytes;
    return { ...ObjectSchema.parse(input), command };
  }

  async close(): Promise<void> {
    const directory = await this.directory?.catch(() => undefined);
    if (directory) await rm(directory, { recursive: true, force: true });
    this.commands.clear();
    this.commandBytes = 0;
  }
}
