import { FileEncoding, ProofAnswer } from "@titan/constants";
import { RunnerMessage } from "@titan/messages";
import type { CommandCapture, ScriptCheck, ScriptCheckAnswer } from "@titan/types";

function answered(capture: CommandCapture): ScriptCheckAnswer {
  return {
    answer: capture.exit_code === 0 ? ProofAnswer.Proven : ProofAnswer.NotProven,
    evidence: Buffer.concat([capture.stdout, capture.stderr]).toString(FileEncoding.Utf8),
  };
}

export async function scriptCheck(
  run: ScriptCheck,
  script: string,
  folder: string,
  first: boolean,
  signal: AbortSignal,
): Promise<ScriptCheckAnswer> {
  const one = answered(await run(script, folder, signal));
  if (!first) return one;
  const two = answered(await run(script, folder, signal));
  if (one.answer !== two.answer)
    return { answer: ProofAnswer.NotProven, evidence: RunnerMessage.ScriptDiffers };
  return one;
}
