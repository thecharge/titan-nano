import { positive, rejected } from "@titan/test-factories";

export const workflowCreationCases = {
  positive: [
    positive("create reviewed workflow with a home reviewer", ["reviewed", "home"], true),
    positive("create parallel workflow with a project reviewer", ["parallel", "project"], true),
  ],
  negative: [
    rejected("refuse an unknown template", ["unknown", "home"], true),
    rejected("refuse an unknown exact project reviewer", ["reviewed", "missing"], true),
  ],
};

export const personaCreationCases = {
  positive: [
    positive("create a portable persona with a read tool", ["Read", false], true),
    positive("create a portable persona with a search tool", ["Grep", false], true),
  ],
  negative: [
    rejected("refuse an unknown tool", ["unknown", false], true),
    rejected("preserve an existing persona file", ["Read", true], true),
  ],
};

export const scopedPersonaDeliveryCases = {
  positive: [
    positive("retain project persona history across restart", ["project", false], true),
    positive("retain home persona history across restart", ["home", false], true),
    positive(
      "retain project persona when the selected home is the project hub",
      ["shared", false],
      true,
    ),
  ],
  negative: [
    rejected("refuse deleted project persona without home fallback", ["project", true], true),
    rejected("refuse deleted home persona without project fallback", ["home", true], true),
    rejected("refuse deleted project persona in a shared home", ["shared", true], true),
  ],
};

export const workspaceSkillInspectionCases = {
  positive: [
    positive(
      "resolve a canonical Codex skill link ahead of the configured user skill",
      [".codex", "link"],
      true,
    ),
    positive(
      "resolve a canonical Claude skill link ahead of the configured user skill",
      [".claude", "link"],
      true,
    ),
  ],
  negative: [
    rejected("refuse a Codex skill link outside the project", [".codex", "escape"], true),
    rejected("refuse a Claude skill link outside the project", [".claude", "escape"], true),
  ],
};

export const workspaceSnapshotSelectionCases = {
  positive: [
    positive("preserve selected script writes in a cache directory", [".cache", true], true),
    positive("preserve selected script writes in generated content", [".velite", true], true),
  ],
  negative: [
    rejected("omit unselected generated content from a full snapshot", [".velite", false], true),
    rejected("omit unselected development caches from a full snapshot", [".next-dev", false], true),
  ],
};
