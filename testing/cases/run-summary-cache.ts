import { RunStatus, ServerState, SummaryCase } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const runSummaryCases = {
  positive: [
    positive("a second listing of an unchanged board reads it once", [SummaryCase.Same], {
      reads: 1,
      state: RunStatus.Passed,
    }),
    positive("a board that grew is read again", [SummaryCase.Appended], {
      reads: 2,
      state: RunStatus.Passed,
    }),
  ],
  negative: [
    rejected("without a stored summary every listing reads the board", [SummaryCase.NoCache], {
      reads: 2,
      state: RunStatus.Passed,
    }),
    rejected("a run with no board is never read", [SummaryCase.Missing], {
      reads: 0,
      state: ServerState.InitializationIncomplete,
    }),
  ],
};
