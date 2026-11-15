import {
  DetectionSource,
  ErrorCode,
  HarnessAuto,
  HarnessChoices,
  HarnessCommands,
  HarnessName,
  HarnessSignals,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { ambiguousHarness, noHarness, unknownHarness } from "@titan/messages";
import type { HarnessChoice, HarnessInput, HarnessSignal } from "@titan/types";

function named(name: string): HarnessName {
  const found = Object.values(HarnessName).find((harness) => harness === name);
  if (!found) throw new TitanError(ErrorCode.Arguments, unknownHarness(name));
  return found;
}

export function detectHarness(
  input: HarnessInput,
  signals: readonly HarnessSignal[] = HarnessSignals,
): HarnessChoice {
  if (input.flag !== undefined)
    return { harness: named(input.flag), detectedBy: DetectionSource.Flag };
  if (input.workflow !== undefined && input.workflow !== HarnessAuto.Value)
    return { harness: named(input.workflow), detectedBy: DetectionSource.Workflow };
  const matches = signals.filter((signal) => input.env[signal.variable] === signal.value);
  const [first] = matches;
  if (matches.length > 1)
    throw new TitanError(
      ErrorCode.Arguments,
      ambiguousHarness(
        matches.map((signal) => signal.variable),
        HarnessChoices,
      ),
    );
  if (first)
    return {
      harness: first.harness,
      detectedBy: `${DetectionSource.Environment}${first.variable}`,
    };
  const found = HarnessCommands.filter((entry) => input.found.includes(entry.command));
  const missing = HarnessCommands.filter((entry) => !input.found.includes(entry.command));
  throw new TitanError(
    ErrorCode.Arguments,
    noHarness(
      found.map((entry) => entry.command),
      missing.map((entry) => entry.command),
      HarnessChoices,
    ),
  );
}
