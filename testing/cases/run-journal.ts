import { RunJournalFixture, RunJournalScenario, RunStatus, StepStatus } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

const Fixture = RunJournalFixture;

export const runJournalCancelRetryCases = {
  positive: [
    positive(
      "cancelling blocked passed-journal delivery keeps cancellation terminal",
      [true, false, false, true, false],
      "blocked cancelled 1 1 true",
    ),
    positive(
      "cancelling blocked refused-journal delivery keeps cancellation terminal",
      [false, false, false, true, false],
      "blocked cancelled 2 2 true",
    ),
  ],
  negative: [
    rejected(
      "a held passed-journal retry cannot overwrite a newer cancellation",
      [true, false, false, true, true],
      "blocked cancelled 1 1 true",
    ),
    rejected(
      "a held refused-journal retry cannot overwrite a newer cancellation",
      [false, false, false, true, true],
      "blocked cancelled 2 2 true",
    ),
  ],
};

export const runJournalIdentityCases = {
  positive: [
    positive(
      "an amended passed journal keeps one entry and versioned history",
      [true, false],
      true,
    ),
    positive(
      "an amended refused journal keeps one entry and versioned history",
      [false, false],
      true,
    ),
  ],
  negative: [
    rejected("a journal cannot overwrite a fact with the same identity", [true, true], true),
    rejected("a journal cannot overwrite an unrelated lesson", [false, true], true),
  ],
};

export const runJournalReplayCases = {
  positive: [
    positive(
      "a passed journal retry after acknowledgement loss is idempotent",
      [true, true, true],
      "blocked passed 1 1 true",
    ),
    positive(
      "a refused journal retry after acknowledgement loss is idempotent",
      [false, true, true],
      "blocked failed 2 2 true",
    ),
  ],
  negative: [
    rejected(
      "a repeated passed journal cannot create a second entry",
      [true, false, true],
      "blocked passed 1 1 true",
    ),
    rejected(
      "a repeated refused journal cannot create a second entry",
      [false, false, true],
      "blocked failed 2 2 true",
    ),
  ],
};

export const runJournalCancellationCases = {
  positive: [
    positive(
      "cancelling an active worker retains the earlier lesson in its journal",
      [true, false],
      { state: RunStatus.Cancelled, restarted: false },
    ),
    positive(
      "cancelling an active checker retains the earlier lesson in its journal",
      [false, false],
      { state: RunStatus.Cancelled, restarted: false },
    ),
  ],
  negative: [
    rejected("journal retry after restart cannot start a cancelled worker", [true, true], {
      state: RunStatus.Cancelled,
      restarted: false,
    }),
    rejected("journal retry after restart cannot start a cancelled checker", [false, true], {
      state: RunStatus.Cancelled,
      restarted: false,
    }),
  ],
};

export const runJournalRecoveryCases = {
  positive: [
    positive(
      "a restarted passed run rebuilds lesson references from the board",
      [true, true],
      "blocked passed 1 1 true",
    ),
    positive(
      "a restarted refused run rebuilds all lesson references from the board",
      [false, true],
      "blocked failed 2 2 true",
    ),
  ],
  negative: [
    rejected(
      "an interrupted passed journal does not consume lesson references",
      [true, false],
      "blocked passed 1 1 true",
    ),
    rejected(
      "an interrupted refused journal does not consume lesson references",
      [false, false],
      "blocked failed 2 2 true",
    ),
  ],
};

function record(
  state: RunStatus,
  kept: number,
  steps: readonly string[],
  refusals: string,
  files: string,
  lessons: number,
): string {
  return [state, kept, kept, steps.join(Fixture.Join), refusals, files, lessons].join(
    Fixture.Space,
  );
}

const both = [
  `${Fixture.PassStep}:${StepStatus.Passed}`,
  `${Fixture.RefuteStep}:${StepStatus.Failed}`,
];

export const runJournalRecordCases = {
  positive: [
    positive(
      "a run with one passed and one refuted step leaves one journal naming both steps, the refusal and the changed file",
      [RunJournalScenario.Finished],
      record(RunStatus.Failed, 1, both, Fixture.Evidence, Fixture.ChangedFile, 2),
    ),
    positive(
      "a run that passed leaves a journal with its one step and its changed file",
      [RunJournalScenario.Passed],
      record(
        RunStatus.Passed,
        1,
        [`${Fixture.PassStep}:${StepStatus.Passed}`],
        "",
        Fixture.ChangedFile,
        1,
      ),
    ),
    positive(
      "a run that was cancelled before it started leaves a journal with both steps pending",
      [RunJournalScenario.Cancelled],
      record(
        RunStatus.Cancelled,
        1,
        [
          `${Fixture.PassStep}:${StepStatus.Pending}`,
          `${Fixture.RefuteStep}:${StepStatus.Pending}`,
        ],
        "",
        "",
        0,
      ),
    ),
  ],
  negative: [
    rejected(
      "a run without a hub leaves no journal",
      [RunJournalScenario.NoHub],
      [RunStatus.Failed, 0, 0, "", "", "", 0].join(Fixture.Space),
    ),
    rejected(
      "a run whose project hub cannot be written leaves no journal file",
      [RunJournalScenario.Unwritable],
      [RunStatus.Blocked, 0, 0, "", "", "", 0].join(Fixture.Space),
    ),
  ],
};

export const runJournalBlockedCases = {
  positive: [
    positive(
      "a failed run whose project hub cannot be written ends as blocked and names the folder",
      [RunJournalScenario.Unwritable],
      [RunStatus.Blocked, true].join(Fixture.Space),
    ),
    positive(
      "a passed run whose project hub cannot be written also ends as blocked and names the folder",
      [RunJournalScenario.UnwritablePassed],
      [RunStatus.Blocked, true].join(Fixture.Space),
    ),
  ],
  negative: [
    rejected(
      "a run whose hub can be written keeps its own state and names no folder",
      [RunJournalScenario.Finished],
      [RunStatus.Failed, false].join(Fixture.Space),
    ),
    rejected(
      "a run without a hub keeps its own state and names no folder",
      [RunJournalScenario.NoHub],
      [RunStatus.Failed, false].join(Fixture.Space),
    ),
  ],
};

export const runJournalNextCases = {
  positive: [
    positive(
      "a second run lists the journal of the first run before its first step",
      [RunJournalScenario.Next],
      [1, true, true].join(Fixture.Space),
    ),
    positive(
      "a second run lists the journal of a first run that passed",
      [RunJournalScenario.NextPassed],
      [1, true, true].join(Fixture.Space),
    ),
  ],
  negative: [
    rejected(
      "a second run without a hub finds no journal and lists nothing",
      [RunJournalScenario.NoHub],
      [0, false, false].join(Fixture.Space),
    ),
    rejected(
      "a second run finds no journal when the first could not write one",
      [RunJournalScenario.Unwritable],
      [0, false, false].join(Fixture.Space),
    ),
  ],
};
