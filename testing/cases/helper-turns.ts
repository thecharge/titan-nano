import { positive, rejected } from "@titan/test-factories";

export const helperTurnCases = {
  positive: [
    positive("dispatches the named helper and resumes the asking session", ["once"], "passed 1 2"),
    positive("retains distinct helper turns for successive questions", ["repeat"], "passed 2 3"),
    positive("routes a frozen persona version to its workflow binding", ["version"], "passed 1 2"),
    positive(
      "answers a nested helper question with one available agent slot",
      ["nested"],
      "passed 2 2",
    ),
  ],
  negative: [
    rejected("waits for raised approval without invoking a helper", ["raised"], "waiting 0 1"),
    rejected(
      "bounds a helper question cycle by the frozen request allowance",
      ["cycle"],
      "blocked 3 1",
    ),
    rejected(
      "keeps an unknown helper available for an external answer",
      ["unknown"],
      "waiting 0 1",
    ),
  ],
};

export const helperRecoveryCases = {
  positive: [
    positive(
      "recovers a received helper result without another dispatch",
      ["receipt"],
      "passed 1 2",
    ),
    positive(
      "uses the helper read grant when the worker has no read grant",
      ["native-read"],
      "passed 1 2",
    ),
    positive("recovers a completed helper before ledger delivery", ["completed"], "passed 1 2"),
    positive(
      "recovers the durable ledger answer without repeating help",
      ["delivered"],
      "passed 1 2",
    ),
  ],
  negative: [
    rejected(
      "cancels an active helper without continuing its asking worker",
      ["cancel"],
      "cancelled 1 1",
    ),
    rejected(
      "refuses a helper read even when the asking worker can read",
      ["native-denied"],
      "blocked 1 1",
    ),
    rejected(
      "preserves the first external answer during helper execution",
      ["competing"],
      "passed 1 2",
    ),
    rejected(
      "blocks a helper transport failure without accepting a candidate",
      ["backend"],
      "blocked 1 1",
    ),
  ],
};
