import {
  ErrorCode,
  ExitCode,
  KnowledgeCommand,
  KnowledgeKind,
  KnowledgeSearchMode,
} from "@titan/constants";
import { KnowledgeMessage } from "@titan/messages";
import { negative, positive } from "@titan/test-factories";

const id = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const draft = {
  kind: KnowledgeKind.Fact,
  title: "Time zones",
  tags: [],
  body: "Check time zones first",
};
const base = { schema_version: 1, revision: "a".repeat(64) };
const entry = { ...draft, id, version: 1 };
const record = { ...base, entry };
const updated = { ...base, entry: { ...entry, version: 2 } };
const deletion = { ...base, id, deleted_version: 1 };
const query = { question: "time zones", mode: KnowledgeSearchMode.Words, limit: 50 };
const page = {
  ...base,
  query,
  actual_mode: KnowledgeSearchMode.Words,
  warning: null,
  truncated: false,
  results: [],
};
const invalid = { code: ErrorCode.InvalidResponse, exitCode: ExitCode.Transport };
const badInput = { code: ErrorCode.KnowledgeInvalid };
const otherRecord = { ...record, entry: { ...entry, id: other } };
const changedRecord = { ...record, entry: { ...entry, body: "Other text" } };
const changedQuery = { ...page, query: { ...query, question: "other" } };
const outsideRow = {
  id,
  kind: entry.kind,
  title: entry.title,
  tags: [],
  version: 1,
  path: "/outside",
  matched: "[time] zones",
  score: null,
};
const outsidePage = { ...page, results: [outsideRow] };
export const knowledgeClientReplyCases = {
  positive: [
    positive("get accepts the selected entry", [KnowledgeCommand.Get, id, record], true),
    positive("add accepts the submitted draft", [KnowledgeCommand.Add, draft, record], true),
    positive(
      "update accepts the next version",
      [KnowledgeCommand.Update, { id, version: 1, entry: draft }, updated],
      true,
    ),
    positive(
      "delete accepts the selected version",
      [KnowledgeCommand.Delete, { id, version: 1 }, deletion],
      true,
    ),
    positive("search accepts the echoed empty page", [KnowledgeCommand.Search, query, page], true),
    positive(
      "reindex accepts validated usage",
      [KnowledgeCommand.Reindex, {}, { ...base, entries: 1, bytes: 200 }],
      true,
    ),
  ],
  negative: [
    negative("get rejects malformed responses", [KnowledgeCommand.Get, id, {}], invalid),
    negative("get rejects another entry", [KnowledgeCommand.Get, id, otherRecord], invalid),
    negative("add rejects substituted text", [KnowledgeCommand.Add, draft, changedRecord], invalid),
    negative("add rejects a later version", [KnowledgeCommand.Add, draft, updated], invalid),
    negative(
      "update rejects a stale result",
      [KnowledgeCommand.Update, { id, version: 1, entry: draft }, record],
      invalid,
    ),
    negative(
      "delete rejects another identity",
      [KnowledgeCommand.Delete, { id, version: 1 }, { ...deletion, id: other }],
      invalid,
    ),
    negative(
      "delete rejects another version",
      [KnowledgeCommand.Delete, { id, version: 1 }, { ...deletion, deleted_version: 2 }],
      invalid,
    ),
    negative(
      "search rejects another query",
      [KnowledgeCommand.Search, query, changedQuery],
      invalid,
    ),
    negative(
      "search rejects invented meaning mode",
      [KnowledgeCommand.Search, query, { ...page, actual_mode: KnowledgeSearchMode.Meaning }],
      invalid,
    ),
    negative(
      "search rejects a warning in words mode",
      [KnowledgeCommand.Search, query, { ...page, warning: "unexpected" }],
      invalid,
    ),
    negative(
      "search rejects an unrelated file path",
      [KnowledgeCommand.Search, query, outsidePage],
      invalid,
    ),
    negative(
      "reindex rejects invalid usage",
      [KnowledgeCommand.Reindex, {}, { ...base, entries: -1, bytes: 0 }],
      invalid,
    ),
    negative("get refuses an invalid id", [KnowledgeCommand.Get, "../escape", record], badInput),
    negative(
      "add refuses unknown fields",
      [KnowledgeCommand.Add, { ...draft, unknown: true }, record],
      badInput,
    ),
    negative(
      "update refuses zero version",
      [KnowledgeCommand.Update, { id, version: 0, entry: draft }, updated],
      badInput,
    ),
    negative(
      "delete refuses a missing version",
      [KnowledgeCommand.Delete, { id }, deletion],
      badInput,
    ),
    negative(
      "search refuses an unselected empty question",
      [KnowledgeCommand.Search, {}, page],
      badInput,
    ),
  ],
};

const argumentsError = { code: ErrorCode.Arguments };
export const knowledgeCliValidationCases = {
  positive: [
    positive(
      "knowledge command lists its operations locally",
      [["kb", "--json"]],
      ExitCode.Success,
    ),
    positive(
      "knowledge search help lists companion options",
      [["kb", "search", "--help", "--json"]],
      ExitCode.Success,
    ),
  ],
  negative: [
    negative(
      "update requires an observed version before loading files",
      [["kb", "update", id, "missing.md"]],
      argumentsError,
    ),
    negative("delete requires an observed version", [["kb", "delete", id]], argumentsError),
    negative(
      "zero entry version is refused",
      [["kb", "delete", id, "--entry-version", "0"]],
      argumentsError,
    ),
    negative(
      "unsafe entry version is refused",
      [["kb", "update", id, "missing.md", "--entry-version", "9007199254740992"]],
      argumentsError,
    ),
    negative(
      "path traversal cannot become an entry id",
      [["kb", "get", "../escape"]],
      argumentsError,
    ),
    negative("search requires a question or kind", [["kb", "search"]], argumentsError),
    negative(
      "search refuses an unknown kind",
      [["kb", "search", "time", "--kind", "unknown"]],
      argumentsError,
    ),
    negative(
      "search refuses an unknown mode",
      [["kb", "search", "time", "--mode", "unknown"]],
      argumentsError,
    ),
    negative(
      "search refuses fractional page syntax",
      [["kb", "search", "time", "--limit", "1.0"]],
      argumentsError,
    ),
    negative(
      "search refuses excessive count",
      [["kb", "search", "time", "--limit", "201"]],
      argumentsError,
    ),
  ],
};

export const knowledgeSearchReplyCases = {
  positive: [
    positive(
      "meaning responses retain their scores",
      [KnowledgeSearchMode.Meaning, KnowledgeSearchMode.Meaning, null, 0.8],
      true,
    ),
    positive(
      "combined responses retain semantic scores",
      [KnowledgeSearchMode.Both, KnowledgeSearchMode.Both, null, 0.6],
      true,
    ),
    positive(
      "combined responses allow word-only rows",
      [KnowledgeSearchMode.Both, KnowledgeSearchMode.Both, null, null],
      true,
    ),
    positive(
      "word fallback names a missing model",
      [
        KnowledgeSearchMode.Both,
        KnowledgeSearchMode.Words,
        KnowledgeMessage.MeaningUnavailable,
        null,
      ],
      true,
    ),
    positive(
      "word fallback names changed embedder",
      [KnowledgeSearchMode.Both, KnowledgeSearchMode.Words, KnowledgeMessage.EmbedderChanged, null],
      true,
    ),
  ],
  negative: [
    negative(
      "meaning responses cannot invent absent scores",
      [KnowledgeSearchMode.Meaning, KnowledgeSearchMode.Meaning, null, null],
      invalid,
    ),
    negative(
      "word responses cannot contain semantic scores",
      [KnowledgeSearchMode.Words, KnowledgeSearchMode.Words, null, 0.8],
      invalid,
    ),
    negative(
      "explicit meaning cannot silently become words",
      [KnowledgeSearchMode.Meaning, KnowledgeSearchMode.Words, null, null],
      invalid,
    ),
    negative(
      "combined fallback requires the reason",
      [KnowledgeSearchMode.Both, KnowledgeSearchMode.Words, null, null],
      invalid,
    ),
    negative(
      "meaning scores outside the valid range are refused",
      [KnowledgeSearchMode.Meaning, KnowledgeSearchMode.Meaning, null, 1.1],
      invalid,
    ),
  ],
};
