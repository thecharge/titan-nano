import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ErrorCode, FileEncoding, LeanCheck, ProofAnswer } from "@titan/constants";
import { all } from "@titan/core";
import { OperationalError } from "@titan/errors";
import { leanTimeLimit } from "@titan/messages";
import {
  type CommandCapture,
  type LeanInput,
  LeanInputSchema,
  type LeanParsed,
  type LeanRun,
  type ScriptCheckAnswer,
} from "@titan/types";

async function populate(folder: string, input: LeanParsed): Promise<void> {
  const manifest = {
    challenge_module: LeanCheck.ChallengeModule,
    solution_module: LeanCheck.SolutionModule,
    theorem_names: input.theorems,
    permitted_axioms: LeanCheck.Axioms,
  };
  await all([
    () => writeFile(join(folder, LeanCheck.ToolchainFile), LeanCheck.Toolchain),
    () => writeFile(join(folder, LeanCheck.LakefileName), LeanCheck.Lakefile),
    () => writeFile(join(folder, LeanCheck.ChallengeFile), input.statement),
    () => writeFile(join(folder, LeanCheck.SolutionFile), input.solution),
    () =>
      writeFile(
        join(folder, LeanCheck.ComparatorFile),
        JSON.stringify(manifest, null, LeanCheck.JsonIndent),
      ),
  ]);
}

function answered(capture: CommandCapture): ScriptCheckAnswer {
  const evidence = Buffer.concat([capture.stdout, capture.stderr]).toString(FileEncoding.Utf8);
  const proven = capture.exit_code === 0 && evidence.includes(LeanCheck.Okay);
  return { answer: proven ? ProofAnswer.Proven : ProofAnswer.NotProven, evidence };
}

export async function leanCheck(
  run: LeanRun,
  input: LeanInput,
  signal: AbortSignal,
): Promise<ScriptCheckAnswer> {
  const parsed = LeanInputSchema.parse(input);
  const limit = Math.ceil(parsed.timeout_s * LeanCheck.Millisecond);
  const folder = await mkdtemp(join(parsed.parent, LeanCheck.FolderPrefix));
  try {
    await populate(folder, parsed);
    const started = Date.now();
    const attempt = async (command: readonly string[]): Promise<CommandCapture | null> => {
      const remaining = Math.max(1, limit - (Date.now() - started));
      try {
        return await run(command, folder, remaining, signal);
      } catch (error) {
        if (error instanceof OperationalError && error.code === ErrorCode.CommandTimeout)
          return null;
        throw error;
      }
    };
    const timedOut: ScriptCheckAnswer = {
      answer: ProofAnswer.NotProven,
      evidence: leanTimeLimit(parsed.timeout_s),
    };
    const setup = await attempt(LeanCheck.Setup);
    if (setup === null) return timedOut;
    if (setup.exit_code !== 0) return answered(setup);
    const compared = await attempt(
      parsed.paranoid ? [...LeanCheck.Compare, LeanCheck.Paranoid] : LeanCheck.Compare,
    );
    return compared === null ? timedOut : answered(compared);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}
