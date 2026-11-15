import { resolve } from "node:path";
import { FileEncoding, HookFile, IoLimit, LintPolicy } from "@titan/constants";
import { invalidLintPolicy, lintPolicySummary } from "@titan/messages";
import { readFileBytes } from "@titan/streams";
import { LintPolicySchema } from "@titan/types";

export async function validLintPolicy(input: unknown): Promise<boolean> {
  return LintPolicySchema.safeParse(input).success;
}

export async function checkLintPolicy(
  root = resolve(import.meta.dir, HookFile.RepositoryRoot),
): Promise<number> {
  try {
    const bytes = await readFileBytes(resolve(root, LintPolicy.File), IoLimit.DataBytes);
    if (await validLintPolicy(JSON.parse(bytes.toString(FileEncoding.Utf8)))) {
      console.log(lintPolicySummary);
      return 0;
    }
  } catch {
    console.error(invalidLintPolicy);
    return 1;
  }
  console.error(invalidLintPolicy);
  return 1;
}

if (import.meta.main) process.exitCode = await checkLintPolicy();
