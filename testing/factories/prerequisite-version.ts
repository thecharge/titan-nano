import { PrerequisiteName } from "@titan/constants";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { checkPrerequisites } from "../../apps/cli/src/prerequisites.ts";

export function bunReadiness(runtimeVersion: string): boolean | undefined {
  return checkPrerequisites({ ...defaultServices, runtimeVersion, program: () => null }, null).find(
    (status) => status.name === PrerequisiteName.Bun,
  )?.ready;
}
