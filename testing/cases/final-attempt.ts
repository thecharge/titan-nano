import { positive, rejected } from "@titan/test-factories";

export const finalAttemptCases = {
  positive: [
    positive("worker resumes final attempt after reload", [false, true], true),
    positive("checker resumes final attempt after reload", [true, true], true),
    positive("worker resumes final attempt in the same engine", [false, false], true),
    positive("checker resumes final attempt in the same engine", [true, false], true),
  ],
  negative: [
    rejected("worker cannot refill exhausted recovery after reload", [false, true, 0], true),
    rejected("checker cannot refill exhausted recovery after reload", [true, true, 0], true),
    rejected("worker cannot refill exhausted recovery in place", [false, false, 0], true),
    rejected("checker cannot refill exhausted recovery in place", [true, false, 0], true),
  ],
};
