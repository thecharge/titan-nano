import { configJsonSchema, detectHarness } from "@titan/config";
import {
  Backend,
  backendIds,
  CliOption,
  CliRuntime,
  CliSchema,
  ExitCode,
  Harness,
  HarnessCommands,
  HarnessSdk,
  HarnessSdkOwners,
} from "@titan/constants";
import {
  CliDiagnostic,
  experimentalBackend,
  harnessLine,
  harnessNone,
  toolLine,
} from "@titan/messages";
import type { CliServices, CommandHandler } from "@titan/types";
import { renderGuide, schemaText } from "../guide.ts";
import { checkPrerequisites, checkSqliteVector } from "../prerequisites.ts";
import { verifyUpdateBackup } from "../update-backup.ts";
import { modelStatus } from "./model.ts";

const sdkName = (harness: string): string =>
  HarnessSdkOwners.find((item) => item.sdk.includes(harness))?.sdk ?? HarnessSdk.Antigravity;

function doctorHarness(services: CliServices): string {
  try {
    const found = detectHarness({
      env: services.environment,
      found: HarnessCommands.filter((entry) => services.program(entry.command) !== null).map(
        (entry) => entry.command,
      ),
    });
    return harnessLine(found.harness, found.detectedBy);
  } catch {
    return harnessNone;
  }
}

export const inspectHandlers = {
  guide: async () => ({ data: await renderGuide(), exitCode: ExitCode.Success }),
  schema: async ({ positionals: [argument] }) => ({
    data: argument === CliSchema.Config ? configJsonSchema() : JSON.parse(schemaText()),
    exitCode: ExitCode.Success,
  }),
  backends: async () => ({
    data: backendIds.map((id) => ({
      id,
      ready: id === Backend.Fake,
      status: id === Backend.Fake ? CliDiagnostic.Stub : CliDiagnostic.LivePending,
    })),
    exitCode: ExitCode.Success,
  }),
  doctor: async ({ home, project, services, options }) => ({
    data: {
      ...(options.backup ? { backup: await verifyUpdateBackup(options.backup) } : {}),
      model: await modelStatus(services, home, options[CliOption.FetchModel] === true),
      harness: doctorHarness(services),
      tools: Object.fromEntries(
        HarnessCommands.map((entry) => [
          entry.harness,
          toolLine(services.program(entry.command) !== null, services.sdk(sdkName(entry.harness))),
        ]),
      ),
      prerequisites: [...checkPrerequisites(services, null), await checkSqliteVector()],
      bun: services.runtimeVersion,
      node: services.program(CliRuntime.Node),
      codex: services.program(Harness.Codex),
      claude: services.program(Harness.Claude),
      home,
      project,
      live_checks: CliDiagnostic.NotRun,
      supported: [experimentalBackend(Backend.Codex), experimentalBackend(Backend.Claude)],
    },
    exitCode: ExitCode.Success,
  }),
} satisfies Record<string, CommandHandler>;
