import { resolve } from "node:path";
import { loadData } from "@titan/config";
import {
  CliCommand,
  CliRuntime,
  DataKind,
  Harness,
  HarnessPlugin,
  IoLimit,
  Newline,
  PrerequisiteName,
  RunArtifactFile,
  RunStatus,
  TitanRelease,
} from "@titan/constants";
import { jsonByteLength } from "@titan/core";
import { loadKnowledge } from "@titan/knowledge";
import {
  CliDiagnostic,
  doctorBackendsLine,
  doctorBackupLine,
  doctorHarnessLine,
  doctorHomeLine,
  doctorLiveLine,
  doctorProjectLine,
  doctorRuntimeLine,
  doctorToolLine,
  installedGuideLine,
  prerequisiteLine,
  readyModelLine,
} from "@titan/messages";
import {
  fetchLocalModel,
  improveEarlierRun,
  inspectLocalModel,
  serveUntilStopped,
} from "@titan/runtime";
import { createRunClient } from "@titan/server/client";
import { createDashboardClient } from "@titan/server/dashboard-client";
import { createKnowledgeClient } from "@titan/server/knowledge";
import { startMcp } from "@titan/server/mcp";
import { serveNativeToolServer } from "@titan/server/native-tool-bridge";
import { createRequestClient } from "@titan/server/requests";
import {
  type CliOutputContext,
  type CliServices,
  DoctorResultSchema,
  InstallResultSchema,
  RunSnapshotSchema,
} from "@titan/types";
import { daemonEntry, ensureDaemon } from "./daemon.ts";
import { knownHomes, rememberHome } from "./known-homes.ts";
import { handoff, launch } from "./launch.ts";
import { outputEnvelope } from "./output.ts";
import { recoverRunRuntime, recoverRuntimeConnection } from "./runtime-recovery.ts";
import { sdkInstalled } from "./sdk.ts";
import { writeStdoutLine } from "./stdout.ts";
import { prepareSubmission } from "./submissions.ts";
import { runAutomaticUpdate } from "./update-install.ts";
import { checkUpdateNotice } from "./updates.ts";

export function renderOutput(value: unknown, json: boolean, write = console.log): void {
  write(
    json
      ? JSON.stringify(value)
      : typeof value === DataKind.String
        ? value
        : JSON.stringify(value, null, 2),
  );
  if (json) return;
  const run = RunSnapshotSchema.safeParse(value);
  if (run.success && (run.data.state === RunStatus.Passed || run.data.state === RunStatus.Failed))
    write(resolve(run.data.root, RunArtifactFile.Result));
}
export function renderCommandOutput(
  value: unknown,
  json: boolean,
  context?: CliOutputContext,
  write = console.log,
): void {
  const installation = InstallResultSchema.safeParse(value);
  if (!json && context?.operation === CliCommand.Install && installation.success) {
    const result = installation.data;
    write(
      [
        installedGuideLine(result.installed),
        result.mcp === HarnessPlugin.Server ? CliDiagnostic.McpReady : result.mcp,
        result.model.ready ? readyModelLine(result.model.name) : CliDiagnostic.ModelSetup,
        ...result.prerequisites.map((check) =>
          prerequisiteLine(check.name, check.ready, check.repair),
        ),
        result.next,
      ].join(Newline),
    );
    return;
  }
  const doctor = DoctorResultSchema.safeParse(value);
  if (!json && context?.operation === CliCommand.Doctor && doctor.success) {
    const result = doctor.data;
    write(
      [
        doctorHomeLine(result.home),
        doctorProjectLine(result.project),
        doctorHarnessLine(result.harness),
        doctorRuntimeLine(PrerequisiteName.Bun, result.bun),
        doctorRuntimeLine(CliRuntime.Node, result.node),
        doctorRuntimeLine(Harness.Codex, result.codex),
        doctorRuntimeLine(Harness.Claude, result.claude),
        ...Object.entries(result.tools).map(([name, status]) => doctorToolLine(name, status)),
        ...result.prerequisites.map((check) =>
          prerequisiteLine(check.name, check.ready, check.repair),
        ),
        result.model.ready ? readyModelLine(result.model.name) : CliDiagnostic.ModelSetup,
        doctorLiveLine(result.live_checks),
        doctorBackendsLine(result.supported),
        ...(result.backup
          ? [
              doctorBackupLine(
                result.backup.backup.version,
                result.backup.catalog.runs.length,
                result.backup.catalog.projects.length,
              ),
            ]
          : []),
      ].join(Newline),
    );
    return;
  }
  renderOutput(json ? boundedJsonOutput(value, context) : value, json, write);
}

function boundedJsonOutput(value: unknown, context?: CliOutputContext): unknown {
  const rendered =
    context && context.operation !== CliCommand.Serve ? outputEnvelope(value, context) : value;
  jsonByteLength(rendered, IoLimit.ResponseBytes);
  return rendered;
}

function runtimeConnection(home: string) {
  let recorded: Promise<void> | undefined;
  return {
    connect: async () => {
      recorded ??= recordHome(home);
      await recorded;
      await ensureDaemon(home);
    },
    recover: (version: string, build?: string) =>
      recoverRuntimeConnection(home, version, defaultServices, undefined, build),
  };
}

async function recordHome(home: string): Promise<void> {
  await rememberHome(home).catch((error: unknown) => {
    console.error(CliDiagnostic.HomeRegistryUnavailable, String(error));
  });
}

export const defaultServices: CliServices = {
  updateNotice: checkUpdateNotice,
  autoUpdate: runAutomaticUpdate,
  handoff,
  recoverRuntime: recoverRunRuntime,
  inspectModel: inspectLocalModel,
  fetchModel: fetchLocalModel,
  notice: (text) => console.error(text),
  prepareSubmission,
  loadData,
  loadKnowledge,
  knowledge: (home) => createKnowledgeClient(home, runtimeConnection(home).connect),
  output: (value, json, context) => {
    if (json && context?.operation !== CliCommand.Serve)
      return writeStdoutLine(JSON.stringify(boundedJsonOutput(value, context)));
    if (!json && typeof value === DataKind.String) return writeStdoutLine(String(value));
    renderCommandOutput(value, json, context);
  },
  knownHomes,
  existingRunClient: (home) => createRunClient(home),
  client: (home) => {
    const connection = runtimeConnection(home);
    return createRunClient(home, connection.connect, connection.recover);
  },
  requests: (home) => {
    const connection = runtimeConnection(home);
    return createRequestClient(home, connection.connect, connection.recover);
  },
  dashboard: (home) => createDashboardClient(home, runtimeConnection(home).connect),
  improve: improveEarlierRun,
  serve: async (home, ...args) => {
    await recordHome(home);
    return serveUntilStopped(home, ...args);
  },
  mcp: async (home) => {
    const connection = runtimeConnection(home);
    await connection.connect();
    return startMcp(home, undefined, connection.connect, connection.recover);
  },
  toolServer: serveNativeToolServer,
  wait: (milliseconds) => Bun.sleep(milliseconds),
  launch,
  executable: [process.execPath, daemonEntry()],
  program: (name) => Bun.which(name),
  sdk: sdkInstalled,
  environment: process.env,
  cwd: () => process.cwd(),
  version: TitanRelease,
  runtimeVersion: Bun.version,
};
