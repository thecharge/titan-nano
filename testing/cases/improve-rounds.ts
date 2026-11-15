import { ImproveRoundsFixture } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

const two = ImproveRoundsFixture.VersionTwo;
const three = ImproveRoundsFixture.VersionThree;

export const improveRoundsCases = {
  positive: [
    positive(
      "self-improving-loop > Two rounds, second keeps nothing: round 3 does not run and the record lists two rounds",
      [3, [[two], [], [three]]],
      "2 kept,nothing",
    ),
    positive(
      "self-improving-loop > Two rounds, second keeps nothing: two rounds that both keep run to the set number",
      [2, [[two], [three]]],
      "2 kept,kept",
    ),
  ],
  negative: [
    rejected(
      "self-improving-loop > Two rounds, second keeps nothing: nothing kept in round 1 stops the loop at once",
      [3, [[], [two], [three]]],
      "1 nothing",
    ),
    rejected(
      "self-improving-loop > Two rounds, second keeps nothing: zero rounds run nothing",
      [0, [[two]]],
      "0 ",
    ),
  ],
};
