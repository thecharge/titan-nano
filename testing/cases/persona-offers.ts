import { positive, rejected } from "@titan/test-factories";

export const personaOffersCases = {
  positive: [
    positive(
      "a better replacement offers both older versions in stable order",
      ["retire-many"],
      true,
    ),
    positive(
      "a better proven replacement offers retirement of its older version",
      ["retire"],
      true,
    ),
    positive(
      "two consecutive weak versions open a review and preserve eligibility",
      ["review"],
      true,
    ),
  ],
  negative: [
    rejected("a worse proven replacement cannot retire its stronger predecessor", ["worse"], true),
    rejected("one weak replacement cannot trigger a two-version review", ["single"], true),
  ],
};
