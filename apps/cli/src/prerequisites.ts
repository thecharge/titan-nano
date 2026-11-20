import {
  HarnessCommands,
  KnowledgeMeaningLocal,
  KnowledgeMemoryDatabase,
  MinimumBunVersion,
  OptionalPrerequisites,
  PrerequisiteName,
  RequiredPrerequisites,
} from "@titan/constants";
import { openVectorIndex } from "@titan/knowledge";
import { harnessRepair, prerequisiteRepair, sqliteVectorRepair } from "@titan/messages";
import type { CliServices, PrerequisiteStatus } from "@titan/types";
import { compareRelease, releaseVersion } from "./updates.ts";

function supportedBun(version: string): boolean {
  const installed = releaseVersion(version);
  const minimum = releaseVersion(MinimumBunVersion);
  return installed !== null && minimum !== null && compareRelease(installed, minimum) >= 0;
}

function status(
  name: string,
  required: boolean,
  ready: boolean,
  repair: string,
): PrerequisiteStatus {
  return { name, required, ready, repair: ready ? null : repair };
}

export function checkPrerequisites(
  services: CliServices,
  harness: string | null,
): PrerequisiteStatus[] {
  const tools = [...RequiredPrerequisites, ...OptionalPrerequisites].map((name) => {
    const required = RequiredPrerequisites.some((item) => item === name);
    const ready =
      name === PrerequisiteName.Bun
        ? supportedBun(services.runtimeVersion)
        : services.program(name) !== null;
    return status(name, required, ready, prerequisiteRepair[name]);
  });
  const agent = HarnessCommands.filter((entry) => String(entry.harness) === harness).map((entry) =>
    status(
      entry.command,
      false,
      services.program(entry.command) !== null,
      harnessRepair(entry.command),
    ),
  );
  return [...tools, ...agent];
}

export async function checkSqliteVector(load = openVectorIndex): Promise<PrerequisiteStatus> {
  try {
    const index = await load(KnowledgeMemoryDatabase);
    await index.close();
    return { name: KnowledgeMeaningLocal.SqliteVec, required: false, ready: true, repair: null };
  } catch {
    return status(
      KnowledgeMeaningLocal.SqliteVec,
      false,
      false,
      sqliteVectorRepair(process.platform, process.arch),
    );
  }
}
