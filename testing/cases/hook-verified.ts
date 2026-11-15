import { negative, positive } from "@titan/test-factories";

const tree = "a".repeat(40);
const other = "b".repeat(40);
export const verifiedTreeCases = {
  positive: [
    positive("a marked tree is verified", [tree, tree], true),
    positive("an unmarked tree is not verified", [null, tree], false),
    positive("another tree stays unverified", [tree, other], false),
  ],
  negative: [
    negative("a path cannot name a tree", [tree, "../escape"], { name: "ZodError" }),
    negative("a short name cannot be marked", ["abc", tree], { name: "ZodError" }),
  ],
};
