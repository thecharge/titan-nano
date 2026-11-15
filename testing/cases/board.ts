import {
  BoardFixture,
  ErrorCode,
  EventLogFixture,
  RunFormat,
  RunStatus,
  SnapshotReadFixture,
} from "@titan/constants";
import { BoardMessage } from "@titan/messages";
import { negative, positive, rejected } from "@titan/test-factories";

export const boardRecordCases = {
  positive: [
    positive("a source plan is retained in its versioned board record", ["persona-source"], true),
    positive("the persona binding format also accepts a plain workflow", ["persona-format"], true),
    positive("persona references survive durable board replay", ["persona-reference"], true),
    positive(
      "persona reference order does not change run identity",
      ["reordered-persona-reference"],
      true,
    ),
    positive(
      "inline persona references retain their declared names",
      ["inline-persona-reference"],
      true,
    ),
    positive("worker record survives durable replay", ["worker"], true),
    positive("checker record survives durable replay", ["checker"], true),
    positive("reconciliation receipt survives durable replay", ["reconciliation"], true),
    positive(
      "completed reconciliation receipt preserves its journal hash",
      ["completed-reconciliation"],
      true,
    ),
  ],
  negative: [
    negative("a run cannot replace its pinned persona version", ["changed-persona-reference"], {
      code: ErrorCode.CorruptBoard,
    }),
    negative("a run cannot discard its pinned persona references", ["removed-persona-reference"], {
      code: ErrorCode.CorruptBoard,
    }),
    negative(
      "replayed journals cannot replace a pinned persona version",
      ["replayed-persona-reference"],
      {
        code: ErrorCode.CorruptBoard,
      },
    ),
    negative("persona references require their record format", ["old-persona-reference"], {
      code: ErrorCode.CorruptBoard,
      message: BoardMessage.Record,
    }),
    negative("persona references cannot omit a declared persona", ["missing-persona-reference"], {
      code: ErrorCode.CorruptBoard,
      message: BoardMessage.Record,
    }),
    negative("persona references cannot substitute another name", ["wrong-persona-reference"], {
      code: ErrorCode.CorruptBoard,
      message: BoardMessage.Record,
    }),
    negative("persona references require positive saved versions", ["zero-persona-reference"], {
      code: ErrorCode.CorruptBoard,
      message: BoardMessage.Record,
    }),
    negative("a source plan cannot appear in an older board format", ["old-persona-source"], {
      code: ErrorCode.CorruptBoard,
      message: BoardMessage.Record,
    }),
    negative(
      "source persona resolution cannot change the original goal",
      ["changed-persona-source"],
      {
        code: ErrorCode.CorruptBoard,
        message: BoardMessage.Record,
      },
    ),
    negative("persona resolution preserves inline persona bodies", ["persona-source-binding"], {
      code: ErrorCode.CorruptBoard,
      message: BoardMessage.Record,
    }),
    negative("persona resolution cannot add an undeclared persona", ["persona-source-extra"], {
      code: ErrorCode.CorruptBoard,
      message: BoardMessage.Record,
    }),
    negative(
      "retained persona bindings must contain resolved bodies",
      ["persona-source-unresolved"],
      {
        code: ErrorCode.CorruptBoard,
        message: BoardMessage.Record,
      },
    ),
    negative("reconciliation requires its record format", ["old-reconciliation"], {
      code: ErrorCode.CorruptBoard,
      message: BoardMessage.Record,
    }),
    negative("reconciliation cannot point outside its run", ["outside-reconciliation"], {
      code: ErrorCode.CorruptBoard,
      message: BoardMessage.Record,
    }),
    negative("reconciliation cannot use a peer step's input", ["crossed-reconciliation"], {
      code: ErrorCode.CorruptBoard,
      message: BoardMessage.Record,
    }),
    negative("reconciliation requires a retained worker receipt", ["empty-reconciliation"], {
      code: ErrorCode.CorruptBoard,
      message: BoardMessage.Record,
    }),
    negative(
      "completed reconciliation requires a journal-bound candidate",
      ["completed-unsealed-reconciliation"],
      { code: ErrorCode.CorruptBoard, message: BoardMessage.Record },
    ),
    negative(
      "reconciliation cannot archive a checker as a worker receipt",
      ["checker-reconciliation"],
      { code: ErrorCode.CorruptBoard, message: BoardMessage.Record },
    ),
    negative("missing planned node is refused", ["missing-node"], {
      code: ErrorCode.CorruptBoard,
      message: BoardMessage.Record,
    }),
    negative("unplanned node is refused", ["extra-node"], {
      code: ErrorCode.CorruptBoard,
      message: BoardMessage.Record,
    }),
    negative("read claims require their record format", ["old-reads"], {
      code: ErrorCode.CorruptBoard,
      message: BoardMessage.Record,
    }),
    negative("read observations require their record format", ["old-observations"], {
      code: ErrorCode.CorruptBoard,
      message: BoardMessage.Record,
    }),
    negative("pending capture requires its record format", ["old-receipt"], {
      code: ErrorCode.CorruptBoard,
      message: BoardMessage.Record,
    }),
    negative("outside input workspace is refused", ["outside-workspace"], {
      code: ErrorCode.CorruptBoard,
      message: BoardMessage.Record,
    }),
    negative("input workspace with parent segments is refused", ["parent-workspace"], {
      code: ErrorCode.CorruptBoard,
      message: BoardMessage.Record,
    }),
  ],
};

export const boardValidationCases = {
  positive: [
    positive("changed valid configuration is revalidated", [true, true], true),
    positive("changed valid plan is revalidated", [false, true], true),
  ],
  negative: [
    rejected("changed configuration cannot reuse earlier validation", [true, false], true),
    rejected("changed plan cannot reuse earlier validation", [false, false], true),
  ],
};

export const boardCases = {
  positive: [
    positive("replay respects the captured committed version", [BoardFixture.Cutoff], {
      ids: [1, 2, 3, 4],
      version: 8,
    }),
    positive("parallel appends retain consecutive IDs", [BoardFixture.Parallel], {
      ids: [1, 2, 3, 4, 5, 6, 7, 8],
      version: 8,
    }),
    positive("incomplete tail is repaired before appending", [BoardFixture.TrailingWrite], {
      ids: [1, 2, 3, 4, 5, 6, 7, 8],
      version: 8,
    }),
  ],
  negative: [
    negative("complete invalid JSON is corruption", [BoardFixture.InvalidJson], {
      code: ErrorCode.CorruptBoard,
    }),
    negative("negative usage cannot enter replay", [BoardFixture.InvalidUsage], {
      code: ErrorCode.CorruptBoard,
    }),
    negative("duplicate sequence is corruption", [BoardFixture.DuplicateSequence], {
      code: ErrorCode.CorruptBoard,
    }),
  ],
};

export const durableSnapshotCases = {
  positive: [
    positive("committed reads detach from mutable state", [SnapshotReadFixture.Commit], {
      state: RunStatus.Passed,
      version: 2,
    }),
    positive("replayed reads detach from caller changes", [SnapshotReadFixture.Reload], {
      state: RunStatus.Passed,
      version: 2,
    }),
  ],
  negative: [
    negative("uninitialized store has no committed snapshot", [SnapshotReadFixture.Empty], {
      code: ErrorCode.RunNotFound,
    }),
    negative(
      "failed append cannot acknowledge pending state",
      [SnapshotReadFixture.AppendFailure],
      { code: "EISDIR" },
    ),
    negative(
      "failed projection keeps writer failed until explicit reload",
      [SnapshotReadFixture.ProjectionFailure],
      { code: "EISDIR" },
    ),
  ],
};

export const durableEventLogCases = {
  positive: [
    positive(
      "new run event log shares the durable append sequence",
      [EventLogFixture.Created],
      true,
    ),
    positive("legacy replay recreates the missing event log", [EventLogFixture.Legacy], true),
  ],
  negative: [
    rejected("symbolic event log cannot alias the journal", [EventLogFixture.Symbolic], true),
    rejected(
      "replaced event log cannot acknowledge a stale projection",
      [EventLogFixture.Replaced],
      true,
    ),
    rejected(
      "event log directory refuses acknowledgement until repaired",
      [EventLogFixture.Directory],
      true,
    ),
  ],
};

export const receiptRecordCases = {
  positive: [
    positive(
      "pending worker receipt survives replay",
      [RunFormat.CaptureReceipts, true, true, false, true],
      true,
    ),
    positive(
      "completed receipt format remains readable",
      [RunFormat.CaptureReceipts, true, false, true, true],
      true,
    ),
  ],
  negative: [
    rejected(
      "old record format cannot retain a pending receipt",
      [RunFormat.PinnedRuntime, true, true, false, false],
      true,
    ),
    rejected(
      "checker cannot use worker checkpoint receipt",
      [RunFormat.CaptureReceipts, false, true, false, false],
      true,
    ),
    rejected(
      "pending capture cannot be marked completed",
      [RunFormat.CaptureReceipts, true, true, true, false],
      true,
    ),
  ],
};

export const inspectBoardCases = {
  positive: [
    positive(
      "inspection reads the complete journal without creating an index",
      [false, false],
      true,
    ),
    positive("inspection preserves a trailing interrupted record", [true, false], true),
  ],
  negative: [
    rejected("empty journal inspection refuses a missing run", [false, true], true),
    rejected("inspection does not create a missing run directory", [true, true], true),
  ],
};
