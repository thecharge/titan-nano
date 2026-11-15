import {
  FileErrorCode,
  PersonaBound,
  PersonaFixture,
  PersonaPickRun,
  PersonaState,
  RequestKind,
} from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

const improve = RequestKind.ImprovePersona;
const rates = PersonaFixture.Rates;
const scores = PersonaFixture.Scores;
const skeptic = PersonaFixture.Skeptic;
const doubter = PersonaFixture.Doubter;

export const personaProvenCases = {
  positive: [
    positive(
      "persona-lifecycle > A good persona becomes proven: 17 of 20 gives lower bound 0.640",
      [PersonaState.Trial, 17, 3, PersonaBound.Lower],
      "proven 0.640 1 ",
    ),
    positive(
      "persona-lifecycle > A good persona becomes proven: 34 of 40 gives lower bound 0.709",
      [PersonaState.Trial, 34, 6, PersonaBound.Lower],
      "proven 0.709 1 ",
    ),
  ],
  negative: [
    rejected(
      "persona-lifecycle > A good persona becomes proven: 16 of 20 stays in trial",
      [PersonaState.Trial, 16, 4, PersonaBound.Lower],
      "trial 0.584 0 ",
    ),
    rejected(
      "persona-lifecycle > A good persona becomes proven: 1 of 8 needs an update instead",
      [PersonaState.Trial, 1, 7, PersonaBound.Upper],
      `needs_update 0.471 1 ${improve}`,
    ),
  ],
};

export const personaTrialCases = {
  positive: [
    positive(
      "persona-lifecycle > Not enough results yet: 16 of 20 keeps lower bound 0.584 in trial",
      [PersonaState.Trial, 16, 4, PersonaBound.Lower],
      "trial 0.584 0 ",
    ),
    positive(
      "persona-lifecycle > Not enough results yet: 16 of 20 keeps upper bound 0.919 in trial",
      [PersonaState.Trial, 16, 4, PersonaBound.Upper],
      "trial 0.919 0 ",
    ),
  ],
  negative: [
    rejected(
      "persona-lifecycle > Not enough results yet: 17 of 20 has enough and moves to proven",
      [PersonaState.Trial, 17, 3, PersonaBound.Lower],
      "proven 0.640 1 ",
    ),
    rejected(
      "persona-lifecycle > Not enough results yet: 1 of 8 has enough and needs an update",
      [PersonaState.Trial, 1, 7, PersonaBound.Upper],
      `needs_update 0.471 1 ${improve}`,
    ),
  ],
};

export const personaWeakCases = {
  positive: [
    positive(
      "persona-lifecycle > A weak persona needs an update: a trial version with 1 of 8 and upper bound 0.471",
      [PersonaState.Trial, 1, 7, PersonaBound.Upper],
      `needs_update 0.471 1 ${improve}`,
    ),
    positive(
      "persona-lifecycle > A weak persona needs an update: a proven version with 1 of 8 and upper bound 0.471",
      [PersonaState.Proven, 1, 7, PersonaBound.Upper],
      `needs_update 0.471 1 ${improve}`,
    ),
  ],
  negative: [
    rejected(
      "persona-lifecycle > A weak persona needs an update: 16 of 20 sends no request",
      [PersonaState.Trial, 16, 4, PersonaBound.Upper],
      "trial 0.919 0 ",
    ),
    rejected(
      "persona-lifecycle > A weak persona needs an update: a retired version does not move",
      [PersonaState.Retired, 1, 7, PersonaBound.Upper],
      "retired 0.471 0 ",
    ),
  ],
};

export const personaRecordCases = {
  positive: [
    positive(
      "persona-lifecycle > A good persona becomes proven: the history keeps 17 of 20, both bounds and the bar",
      [PersonaState.Trial, 17, 3],
      "trial proven 17 20 0.640 0.948 0.6 0",
    ),
    positive(
      "persona-lifecycle > A weak persona needs an update: the history keeps 1 of 8 and the request carries 7 refutations",
      [PersonaState.Proven, 1, 7],
      "proven needs_update 1 8 0.022 0.471 0.6 7",
    ),
  ],
  negative: [
    rejected(
      "persona-lifecycle > Not enough results yet: 16 of 20 writes no history entry",
      [PersonaState.Trial, 16, 4],
      "0",
    ),
    rejected(
      "persona-lifecycle > A weak persona needs an update: a retired version writes no history entry",
      [PersonaState.Retired, 1, 7],
      "0",
    ),
  ],
};

const investigator = PersonaFixture.Investigator;
const runOne = PersonaFixture.RunOne;
const runTwo = PersonaFixture.RunTwo;

export const personaHistoryCases = {
  positive: [
    positive(
      "persona-lifecycle > History after a run: 3 candidates and 2 survived give survived 2 and refuted 1",
      [investigator, [runOne], 3, 2],
      "1 run-1 survived: 2 refuted: 1",
    ),
    positive(
      "persona-lifecycle > History after a run: a second run adds a second entry",
      [investigator, [runOne, runTwo], 4, 4],
      "2 run-2 survived: 4 refuted: 0",
    ),
  ],
  negative: [
    rejected(
      "persona-lifecycle > History after a run: the same run twice does not add an entry",
      [investigator, [runOne, runOne], 3, 2],
      "1 run-1 survived: 2 refuted: 1",
    ),
    rejected(
      "persona-lifecycle > History after a run: survived above candidates is not counted as refuted",
      [investigator, [runOne], 3, 5],
      "1 run-1 survived: 3 refuted: 0",
    ),
  ],
};

export const personaCandidatesCases = {
  positive: [
    positive(
      "persona-lifecycle > Old and new versions both picked: needs_update and trial are both candidates",
      [
        skeptic,
        [
          [skeptic, 3, PersonaState.NeedsUpdate],
          [skeptic, 4, PersonaState.Trial],
        ],
      ],
      "candidates: skeptic@3, skeptic@4",
    ),
    positive(
      "persona-lifecycle > Old and new versions both picked: a proven version joins them",
      [
        skeptic,
        [
          [skeptic, 5, PersonaState.Proven],
          [skeptic, 3, PersonaState.NeedsUpdate],
          [skeptic, 4, PersonaState.Trial],
        ],
      ],
      "candidates: skeptic@3, skeptic@4, skeptic@5",
    ),
  ],
  negative: [
    rejected(
      "persona-lifecycle > Old and new versions both picked: a retired version is left out",
      [
        skeptic,
        [
          [skeptic, 3, PersonaState.Retired],
          [skeptic, 4, PersonaState.Trial],
        ],
      ],
      "candidates: skeptic@4",
    ),
    rejected(
      "persona-lifecycle > Old and new versions both picked: another persona is left out",
      [
        skeptic,
        [
          [PersonaFixture.Judge, 1, PersonaState.Proven],
          [skeptic, 4, PersonaState.Deleted],
        ],
      ],
      "candidates: ",
    ),
  ],
};

export const personaSearchCases = {
  positive: [
    positive(
      "persona-lifecycle > Search leaves out a retired persona: only skeptic@4 is listed",
      [
        skeptic,
        false,
        [
          [skeptic, 3, PersonaState.Retired],
          [skeptic, 4, PersonaState.Proven],
        ],
      ],
      "skeptic@4:proven",
    ),
    positive(
      "persona-lifecycle > Search leaves out a retired persona: --all lists both with their state",
      [
        skeptic,
        true,
        [
          [skeptic, 3, PersonaState.Retired],
          [skeptic, 4, PersonaState.Proven],
        ],
      ],
      "skeptic@3:retired,skeptic@4:proven",
    ),
  ],
  negative: [
    rejected(
      "persona-lifecycle > Search leaves out a retired persona: a deleted version is left out",
      [
        skeptic,
        false,
        [
          [skeptic, 1, PersonaState.Deleted],
          [skeptic, 2, PersonaState.Trial],
        ],
      ],
      "skeptic@2:trial",
    ),
    rejected(
      "persona-lifecycle > Search leaves out a retired persona: another name does not match",
      [PersonaFixture.Judge, true, [[skeptic, 4, PersonaState.Proven]]],
      "",
    ),
  ],
};

export const personaMeasuresCases = {
  positive: [
    positive(
      "persona-lifecycle > Measures after a run: version 2 gains 3 uses, 2 survived and 1 refuted",
      [[[investigator, 2, 5, 4, 1]], investigator, 2, 3, 2],
      "2:3/2/1",
    ),
    positive(
      "persona-lifecycle > Measures after a run: version 1 stays the same while version 2 gains",
      [
        [
          [investigator, 1, 4, 3, 1],
          [investigator, 2, 0, 0, 0],
        ],
        investigator,
        2,
        3,
        2,
      ],
      "1:0/0/0,2:3/2/1",
    ),
  ],
  negative: [
    rejected(
      "persona-lifecycle > Measures after a run: a run of another version leaves version 2 unchanged",
      [[[investigator, 2, 5, 4, 1]], investigator, 1, 3, 2],
      "2:0/0/0",
    ),
    rejected(
      "persona-lifecycle > Measures after a run: a run with no results changes nothing",
      [[[investigator, 2, 5, 4, 1]], investigator, 2, 0, 0],
      "2:0/0/0",
    ),
  ],
};

export const personaMergeCases = {
  positive: [
    positive(
      "persona-lifecycle > Two skeptics: score 0.93 gives one merge request naming both",
      [
        [
          [skeptic, 4, PersonaState.Trial],
          [doubter, 1, PersonaState.Proven],
        ],
        scores.Match,
      ],
      "1 merge_personas:skeptic@4+doubter@1",
    ),
    positive(
      "persona-lifecycle > Two skeptics: score 0.9 is enough",
      [
        [
          [skeptic, 4, PersonaState.Proven],
          [doubter, 1, PersonaState.Trial],
        ],
        scores.Edge,
      ],
      "1 merge_personas:skeptic@4+doubter@1",
    ),
  ],
  negative: [
    rejected(
      "persona-lifecycle > Two skeptics: score 0.89 gives no request",
      [
        [
          [skeptic, 4, PersonaState.Trial],
          [doubter, 1, PersonaState.Trial],
        ],
        scores.Under,
      ],
      "0 ",
    ),
    rejected(
      "persona-lifecycle > Two skeptics: two versions of one persona and a retired one give no request",
      [
        [
          [skeptic, 3, PersonaState.Trial],
          [skeptic, 4, PersonaState.Proven],
          [doubter, 1, PersonaState.Retired],
        ],
        scores.Same,
      ],
      "0 ",
    ),
  ],
};

export const personaDeleteCases = {
  positive: [
    positive(
      "persona-lifecycle > Person approves a delete: old-coder is gone and its content is in history",
      [
        PersonaFixture.OldCoder,
        PersonaFixture.RoleOld,
        PersonaFixture.NewCoder,
        PersonaFixture.OldCoder,
      ],
      "false true 1 true",
    ),
    positive(
      "persona-lifecycle > Person approves a delete: another persona moved leaves old-coder in place",
      [
        PersonaFixture.OldCoder,
        PersonaFixture.RoleOther,
        PersonaFixture.NewCoder,
        PersonaFixture.NewCoder,
      ],
      "true false 1 true",
    ),
  ],
  negative: [
    negative(
      "persona-lifecycle > Person approves a delete: a persona with no file is refused",
      [
        PersonaFixture.OldCoder,
        PersonaFixture.RoleOld,
        PersonaFixture.NewCoder,
        PersonaFixture.Ghost,
      ],
      { code: FileErrorCode.Missing },
    ),
    negative(
      "persona-lifecycle > Person approves a delete: a second missing persona is refused too",
      [
        PersonaFixture.OldCoder,
        PersonaFixture.RoleOld,
        PersonaFixture.NewCoder,
        PersonaFixture.GhostTwo,
      ],
      { code: FileErrorCode.Missing },
    ),
  ],
};

export const personaSwapCases = {
  positive: [
    positive(
      "persona-lifecycle > Persona that got better is found: seed 42, 2000 repeats, B gets more than half",
      [
        [rates.Good, rates.Mid],
        PersonaPickRun.SwapPicks,
        PersonaPickRun.Repeats,
        PersonaPickRun.Seed,
        true,
      ],
      true,
    ),
    positive(
      "persona-lifecycle > Persona that got better is found: seed 7, 500 repeats, B gets more than half",
      [
        [rates.Good, rates.Mid],
        PersonaPickRun.SwapPicks,
        PersonaPickRun.FewRepeats,
        PersonaPickRun.OtherSeed,
        true,
      ],
      true,
    ),
  ],
  negative: [
    rejected(
      "persona-lifecycle > Persona that got better is found: without a swap B stays under half, seed 42",
      [
        [rates.Good, rates.Mid],
        PersonaPickRun.SwapPicks,
        PersonaPickRun.FewRepeats,
        PersonaPickRun.Seed,
        false,
      ],
      false,
    ),
    rejected(
      "persona-lifecycle > Persona that got better is found: without a swap B stays under half, seed 7",
      [
        [rates.Good, rates.Mid],
        PersonaPickRun.SwapPicks,
        PersonaPickRun.FewRepeats,
        PersonaPickRun.OtherSeed,
        false,
      ],
      false,
    ),
  ],
};

export const personaFloorShareCases = {
  positive: [
    positive(
      "persona-lifecycle > More than ten matching versions: 20 versions",
      [20],
      "0.050 1.000",
    ),
    positive(
      "persona-lifecycle > More than ten matching versions: 40 versions",
      [40],
      "0.025 1.000",
    ),
  ],
  negative: [
    rejected(
      "persona-lifecycle > More than ten matching versions: 5 versions are capped at 0.1 each",
      [5],
      "0.100 0.500",
    ),
    rejected(
      "persona-lifecycle > More than ten matching versions: 2 versions are capped at 0.1 each",
      [2],
      "0.100 0.200",
    ),
  ],
};

export const personaFloorCases = {
  positive: [
    positive(
      "persona-lifecycle > Floor for a slightly worse persona: 62 and 60 percent, seed 42, 2000 repeats",
      [
        [rates.Near, rates.Close],
        PersonaPickRun.FloorPicks,
        PersonaPickRun.Repeats,
        PersonaPickRun.Seed,
      ],
      true,
    ),
    positive(
      "persona-lifecycle > Floor for a slightly worse persona: 62 and 60 percent, seed 7, 500 repeats",
      [
        [rates.Near, rates.Close],
        PersonaPickRun.FloorPicks,
        PersonaPickRun.FewRepeats,
        PersonaPickRun.OtherSeed,
      ],
      true,
    ),
  ],
  negative: [
    rejected(
      "persona-lifecycle > Floor for a slightly worse persona: 90 and 10 percent leave the weak one under 10 percent",
      [
        [rates.High, rates.Low],
        PersonaPickRun.FloorPicks,
        PersonaPickRun.FewRepeats,
        PersonaPickRun.Seed,
      ],
      false,
    ),
    rejected(
      "persona-lifecycle > Floor for a slightly worse persona: 95 and 5 percent leave the weak one under 10 percent",
      [
        [rates.Top, rates.Bottom],
        PersonaPickRun.FloorPicks,
        PersonaPickRun.FewRepeats,
        PersonaPickRun.OtherSeed,
      ],
      false,
    ),
  ],
};
