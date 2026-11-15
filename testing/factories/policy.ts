import { readdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { PolicyStore } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { policyKind, policyPath, recordPolicyRun, runReward } from "@titan/knowledge";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { ConfigSchema, type PolicyRun, type RewardInput } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";

export async function workflowPolicyFile(workflow: unknown, runs: PolicyRun[]) {
  try {
    const kind = policyKind(validateWorkflow(workflow).workflow.policy);
    return await withTemporaryDirectory(async (home) => {
      for (const run of runs) await recordPolicyRun(home, kind, run);
      const files = await readdir(dirname(policyPath(home, kind)));
      const content = JSON.parse(await readFile(policyPath(home, kind), "utf8"));
      return { ok: true, files, runs: content.runs };
    });
  } catch (error) {
    if (error instanceof TitanError) return { ok: false, code: error.code };
    throw error;
  }
}

export async function recordedReward(input: RewardInput, config: unknown) {
  const parsed = ConfigSchema.safeParse(config);
  if (!parsed.success) return { ok: false, path: parsed.error.issues[0]?.path.join(".") };
  return withTemporaryDirectory(async (home) => {
    const reward = runReward(input, parsed.data.policy);
    await recordPolicyRun(home, PolicyStore.General, { run: "r1", choices: {}, reward });
    const content = JSON.parse(await readFile(policyPath(home, PolicyStore.General), "utf8"));
    return { ok: true, reward: content.runs[0].reward };
  });
}
