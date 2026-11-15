import { positive, rejected } from "@titan/test-factories";

export const renderedKnowledgeCases = {
  positive: [
    positive("committed entries show scope, version and readiness", [false, false], true),
    positive("entry view renders content, provenance and related links", [true, false], true),
  ],
  negative: [
    rejected("empty view reports absence and truncation", [false, true], true),
    rejected("untrusted body remains literal text in entry view", [true, true], true),
  ],
};

export const renderedPendingCases = {
  positive: [
    positive("pending run view names candidate and attempt", [true, false], true),
    positive("pending home view names private operation", [false, false], true),
  ],
  negative: [
    rejected("pending tagged run has no final entry link", [true, true], true),
    rejected("pending tagged home has no final entry link", [false, true], true),
  ],
};
