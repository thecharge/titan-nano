import { positive, rejected } from "@titan/test-factories";

export const requestRecoveryCases = {
  positive: [
    positive(
      "historical worker opening with a recovery diagnostic remains readable",
      [false, true, false, true],
      true,
    ),
    positive(
      "historical checker opening with a recovery diagnostic remains readable",
      [true, true, false, true],
      true,
    ),
    positive("worker session recovery accepts only its new healthy execution", [false, true], true),
    positive("checker session recovery accepts only its new healthy execution", [true, true], true),
  ],
  negative: [
    rejected(
      "worker failure during admission cannot use a stale healthy snapshot",
      [false, true, true],
      true,
    ),
    rejected(
      "checker failure during admission cannot use a stale healthy snapshot",
      [true, true, true],
      true,
    ),
    rejected("blocked worker cannot open during its unfinished transition", [false, false], true),
    rejected("blocked checker cannot open during its unfinished transition", [true, false], true),
  ],
};
