import { join } from "node:path";
import { CiPolicy, FileEncoding, HookFile, IoLimit } from "@titan/constants";
import { HookMessage } from "@titan/messages";
import { readFileBytes } from "@titan/streams";
import {
  CiPolicySchema,
  CommitPolicySchema,
  HookPolicySchema,
  SecretPolicySchema,
} from "@titan/types";

export async function validCiPolicy(input: unknown): Promise<boolean> {
  return CiPolicySchema.safeParse(input).success;
}

export async function validHookPolicy(input: unknown): Promise<boolean> {
  return HookPolicySchema.safeParse(input).success;
}

export async function checkHookPolicy(directory: string): Promise<void> {
  const hooks = Bun.YAML.parse(
    (await readFileBytes(join(directory, HookFile.Configuration), IoLimit.DataBytes)).toString(
      FileEncoding.Utf8,
    ),
  );
  const workflows: string[] = [];
  for await (const file of new Bun.Glob(CiPolicy.WorkflowPattern).scan({
    cwd: directory,
    dot: true,
    onlyFiles: false,
  })) {
    workflows.push(file);
    break;
  }
  const secrets = JSON.parse(
    (await readFileBytes(join(directory, HookFile.Secrets), IoLimit.DataBytes)).toString(
      FileEncoding.Utf8,
    ),
  );
  const commits = JSON.parse(
    (await readFileBytes(join(directory, HookFile.Commitlint), IoLimit.DataBytes)).toString(
      FileEncoding.Utf8,
    ),
  );
  if (
    !(await validHookPolicy(hooks)) ||
    !(await validCiPolicy(workflows)) ||
    !SecretPolicySchema.safeParse(secrets).success ||
    !CommitPolicySchema.safeParse(commits).success
  ) {
    throw new Error(HookMessage.InvalidPolicy);
  }
}
