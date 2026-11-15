import { resolve } from "node:path";
import { HookFile, HookMode } from "@titan/constants";
import { checkHook } from "./check-hook.ts";
import { reportHookFailure } from "./hook-process.ts";

try {
  process.exitCode = await checkHook(
    HookMode.Commit,
    resolve(import.meta.dir, HookFile.RepositoryRoot),
  );
} catch (error) {
  process.exitCode = await reportHookFailure(error);
}
