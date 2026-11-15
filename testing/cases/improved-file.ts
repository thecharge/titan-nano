import { ImprovedFixture } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

const main = `${ImprovedFixture.Name}.yaml`;
const second = `${ImprovedFixture.Name}.v2.yaml`;
const other = `${ImprovedFixture.Other}.v5.yaml`;

export const improvedSaveCases = {
  positive: [
    positive(
      "kept file after plan.yaml and plan.v2.yaml is saved as plan.v3.yaml",
      [ImprovedFixture.Name, [main, second], ImprovedFixture.Kept],
      "plan.v3.yaml true 1",
    ),
    positive(
      "first kept file beside plan.yaml is saved as plan.v2.yaml",
      [ImprovedFixture.Name, [main], ImprovedFixture.Kept],
      "plan.v2.yaml true 1",
    ),
  ],
  negative: [
    rejected(
      "versions of another file name do not move the number",
      [ImprovedFixture.Name, [main, other], ImprovedFixture.Kept],
      "plan.v2.yaml true 1",
    ),
    rejected(
      "a gap in the numbers is never filled, the next number follows the highest",
      [ImprovedFixture.Name, [main, "plan.v7.yaml"], ImprovedFixture.Kept],
      "plan.v8.yaml true 1",
    ),
  ],
};
