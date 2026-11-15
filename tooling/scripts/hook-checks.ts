import {
  HookCheckCommands,
  HookCheckScope,
  HookDocumentationCheckCommands,
} from "@titan/constants";
import { HookMessage, hookCheckResult } from "@titan/messages";
import {
  type HookChange,
  HookChangesSchema,
  type HookReporter,
  type HookRunner,
} from "@titan/types";
import { checkHookPolicy } from "./hook-policy.ts";
import { verificationCommandStatus } from "./hook-process.ts";
import { hookScope } from "./hook-scope.ts";
import { scanSnapshotFiles } from "./hook-secrets.ts";
import { readWorkspaces } from "./workspaces.ts";

export async function checkHookSnapshot(
  directory: string,
  files: readonly string[],
  run: HookRunner = verificationCommandStatus,
  report: HookReporter = console.log,
  changes: readonly HookChange[] | null = null,
): Promise<number> {
  await checkHookPolicy(directory);
  const exitCode = await scanSnapshotFiles(directory, files);
  if (exitCode !== 0) return exitCode;
  const parsed = HookChangesSchema.safeParse(changes);
  const scope =
    parsed.success && parsed.data.length
      ? hookScope(
          parsed.data,
          (await readWorkspaces(directory)).map((owner) => owner.directory),
        )
      : HookCheckScope.Full;
  report(
    scope === HookCheckScope.Documentation ? HookMessage.DocumentationScope : HookMessage.FullScope,
  );
  const commands =
    scope === HookCheckScope.Documentation ? HookDocumentationCheckCommands : HookCheckCommands;
  for (const command of commands) {
    const started = performance.now();
    const code = await run(command, directory);
    report(hookCheckResult(command, code, performance.now() - started));
    if (code !== 0) return 1;
  }
  return exitCode;
}
