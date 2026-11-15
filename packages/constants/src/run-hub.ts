import { KnowledgeKind, KnowledgeTool } from "./knowledge.ts";

export const RunHubLimit = {
  Matches: 5,
  Terms: 8,
  MinimumTerm: 3,
  Page: 5,
  JournalLessons: 4096,
} as const;

export const RunHubKinds = [KnowledgeKind.Lesson, KnowledgeKind.Plan] as const;

export const RunHubTools = {
  Worker: [KnowledgeTool.Search, KnowledgeTool.Add],
  Checker: [KnowledgeTool.Search],
} as const;

export enum RunHubOutcome {
  Passed = "passed",
  Refuted = "refuted",
}

export const RunJournal = { Tag: "journal", Id: "journal" } as const;

export enum RunJournalScenario {
  Finished = "finished",
  Passed = "passed",
  Cancelled = "cancelled",
  NoHub = "no-hub",
  Unwritable = "unwritable",
  UnwritablePassed = "unwritable-passed",
  Next = "next",
  NextPassed = "next-passed",
}

export const RunJournalFixture = {
  Home: "home",
  ChangedFile: "report.txt",
  ChangedContent: "the report",
  Goal: "Find why the report omits the time zone",
  Client: "run-journal-client",
  Plan: "plan",
  Worker: "worker",
  Checker: "checker",
  PassStep: "passing",
  RefuteStep: "failing",
  Task: "do the step",
  Check: "check the step",
  Evidence: "Evidence: the zone is missing",
  Marker: "marker",
  Persona: { description: "Persona", role: "Contract role", model: "stub-model" },
  Attempts: 1,
  Space: " ",
  Rows: ";",
  Join: "|",
  Occupied: "occupied",
  Limit: 20,
} as const;

export const RunHubFixture = {
  Home: "home",
  Goal: "Find why the report omits the time zone",
  Seed: "report time zone",
  Other: "time",
  Seeds: 2,
  SeedText: "check time zones before the report",
  Client: "run-hub-client",
  Plan: "plan",
  Worker: "worker",
  Checker: "checker",
  PassStep: "passing",
  RefuteStep: "failing",
  Task: "do the step",
  Check: "check the step",
  Evidence: "Evidence: the zone is missing",
  Marker: "marker",
  Join: "|",
  Space: " ",
  Persona: { description: "Persona", role: "Contract role", model: "stub-model" },
  Attempts: 1,
  Lessons: 2,
  Started: 4,
  Rows: ";",
} as const;

export enum RunHubScenario {
  ReadWrite = "read-write",
  NoMatches = "no-matches",
  HomeScope = "home-scope",
  WorkerTools = "worker-tools",
  CheckerTools = "checker-tools",
  NoHub = "no-hub",
  MissingSearch = "missing-search",
  MissingAdd = "missing-add",
  Empty = "empty",
}
