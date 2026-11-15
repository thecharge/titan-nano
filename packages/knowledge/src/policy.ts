import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { PolicyDefault, PolicyStore } from "@titan/constants";
import {
  type PolicyFile,
  PolicyFileSchema,
  type PolicyKindHolder,
  PolicyKindSchema,
  type PolicyRun,
  type PolicyWeights,
  type RewardInput,
} from "@titan/types";
import { knowledgeDirectory, optionalKnowledgeBytes } from "./files.ts";

export function runReward(input: RewardInput, weights: PolicyWeights = {}): number {
  const share =
    input.verdict === undefined
      ? input.results === 0
        ? 0
        : input.survived / input.results
      : Number(input.verdict);
  const timeWeight = weights.w_time ?? PolicyDefault.TimeWeight;
  const agentWeight = weights.w_agent ?? PolicyDefault.AgentWeight;
  const reward = share - timeWeight * input.criticalMinutes - agentWeight * input.agents;
  return Math.round(reward * PolicyDefault.Scale) / PolicyDefault.Scale;
}

export function policyKind(policy: PolicyKindHolder | undefined): string {
  return policy?.kind ?? PolicyStore.General;
}

export function policyPath(home: string, kind: string): string {
  return join(home, PolicyStore.Directory, PolicyKindSchema.parse(kind) + PolicyStore.Extension);
}

export async function readPolicy(home: string, kind: string): Promise<PolicyFile> {
  const bytes = await optionalKnowledgeBytes(policyPath(home, kind), PolicyDefault.FileLimit);
  return bytes === null ? { kind, runs: [] } : PolicyFileSchema.parse(JSON.parse(bytes.toString()));
}

export async function recordPolicyRun(
  home: string,
  kind: string,
  run: PolicyRun,
): Promise<PolicyFile> {
  const policy = await readPolicy(home, kind);
  if (policy.runs.some((entry) => entry.run === run.run)) return policy;
  const next = { kind, runs: [...policy.runs, run] };
  const path = policyPath(home, kind);
  await knowledgeDirectory(dirname(path));
  await writeFile(path, JSON.stringify(next, null, PolicyStore.Indent));
  return next;
}
