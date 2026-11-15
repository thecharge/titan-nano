import { EmbedderFixture, EmbedderName, ErrorCode, ExitCode } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

const stopped = { code: ErrorCode.EmbedderChanged, exit: ExitCode.Input, advice: true };
const notReady = { code: ErrorCode.NotBuilt, exit: ExitCode.Input, advice: false };

export const embedderChangedCases = {
  positive: [
    positive(
      "default embedder then another named in config stops with exit code 2",
      [null, EmbedderFixture.Other, false, false],
      stopped,
    ),
    positive(
      "another embedder then the default stops with exit code 2",
      [EmbedderFixture.Other, null, false, false],
      stopped,
    ),
    positive(
      "injected embedder then the local default stops with exit code 2",
      [null, EmbedderName.Local, false, true],
      stopped,
    ),
  ],
  negative: [
    rejected(
      "same default embedder does not ask for a reindex",
      [null, null, false, false],
      notReady,
    ),
    rejected(
      "same configured embedder does not ask for a reindex",
      [EmbedderFixture.Other, EmbedderFixture.Other, false, false],
      notReady,
    ),
    rejected(
      "reindex after the change does not ask for a reindex again",
      [null, EmbedderFixture.Other, true, false],
      notReady,
    ),
  ],
};
