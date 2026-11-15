import { Improvement, ImprovementScenario, ImprovementVariant } from "@titan/constants";
import { ImprovementMessage } from "@titan/messages";
import { positive, rejected } from "@titan/test-factories";

const oldFile = `${ImprovementScenario.Name}${Improvement.FileExtension}`;
const newFile = `${ImprovementScenario.Name}${Improvement.VersionMarker}${Improvement.FirstVersion}${Improvement.FileExtension}`;
const report = ImprovementMessage.Change(ImprovementScenario.Change, ImprovementScenario.Reason);

function row(...parts: readonly (string | number)[]): string {
  return parts.join(ImprovementScenario.Join);
}

function refusal(reason: string, reruns: number): string {
  return row(ImprovementScenario.None, reason, reruns, oldFile, "");
}

const saved = row(
  newFile,
  ImprovementScenario.None,
  1,
  [newFile, oldFile].join(ImprovementScenario.ListJoin),
  report,
);
const weaker = refusal(ImprovementMessage.WeakerStep(ImprovementScenario.StepId), 0);
const scripted = refusal(ImprovementMessage.ScriptChanged(ImprovementScenario.StepId), 0);

export const improverRemovesFalsifierCases = {
  positive: [
    positive(
      "check 2 refutes a new file without the script falsifier and saves nothing",
      [ImprovementVariant.DropScriptFalsifier],
      weaker,
    ),
    positive(
      "check 2 refutes a new file with fewer falsifiers and saves nothing",
      [ImprovementVariant.DropFalsifier],
      weaker,
    ),
  ],
  negative: [
    rejected("an unchanged new file passes check 2 and is saved", [ImprovementVariant.Same], saved),
    rejected(
      "a new file with one more falsifier passes check 2 and is saved",
      [ImprovementVariant.AddFalsifier],
      saved,
    ),
  ],
};

export const improverAddsScriptCases = {
  positive: [
    positive(
      "check 1 refuses a script added to do and nothing runs or is saved",
      [ImprovementVariant.AddDoScript],
      scripted,
    ),
    positive(
      "check 1 refuses a script added to a falsifier and nothing runs or is saved",
      [ImprovementVariant.AddFalsifyScript],
      scripted,
    ),
    positive(
      "check 1 refuses a script added to verify and nothing runs or is saved",
      [ImprovementVariant.AddVerifyScript],
      scripted,
    ),
    positive(
      "check 1 refuses a changed do script and nothing runs or is saved",
      [ImprovementVariant.ChangeDoScript],
      scripted,
    ),
  ],
  negative: [
    rejected("a new file with the same scripts is run and saved", [ImprovementVariant.Same], saved),
    rejected(
      "a new file with another persona falsifier is run and saved",
      [ImprovementVariant.AddFalsifier],
      saved,
    ),
  ],
};

export const newFileBetterCases = {
  positive: [
    positive(
      "4 attempts and 13 agents against 7 and 21 save the file next to the old one with the changes",
      [ImprovementScenario.BetterAttempts, ImprovementScenario.BetterAgents],
      saved,
    ),
    positive(
      "the same 7 attempts and 21 agents save the file",
      [ImprovementScenario.OldAttempts, ImprovementScenario.OldAgents],
      saved,
    ),
  ],
  negative: [
    rejected(
      "8 attempts against 7 save nothing",
      [ImprovementScenario.NextAttempts, ImprovementScenario.BetterAgents],
      refusal(
        ImprovementMessage.MoreAttempts(
          ImprovementScenario.NextAttempts,
          ImprovementScenario.OldAttempts,
        ),
        1,
      ),
    ),
    rejected(
      "22 agents against 21 save nothing",
      [ImprovementScenario.BetterAttempts, ImprovementScenario.MoreAgents],
      refusal(
        ImprovementMessage.MoreAgents(
          ImprovementScenario.MoreAgents,
          ImprovementScenario.OldAgents,
        ),
        1,
      ),
    ),
  ],
};

export const newFileWorseCases = {
  positive: [
    positive(
      "a passing run with 9 attempts against 7 saves nothing and records why",
      [ImprovementScenario.WorseAttempts, ImprovementScenario.BetterAgents, true],
      refusal(
        ImprovementMessage.MoreAttempts(
          ImprovementScenario.WorseAttempts,
          ImprovementScenario.OldAttempts,
        ),
        1,
      ),
    ),
    positive(
      "a passing run with 22 agents against 21 saves nothing and records why",
      [ImprovementScenario.BetterAttempts, ImprovementScenario.MoreAgents, true],
      refusal(
        ImprovementMessage.MoreAgents(
          ImprovementScenario.MoreAgents,
          ImprovementScenario.OldAgents,
        ),
        1,
      ),
    ),
  ],
  negative: [
    rejected(
      "a run that does not pass saves nothing even with fewer attempts",
      [ImprovementScenario.BetterAttempts, ImprovementScenario.BetterAgents, false],
      refusal(ImprovementMessage.NotPassed, 1),
    ),
    rejected(
      "a passing run with no more attempts or agents is saved",
      [ImprovementScenario.OldAttempts, ImprovementScenario.OldAgents, true],
      saved,
    ),
  ],
};
