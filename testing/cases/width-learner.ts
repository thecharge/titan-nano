import { WidthFixture } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

const reward = WidthFixture.Reward;
const width = WidthFixture.Width;
const digits = WidthFixture.Digits;

export const widthShareCases = {
  positive: [
    positive(
      "self-training-orchestration > Width that does better is picked more: seed 42, 200 runs of 8 parts, width 1 is under 10 % of the last 50",
      [WidthFixture.Seed, WidthFixture.Parts, WidthFixture.Cap],
      true,
    ),
    positive(
      "self-training-orchestration > Width that does better is picked more: seed 7, 200 runs of 8 parts, width 1 is under 10 % of the last 50",
      [WidthFixture.OtherSeed, WidthFixture.Parts, WidthFixture.Cap],
      true,
    ),
  ],
  negative: [
    rejected(
      "self-training-orchestration > Width that does better is picked more: a cap of 1 leaves only width 1",
      [WidthFixture.Seed, WidthFixture.Parts, WidthFixture.LowCap],
      false,
    ),
    rejected(
      "self-training-orchestration > Width that does better is picked more: a goal of 1 part leaves only width 1",
      [WidthFixture.Seed, WidthFixture.OneWidth, WidthFixture.Cap],
      false,
    ),
  ],
};

export const widthTrailCases = {
  positive: [
    positive(
      "self-training-orchestration > Width that does better is picked more: a score above the mean adds 1 to the positive trail of the chosen width",
      [[reward.Low, reward.High], [width.One, width.Eight], digits],
      "0.00,0.00,0.00,1.00|0.00,0.00,0.00,0.00",
    ),
    positive(
      "self-training-orchestration > Width that does better is picked more: a score below the mean adds 1 to the negative trail of the chosen width",
      [[reward.High, reward.Low], [width.Eight, width.One], digits],
      "0.00,0.00,0.00,0.00|1.00,0.00,0.00,0.00",
    ),
    positive(
      "self-training-orchestration > Width that does better is picked more: only the last 4 earlier scores make the mean and every trail fades by 0.98",
      [
        [0.9, 0.1, 0.1, 0.1, 0.1, 0.2],
        [width.One, width.One, width.One, width.One, width.One, width.Eight],
        digits,
      ],
      "0.00,0.00,0.00,1.00|3.80,0.00,0.00,0.00",
    ),
  ],
  negative: [
    rejected(
      "self-training-orchestration > Width that does better is picked more: the first run leaves every trail at 0",
      [[reward.Mid], [width.One], digits],
      "0.00,0.00,0.00,0.00|0.00,0.00,0.00,0.00",
    ),
    rejected(
      "self-training-orchestration > Width that does better is picked more: a score equal to the mean adds to no trail",
      [[reward.Mid, reward.Mid], [width.Four, width.Four], digits],
      "0.00,0.00,0.00,0.00|0.00,0.00,0.00,0.00",
    ),
  ],
};

export const widthEligibleCases = {
  positive: [
    positive(
      "self-training-orchestration > Width that does better is picked more: 8 parts and a cap of 8 allow 1, 2, 4 and 8",
      [WidthFixture.Parts, WidthFixture.Cap],
      "1,2,4,8",
    ),
    positive(
      "self-training-orchestration > Width that does better is picked more: 3 parts allow only 1 and 2",
      [3, WidthFixture.Cap],
      "1,2",
    ),
  ],
  negative: [
    rejected(
      "self-training-orchestration > Width that does better is picked more: zero parts allow no width",
      [WidthFixture.NoParts, WidthFixture.Cap],
      "",
    ),
    rejected(
      "self-training-orchestration > Width that does better is picked more: a cap of 0 allows no width",
      [WidthFixture.Parts, WidthFixture.NoParts],
      "",
    ),
  ],
};

export const widthFirstCases = {
  positive: [
    positive(
      "self-training-orchestration > Width that does better is picked more: one part gives width 1",
      [WidthFixture.Seed, WidthFixture.OneWidth, WidthFixture.Cap],
      width.One,
    ),
    positive(
      "self-training-orchestration > Width that does better is picked more: a cap of 1 gives width 1",
      [WidthFixture.OtherSeed, WidthFixture.Parts, WidthFixture.LowCap],
      width.One,
    ),
  ],
  negative: [
    rejected(
      "self-training-orchestration > Width that does better is picked more: zero parts make no choice",
      [WidthFixture.Seed, WidthFixture.NoParts, WidthFixture.Cap],
      WidthFixture.NoParts,
    ),
    rejected(
      "self-training-orchestration > Width that does better is picked more: a cap of 0 makes no choice",
      [WidthFixture.OtherSeed, WidthFixture.Parts, WidthFixture.NoParts],
      WidthFixture.NoParts,
    ),
  ],
};
