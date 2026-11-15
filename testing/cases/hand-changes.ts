import { HandChangeFixture } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const handChangeCases = {
  positive: [
    positive(
      "an indented path retains explicit hand-change attribution",
      [HandChangeFixture.Wrapped],
      0,
    ),
    positive(
      "a Windows line ending and tab retain attribution",
      [HandChangeFixture.WrappedWindows],
      0,
    ),
    positive("every hand change is listed", [HandChangeFixture.Listed], 0),
    positive("a run wrote the only change", [HandChangeFixture.WrittenByRun], 0),
    positive("a listed change beside a run change", [HandChangeFixture.MixedListed], 0),
    positive("nothing is staged", [HandChangeFixture.NothingStaged], 0),
    positive("a valid subject with its hand change listed", [HandChangeFixture.PolicyListed], 0),
  ],
  negative: [
    rejected(
      "an unrelated following line cannot acknowledge a hand change",
      [HandChangeFixture.Unindented],
      1,
    ),
    rejected(
      "an empty continuation cannot acknowledge a hand change",
      [HandChangeFixture.EmptyWrapped],
      1,
    ),
    rejected("a hand change with no listing", [HandChangeFixture.Unlisted], 1),
    rejected("a hand change beside a run change", [HandChangeFixture.Mixed], 1),
    rejected("a corrupt run record", [HandChangeFixture.CorruptRecord], 1),
    rejected("no repository", [HandChangeFixture.NotRepository], 1),
    rejected("no message file", [HandChangeFixture.MissingMessage], 1),
    rejected("a valid subject with an unlisted hand change", [HandChangeFixture.PolicyUnlisted], 1),
    rejected("an invalid subject", [HandChangeFixture.PolicyInvalid], 1),
  ],
};
