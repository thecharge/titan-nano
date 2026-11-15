import { lstat, mkdir, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { matchesClaudeRegistration } from "@titan/config";
import {
  CliOption,
  CliRuntime,
  ErrorCode,
  ErrorField,
  ExitCode,
  FileErrorCode,
  FileOpenMode,
  Harness,
  HarnessPlugin,
  HarnessSkillDirectory,
  Packaging,
  ProbeOption,
  TitanRelease,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import {
  CliDiagnostic,
  CliMessage,
  existingSkill,
  installedSkill,
  missingRequired,
} from "@titan/messages";
import { atomicWrite, readBytes } from "@titan/streams";
import type { CliServices, CommandHandler } from "@titan/types";
import { sourceChunks } from "@titan/workspace";
import { renderGuide } from "../guide.ts";
import { checkPrerequisites } from "../prerequisites.ts";
import { modelStatus } from "./model.ts";

async function registrationExecutable(services: CliServices) {
  const executable = services.executable;
  if (!executable) return executable;
  const entry = resolve(executable[1]);
  const release = resolve(dirname(entry), Packaging.ReleaseFromBundle);
  if (
    basename(dirname(release)) !== Packaging.Releases ||
    !basename(release).startsWith(Packaging.ArchivePrefix) ||
    entry !== resolve(release, Packaging.InstalledPath, Packaging.Bundle)
  )
    return executable;
  const launcher = resolve(release, Packaging.InstallationFromRelease, HarnessPlugin.Command);
  try {
    if (!(await lstat(launcher)).isSymbolicLink()) return executable;
    const selected = await realpath(launcher);
    const selectedRelease = resolve(dirname(selected), Packaging.ReleaseFromBundle);
    if (
      dirname(selectedRelease) === dirname(release) &&
      basename(selectedRelease).startsWith(Packaging.ArchivePrefix) &&
      selected === resolve(selectedRelease, Packaging.InstalledPath, Packaging.Bundle)
    )
      return [executable[0], launcher] as const;
  } catch {}
  return executable;
}

async function writeFileAt(path: string, text: string, force: boolean): Promise<void> {
  if (!force && (await matchingFile(path, text))) return;
  if (force) return atomicWrite(path, text);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, Buffer.from(text), { flag: FileOpenMode.Exclusive });
}

async function matchingFile(path: string, text: string): Promise<boolean> {
  try {
    const metadata = await lstat(path);
    const expected = Buffer.from(text);
    if (!metadata.isFile() || metadata.size !== expected.length)
      throw new TitanError(ErrorCode.Exists, existingSkill(path));
    const bytes = await readBytes(sourceChunks(path, false), expected.length);
    if (!bytes.equals(expected)) throw new TitanError(ErrorCode.Exists, existingSkill(path));
    return true;
  } catch (error) {
    if (error instanceof Error && Reflect.get(error, ErrorField.Code) === FileErrorCode.Missing)
      return false;
    throw error;
  }
}

function pluginFiles(
  project: string,
  services: CliServices,
  home: string,
): readonly (readonly [string, string])[] {
  const folder = resolve(project, HarnessPlugin.Folder);
  return [
    [
      resolve(folder, HarnessPlugin.Manifest),
      JSON.stringify({
        name: HarnessPlugin.Server,
        description: CliDiagnostic.PluginDescription,
        version: TitanRelease,
      }),
    ],
    [
      resolve(folder, HarnessPlugin.McpFile),
      JSON.stringify({
        mcpServers: {
          [HarnessPlugin.Server]: {
            command: services.executable?.[0] ?? HarnessPlugin.Command,
            args: [
              ...(services.executable?.slice(1) ?? []),
              ...HarnessPlugin.Arguments,
              ProbeOption.Home,
              home,
            ],
          },
        },
      }),
    ],
  ];
}

async function registerMcp(
  harness: Harness,
  services: CliServices,
  project: string,
  home: string,
): Promise<string> {
  const codex = harness === Harness.Codex;
  const program = services.program(harness);
  if (program === null) return codex ? CliDiagnostic.McpSkipped : CliDiagnostic.ClaudeMcpSkipped;
  const executable = [
    ...(services.executable ?? [HarnessPlugin.Command]),
    ...HarnessPlugin.Arguments,
    ProbeOption.Home,
    home,
  ];
  const code = await services.launch(
    [program, ...(codex ? HarnessPlugin.CodexAdd : HarnessPlugin.ClaudeAdd), ...executable],
    services.environment,
    project,
  );
  const matching =
    !codex &&
    code !== ExitCode.Success &&
    (await matchesClaudeRegistration(project, executable, services.environment));
  return code === ExitCode.Success || matching
    ? HarnessPlugin.Server
    : codex
      ? CliDiagnostic.McpFailed
      : CliDiagnostic.ClaudeMcpFailed;
}

async function importAntigravity(services: CliServices, project: string): Promise<string> {
  const agy = services.program(HarnessPlugin.AntigravityProgram);
  if (agy === null) return CliDiagnostic.ImportSkipped;
  const code = await services.launch(
    [agy, ...HarnessPlugin.AntigravityImport, resolve(project, HarnessPlugin.Folder)],
    services.environment,
  );
  return code === ExitCode.Success ? HarnessPlugin.Server : CliDiagnostic.ImportFailed;
}

async function connect(
  harness: Harness,
  services: CliServices,
  project: string,
  home: string,
): Promise<string> {
  if (harness === Harness.Antigravity) return importAntigravity(services, project);
  return registerMcp(harness, services, project, home);
}

export const installSkill: CommandHandler = async ({ options, project, services, home }) => {
  const harness = options.harness;
  if (harness !== Harness.Codex && harness !== Harness.Claude && harness !== Harness.Antigravity)
    throw new TitanError(ErrorCode.Harness, CliMessage.HarnessRequired);
  const checks = checkPrerequisites(services, harness);
  const missing = checks.filter((check) => check.required && !check.ready);
  if (missing.length > 0)
    throw new TitanError(ErrorCode.Harness, missingRequired(missing.map((check) => check.name)));
  const force = options[CliOption.Force] === true;
  const path = resolve(project, HarnessSkillDirectory[harness], CliRuntime.SkillFile);
  const skill = installedSkill(await renderGuide());
  const registeredServices = {
    ...services,
    executable: await registrationExecutable(services),
  };
  const files: (readonly [string, string])[] = [
    [path, skill],
    ...(harness === Harness.Claude
      ? [
          [
            resolve(project, HarnessPlugin.Folder, HarnessPlugin.PluginSkill, CliRuntime.SkillFile),
            skill,
          ] as const,
        ]
      : []),
    ...(harness === Harness.Codex ? [] : pluginFiles(project, registeredServices, home)),
  ];
  if (!force) for (const [target, text] of files) await matchingFile(target, text);
  const model = await modelStatus(services, home, options[CliOption.NoModel] !== true);
  for (const [target, text] of files) await writeFileAt(target, text, force);
  const mcp = await connect(harness, registeredServices, project, home);
  const failed = [
    CliDiagnostic.McpFailed,
    CliDiagnostic.ClaudeMcpFailed,
    CliDiagnostic.ImportFailed,
  ].some((failure) => failure === mcp);
  return {
    data: {
      model,
      installed: path,
      mcp,
      prerequisites: checks,
      next: CliDiagnostic.InstallNext,
    },
    exitCode: failed ? ExitCode.Unsuccessful : ExitCode.Success,
  };
};
