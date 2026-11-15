import {
  ErrorCode,
  KnowledgeCommand,
  KnowledgeKind,
  KnowledgeLimitField,
  KnowledgePublicationStage,
} from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

const boundedFact = "---\nkind: fact\ntitle: Rent\n---\nMonthly rent";
const boundedFactValue = {
  kind: KnowledgeKind.Fact,
  title: "Rent",
  tags: [],
  body: "Monthly rent",
};

export const knowledgeHubInputCases = {
  positive: [
    positive("hub admits a valid new fact", [KnowledgeCommand.Add, boundedFactValue], true),
    positive(
      "hub reads its retained fact",
      [KnowledgeCommand.Get, "11111111-1111-4111-8111-111111111111"],
      true,
    ),
    positive(
      "hub searches valid input",
      [KnowledgeCommand.Search, { question: "time zones" }],
      true,
    ),
  ],
  negative: [
    negative("hub rejects malformed addition before publication", [KnowledgeCommand.Add, {}], {
      code: ErrorCode.KnowledgeInvalid,
    }),
    negative(
      "hub rejects a supplied future initial version",
      [KnowledgeCommand.Add, { ...boundedFactValue, version: 2 }],
      { code: ErrorCode.KnowledgeInvalid },
    ),
    negative(
      "hub cannot reuse a committed identity",
      [KnowledgeCommand.Add, { ...boundedFactValue, id: "11111111-1111-4111-8111-111111111111" }],
      { code: ErrorCode.KnowledgeConflict },
    ),
    negative("hub rejects malformed update before publication", [KnowledgeCommand.Update, {}], {
      code: ErrorCode.KnowledgeInvalid,
    }),
    negative(
      "hub rejects changing a committed entry kind",
      [
        KnowledgeCommand.Update,
        {
          id: "11111111-1111-4111-8111-111111111111",
          version: 1,
          entry: { ...boundedFactValue, kind: KnowledgeKind.Lesson },
        },
      ],
      { code: ErrorCode.KnowledgeInvalid },
    ),
    negative("hub rejects malformed deletion before publication", [KnowledgeCommand.Delete, {}], {
      code: ErrorCode.KnowledgeInvalid,
    }),
    negative("hub rejects malformed search input", [KnowledgeCommand.Search, { question: 7 }], {
      code: ErrorCode.KnowledgeInvalid,
    }),
  ],
};

export const knowledgeLiveConsistencyCases = {
  positive: [
    positive("unchanged live fact matches its committed hash", [KnowledgeKind.Fact, false], true),
    positive(
      "unchanged live lesson can rebuild its index",
      [KnowledgeKind.Lesson, false, true],
      true,
    ),
  ],
  negative: [
    negative("live fact cannot adopt externally changed bytes", [KnowledgeKind.Fact, true], {
      code: ErrorCode.KnowledgeCorrupt,
    }),
    negative("live lesson cannot adopt externally changed bytes", [KnowledgeKind.Lesson, true], {
      code: ErrorCode.KnowledgeCorrupt,
    }),
    negative("failed fact reindex fences later reads", [KnowledgeKind.Fact, true, true], {
      code: ErrorCode.KnowledgeCorrupt,
    }),
    negative("failed lesson reindex fences later reads", [KnowledgeKind.Lesson, true, true], {
      code: ErrorCode.KnowledgeCorrupt,
    }),
  ],
};

export const knowledgeFormatCases = {
  positive: [
    positive(
      "fact fits its exact encoded byte allowance",
      [boundedFact, Buffer.byteLength(boundedFact)],
      boundedFactValue,
    ),
    positive(
      "fact fits a larger encoded byte allowance",
      [boundedFact, Buffer.byteLength(boundedFact) + 1],
      boundedFactValue,
    ),
    positive(
      "Markdown fact admits its header and body",
      ["---\nkind: fact\ntitle: Rent in Sofia\n---\nMonthly rent"],
      { kind: KnowledgeKind.Fact, title: "Rent in Sofia", tags: [], body: "Monthly rent" },
    ),
    positive(
      "YAML persona admits its role text",
      ["kind: persona\ntitle: Skeptic\nbody: Challenge the result"],
      { kind: KnowledgeKind.Persona, title: "Skeptic", tags: [], body: "Challenge the result" },
    ),
  ],
  negative: [
    negative(
      "valid fact exceeding its byte allowance is refused",
      [boundedFact, Buffer.byteLength(boundedFact) - 1],
      { code: ErrorCode.KnowledgeInvalid },
    ),
    negative(
      "multibyte fact exceeding its encoded byte allowance is refused",
      [`${boundedFact} €`, boundedFact.length + 2],
      { code: ErrorCode.KnowledgeInvalid },
    ),
    negative(
      "ordinary YAML cannot bypass Markdown",
      ["kind: fact\ntitle: Rent\nbody: Monthly rent"],
      { code: ErrorCode.KnowledgeInvalid },
    ),
    negative(
      "persona Markdown cannot bypass YAML",
      ["---\nkind: persona\ntitle: Skeptic\n---\nChallenge"],
      { code: ErrorCode.KnowledgeInvalid },
    ),
    negative(
      "unknown header metadata is refused",
      ["---\nkind: fact\ntitle: Rent\nunknown: true\n---\nRent"],
      { code: ErrorCode.KnowledgeInvalid },
    ),
    negative("unterminated header is refused", ["---\nkind: fact\ntitle: Rent"], {
      code: ErrorCode.KnowledgeInvalid,
    }),
  ],
};

const roundTrip = {
  matches: true,
  sameRevision: true,
  history: true,
  versions: true,
  fallback: true,
  recovered: true,
  final: true,
  indexed: true,
};
export const knowledgeRoundTripCases = {
  positive: [
    positive(
      "fact retains files, versions and word search",
      [KnowledgeKind.Fact, false],
      roundTrip,
    ),
    positive(
      "lesson survives removal of both projections",
      [KnowledgeKind.Lesson, false],
      roundTrip,
    ),
  ],
  negative: [
    rejected("deleted fact cannot return after reindex", [KnowledgeKind.Fact, true], roundTrip),
    rejected(
      "deleted lesson cannot leave a search result",
      [KnowledgeKind.Lesson, true],
      roundTrip,
    ),
  ],
};
const recovery = {
  interrupted: true,
  fenced: true,
  journal: true,
  recovered: true,
  history: true,
  indexed: true,
  cleared: true,
};
export const knowledgeRecoveryCases = {
  positive: [
    positive(
      "update replays its durable intent",
      [KnowledgePublicationStage.Journal, false],
      recovery,
    ),
    positive(
      "update resumes after retained history",
      [KnowledgePublicationStage.History, false],
      recovery,
    ),
    positive(
      "delete replays its durable intent",
      [KnowledgePublicationStage.Journal, true],
      recovery,
    ),
    positive(
      "delete resumes after retained history",
      [KnowledgePublicationStage.History, true],
      recovery,
    ),
  ],
  negative: [
    rejected(
      "updated file without index acknowledgement is repaired",
      [KnowledgePublicationStage.File, false],
      recovery,
    ),
    rejected(
      "updated index without acknowledgement is repaired",
      [KnowledgePublicationStage.Index, false],
      recovery,
    ),
    rejected(
      "deleted file without index acknowledgement is repaired",
      [KnowledgePublicationStage.File, true],
      recovery,
    ),
    rejected(
      "deleted index without acknowledgement is repaired",
      [KnowledgePublicationStage.Index, true],
      recovery,
    ),
  ],
};

const conflict = {
  code: ErrorCode.KnowledgeConflict,
  version: 1,
  history: false,
  unchanged: true,
  healthy: true,
};
export const knowledgeVersionCases = {
  positive: [
    positive(
      "current fact version can update",
      [KnowledgeCommand.Update, KnowledgeKind.Fact, false],
      { code: null, version: 2, history: true, unchanged: false, healthy: true },
    ),
    positive(
      "current lesson version can delete",
      [KnowledgeCommand.Delete, KnowledgeKind.Lesson, false],
      { code: null, version: null, history: true, unchanged: false, healthy: true },
    ),
  ],
  negative: [
    rejected(
      "stale fact update cannot overwrite",
      [KnowledgeCommand.Update, KnowledgeKind.Fact, true],
      conflict,
    ),
    rejected(
      "stale lesson delete cannot remove",
      [KnowledgeCommand.Delete, KnowledgeKind.Lesson, true],
      conflict,
    ),
    rejected(
      "persona deletion cannot bypass human approval",
      [KnowledgeCommand.Delete, KnowledgeKind.Persona, false],
      { ...conflict, code: ErrorCode.PermissionDenied },
    ),
  ],
};
const admitted = { refused: false, absent: false, unchanged: true, healthy: true, clean: true };
const refused = { ...admitted, refused: true, absent: true };
export const knowledgeAdmissionCases = {
  positive: [
    positive(
      "two entries fit the configured ceiling",
      [KnowledgeLimitField.Entries, false],
      admitted,
    ),
    positive(
      "entry fits the exact byte ceiling",
      [KnowledgeLimitField.EntryBytes, false],
      admitted,
    ),
    positive(
      "entries fit the exact total byte ceiling",
      [KnowledgeLimitField.TotalBytes, false],
      admitted,
    ),
    positive(
      "readable index fits its allowance",
      [KnowledgeLimitField.IndexBytes, false],
      admitted,
    ),
  ],
  negative: [
    rejected(
      "entry count refuses before publication",
      [KnowledgeLimitField.Entries, true],
      refused,
    ),
    rejected(
      "entry bytes refuse before publication",
      [KnowledgeLimitField.EntryBytes, true],
      refused,
    ),
    rejected(
      "total bytes refuse before publication",
      [KnowledgeLimitField.TotalBytes, true],
      refused,
    ),
    rejected(
      "index bytes refuse before publication",
      [KnowledgeLimitField.IndexBytes, true],
      refused,
    ),
  ],
};

const shutdown = {
  closed: true,
  lateRefused: true,
  firstSettled: true,
  secondSettled: true,
  retained: true,
};
export const knowledgeShutdownCases = {
  positive: [
    positive("full fact queue drains before closing", [KnowledgeKind.Fact, false], shutdown),
    positive("full lesson queue drains before closing", [KnowledgeKind.Lesson, false], shutdown),
  ],
  negative: [
    rejected(
      "failed fact publication cannot prevent closing",
      [KnowledgeKind.Fact, true],
      shutdown,
    ),
    rejected(
      "failed lesson publication cannot prevent closing",
      [KnowledgeKind.Lesson, true],
      shutdown,
    ),
  ],
};
