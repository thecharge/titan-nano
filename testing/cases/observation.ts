import { ConfiguredStartupFixture, ObservationFixture, WorkflowExample } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const cliLiveObservationCases = {
  positive: [
    positive(
      "already settled work still prints its terminal event",
      [ObservationFixture.Settled],
      true,
    ),
    positive(
      "human watch prints every event through the terminal journal",
      [ObservationFixture.Sequential],
      true,
    ),
    positive(
      "human watch drains pages without repeating a cursor",
      [ObservationFixture.Paging],
      true,
    ),
    positive("JSON watch preserves one final object", [ObservationFixture.Json], true),
    positive(
      "detached observation performs no event or status reads",
      [ObservationFixture.Detached],
      true,
    ),
  ],
  negative: [
    rejected(
      "event transport failure cannot claim a run outcome",
      [ObservationFixture.EventFailure],
      true,
    ),
    rejected(
      "status transport failure preserves already printed events",
      [ObservationFixture.StateFailure],
      true,
    ),
  ],
};

export const cliObserverProcessCases = {
  positive: [
    positive("sequential worker waits for visible CLI progress", [false, false], true),
    positive("parallel workers wait for visible CLI progress", [true, false], true),
  ],
  negative: [
    rejected("Ctrl-C exits 130 while the sequential run continues", [false, true], true),
    rejected("Ctrl-C preserves both parallel worker executions", [true, true], true),
  ],
};

export const cliConfiguredStartupCases = {
  positive: [
    positive(
      "bare code-fix command uses configured backend and replies",
      [WorkflowExample.CodeFix, ConfiguredStartupFixture.None],
      true,
    ),
    positive(
      "bare science command starts and observes configured work",
      [WorkflowExample.ScienceClaim, ConfiguredStartupFixture.None],
      true,
    ),
  ],
  negative: [
    rejected(
      "unsupported configured backend cannot create an owner",
      [WorkflowExample.CodeFix, ConfiguredStartupFixture.Backend],
      true,
    ),
    rejected(
      "invalid configured script cannot create an owner",
      [WorkflowExample.ScienceClaim, ConfiguredStartupFixture.Script],
      true,
    ),
  ],
};
