import { ErrorCode, KnowledgeCliScopeCase, KnowledgeScopeFixture } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

const joiner = KnowledgeScopeFixture.Joiner;

export const knowledgeCliScopeCases = {
  positive: [
    positive(
      "add without a scope writes to the project hub only",
      [KnowledgeCliScopeCase.DefaultAdd],
      `true${joiner}false`,
    ),
    positive(
      "add with scope home writes to the home hub only",
      [KnowledgeCliScopeCase.HomeAdd],
      `false${joiner}true`,
    ),
    positive(
      "search shows entries of both hubs with their scope",
      [KnowledgeCliScopeCase.Search],
      `project${joiner}${KnowledgeScopeFixture.UtcTitle}${KnowledgeScopeFixture.Rows}home${joiner}${KnowledgeScopeFixture.ZoneTitle}`,
    ),
    positive(
      "update changes the entry in the hub that holds it",
      [KnowledgeCliScopeCase.UpdateHome],
      `home${joiner}2${joiner}${KnowledgeScopeFixture.ZoneBody}`,
    ),
    positive(
      "promote copies the project entry to the home hub",
      [KnowledgeCliScopeCase.Promote],
      `${KnowledgeScopeFixture.Nothing}${joiner}true${joiner}true`,
    ),
    positive(
      "stats counts the entries of each hub",
      [KnowledgeCliScopeCase.Stats],
      `project${joiner}1${joiner}1${KnowledgeScopeFixture.Rows}home${joiner}1${joiner}1`,
    ),
    positive(
      "stats no longer counts an entry that was read",
      [KnowledgeCliScopeCase.StatsAfterRead],
      `project${joiner}1${joiner}0${KnowledgeScopeFixture.Rows}home${joiner}1${joiner}1`,
    ),
    positive(
      "list shows the entries of both hubs with their scope",
      [KnowledgeCliScopeCase.List],
      `project${joiner}${KnowledgeScopeFixture.UtcTitle}${KnowledgeScopeFixture.Rows}home${joiner}${KnowledgeScopeFixture.ZoneTitle}`,
    ),
    positive(
      "a command waits for a project hub that another process holds",
      [KnowledgeCliScopeCase.WaitsForProject],
      KnowledgeScopeFixture.TwoScopes,
    ),
    positive(
      "show of a tagged entry reports no source hub",
      [KnowledgeCliScopeCase.ShowTagged],
      `clock${joiner}true`,
    ),
    positive(
      "show lists the entry that the body names",
      [KnowledgeCliScopeCase.ShowMention],
      `mentions${joiner}home${joiner}true`,
    ),
  ],
  negative: [
    rejected(
      "a project folder that is a file is refused at once",
      [KnowledgeCliScopeCase.ProjectIsFile],
      "true",
    ),
    rejected(
      "list with a limit that is not a number is refused",
      [KnowledgeCliScopeCase.ListBadLimit],
      ErrorCode.Arguments,
    ),
    rejected(
      "show of an unknown id is refused",
      [KnowledgeCliScopeCase.ShowMissing],
      ErrorCode.KnowledgeMissing,
    ),
    rejected(
      "an unknown scope is refused and nothing is written",
      [KnowledgeCliScopeCase.BadScope],
      `${ErrorCode.Arguments}${joiner}false`,
    ),
    rejected(
      "promoting an id the home hub already has is refused",
      [KnowledgeCliScopeCase.PromoteTwice],
      ErrorCode.KnowledgeConflict,
    ),
    rejected(
      "promoting an unknown id is refused",
      [KnowledgeCliScopeCase.PromoteMissing],
      ErrorCode.KnowledgeMissing,
    ),
    rejected(
      "delete removes the project entry so get is refused",
      [KnowledgeCliScopeCase.DeleteProject],
      `${KnowledgeScopeFixture.Nothing}${joiner}${ErrorCode.KnowledgeMissing}${joiner}false`,
    ),
  ],
};
