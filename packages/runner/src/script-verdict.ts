import { FileEncoding, TextSymbol, Verdict } from "@titan/constants";
import { RunnerMessage } from "@titan/messages";
import type { CommandCapture, FalsifierAnswer } from "@titan/types";

export function scriptVerdict(capture: CommandCapture): FalsifierAnswer {
  if (capture.exit_code === 0) return { verdict: Verdict.Survived, evidence: TextSymbol.Empty };
  const output = Buffer.concat([capture.stdout, capture.stderr]).toString(FileEncoding.Utf8);
  return {
    verdict: Verdict.Refuted,
    evidence: output.trim() ? output : RunnerMessage.ScriptExit,
  };
}
