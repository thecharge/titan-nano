import { RunStatus } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const serverHubCases = {
  positive: [
    positive("a production run saves a journal read by the next run", [true, false, true, false], {
      state: RunStatus.Passed,
      journal: true,
      reread: true,
    }),
    positive("a production journal is read after server restart", [true, true, true, false], {
      state: RunStatus.Passed,
      journal: true,
      reread: true,
    }),
    positive(
      "a project using the server home reuses its knowledge owner",
      [true, true, true, false, true],
      {
        state: RunStatus.Passed,
        journal: true,
        reread: true,
      },
    ),
  ],
  negative: [
    rejected("a refuted production run saves a failed journal", [false, true, true, false], {
      state: RunStatus.Failed,
      journal: true,
      reread: true,
    }),
    rejected(
      "a different project does not read the first project's journal",
      [true, true, false, false],
      { state: RunStatus.Passed, journal: true, reread: false },
    ),
    rejected("a project hub that cannot open blocks the run", [true, false, true, true], {
      state: RunStatus.Blocked,
      journal: false,
      reread: false,
    }),
  ],
};
