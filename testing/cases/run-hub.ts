import {
  AgentTool,
  KnowledgeTool,
  RunHubFixture,
  RunHubOutcome,
  RunHubScenario,
  RunStatus,
} from "@titan/constants";
import { RunHubMessage } from "@titan/messages";
import { positive, rejected } from "@titan/test-factories";

function record(
  state: RunStatus,
  read: number,
  first: boolean,
  wrote: number,
  inProject: number,
  inHome: number,
): string {
  return [
    state,
    read,
    first,
    wrote,
    inProject,
    inHome,
    [RunHubOutcome.Passed, RunHubOutcome.Refuted].sort().join(RunHubFixture.Join),
  ].join(RunHubFixture.Space);
}

function tools(worker: readonly string[], checker: readonly string[]): string {
  return [worker.join(RunHubFixture.Join), checker.join(RunHubFixture.Join)].join(
    RunHubFixture.Rows,
  );
}

function blocked(missing: readonly string[]): string {
  return [RunStatus.Blocked, 0, RunHubMessage.ToolsMissing(missing)].join(RunHubFixture.Rows);
}

export const runHubRecordCases = {
  positive: [
    positive(
      "a run with one passing and one refuted step lists what it read and one lesson for each in the project hub",
      [RunHubScenario.ReadWrite],
      record(
        RunStatus.Failed,
        RunHubFixture.Seeds,
        true,
        RunHubFixture.Lessons,
        RunHubFixture.Lessons,
        0,
      ),
    ),
    positive(
      "choosing the home hub puts both lessons in the home hub and none in the project hub",
      [RunHubScenario.HomeScope],
      record(
        RunStatus.Failed,
        RunHubFixture.Seeds,
        true,
        RunHubFixture.Lessons,
        0,
        RunHubFixture.Lessons,
      ),
    ),
  ],
  negative: [
    rejected(
      "an empty hub lists no entries read but the read still comes before the first step",
      [RunHubScenario.NoMatches],
      record(RunStatus.Failed, 0, true, RunHubFixture.Lessons, RunHubFixture.Lessons, 0),
    ),
    rejected(
      "a run without a hub lists nothing read and nothing written",
      [RunHubScenario.NoHub],
      [RunStatus.Failed, 0, false, 0, 0, 0, ""].join(RunHubFixture.Space),
    ),
  ],
};

export const runHubToolsCases = {
  positive: [
    positive(
      "a worker persona gets kb_search and kb_add on top of its own tools",
      [RunHubScenario.WorkerTools],
      tools(
        [AgentTool.Read, KnowledgeTool.Search, KnowledgeTool.Add],
        [AgentTool.Read, KnowledgeTool.Search],
      ),
    ),
    positive(
      "the home scope run offers the same tools",
      [RunHubScenario.HomeScope],
      tools(
        [AgentTool.Read, KnowledgeTool.Search, KnowledgeTool.Add],
        [AgentTool.Read, KnowledgeTool.Search],
      ),
    ),
  ],
  negative: [
    rejected(
      "a checker persona does not get kb_add",
      [RunHubScenario.CheckerTools],
      tools(
        [AgentTool.Read, KnowledgeTool.Search, KnowledgeTool.Add],
        [AgentTool.Read, KnowledgeTool.Search],
      ),
    ),
    rejected(
      "a run without a hub adds no hub tools to any persona",
      [RunHubScenario.NoHub],
      tools([AgentTool.Read], [AgentTool.Read]),
    ),
  ],
};

export const runHubStartCases = {
  positive: [
    positive(
      "with both hub tools offered the run starts its steps",
      [RunHubScenario.ReadWrite],
      [RunStatus.Failed, RunHubFixture.Started, null].join(RunHubFixture.Rows),
    ),
    positive(
      "with no hub the run starts its steps",
      [RunHubScenario.NoHub],
      [RunStatus.Failed, RunHubFixture.Started, null].join(RunHubFixture.Rows),
    ),
  ],
  negative: [
    rejected(
      "a missing kb_search stops the run before any step and says why",
      [RunHubScenario.MissingSearch],
      blocked([KnowledgeTool.Search]),
    ),
    rejected(
      "a missing kb_add stops the run before any step and says why",
      [RunHubScenario.MissingAdd],
      blocked([KnowledgeTool.Add]),
    ),
  ],
};

export const runHubFinalizationCases = {
  positive: [
    positive("passed state waits for its journal", [true, false], {
      waited: true,
      state: RunStatus.Passed,
      final: true,
    }),
    positive("failed state waits for its journal", [false, false], {
      waited: true,
      state: RunStatus.Failed,
      final: true,
    }),
    positive("resume waits for a finishing blocked journal before passing", [true, false, true], {
      waited: true,
      state: RunStatus.Passed,
      final: true,
    }),
    positive("resume waits for a finishing blocked journal before refusal", [false, false, true], {
      waited: true,
      state: RunStatus.Failed,
      final: true,
    }),
  ],
  negative: [
    rejected("a resumed success cannot hide a journal failure", [true, true, true], {
      waited: true,
      state: RunStatus.Blocked,
      final: true,
    }),
    rejected("a resumed refusal cannot hide a journal failure", [false, true, true], {
      waited: true,
      state: RunStatus.Blocked,
      final: true,
    }),
    rejected("a failed passed-run journal exposes only the blocked state", [true, true], {
      waited: true,
      state: RunStatus.Blocked,
      final: true,
    }),
    rejected("a failed refused-run journal exposes only the blocked state", [false, true], {
      waited: true,
      state: RunStatus.Blocked,
      final: true,
    }),
  ],
};
