import { positive, rejected } from "@titan/test-factories";

export const knowledgeMergeBoundsCases = {
  positive: [
    positive("small committed project and home pages retain every row", [false, false], true),
    positive("small private and home pages retain every row", [true, false], true),
  ],
  negative: [
    rejected("committed page merge cannot exceed the shared byte budget", [false, true], true),
    rejected("private page merge cannot exceed the shared byte budget", [true, true], true),
  ],
};
