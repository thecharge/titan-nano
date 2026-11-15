import { ErrorCode, RequestPageFixture } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

export const requestPageCases = {
  positive: [
    positive(
      "escalated second version remains waiting",
      [RequestPageFixture.EscalatedWaiting],
      true,
    ),
    positive("person's third version is answered", [RequestPageFixture.EscalatedAnswered], true),
    positive(
      "older cursor survives catalog restart and newer insertion",
      [RequestPageFixture.Restart],
      true,
    ),
    positive(
      "all origins retain exact run and request identities",
      [RequestPageFixture.Plain],
      true,
    ),
    positive("count cursor continues within and across runs", [RequestPageFixture.Count], true),
    positive("byte allowance cuts a page before count allowance", [RequestPageFixture.Bytes], true),
    positive("empty filtered page advances its bounded run scan", [RequestPageFixture.Scan], true),
    positive(
      "origin and project filters combine by intersection",
      [RequestPageFixture.Filters],
      true,
    ),
    positive("explicit run selection limits catalog work", [RequestPageFixture.SingleRun], true),
    positive(
      "count can change while selection stays fixed",
      [RequestPageFixture.ChangedCount],
      true,
    ),
  ],
  negative: [
    rejected("unreadable run does not hide other requests", [RequestPageFixture.Unavailable], true),
    rejected("foreign request is reported as unavailable", [RequestPageFixture.WrongRun], true),
    rejected("oversized source inventory is refused", [RequestPageFixture.Capacity], true),
    rejected("oversized source record is unavailable", [RequestPageFixture.OversizedRecord], true),
    rejected("oversized project metadata is refused", [RequestPageFixture.BadProject], true),
    negative("zero page count fails admission", [RequestPageFixture.BadLimit], {
      code: ErrorCode.Arguments,
    }),
    negative("invalid cursor fails admission", [RequestPageFixture.BadCursor], {
      code: ErrorCode.Arguments,
    }),
    negative("unknown selector fails admission", [RequestPageFixture.UnknownQuery], {
      code: ErrorCode.Arguments,
    }),
    negative("changed filters cannot reuse a cursor", [RequestPageFixture.ChangedFilter], {
      code: ErrorCode.Arguments,
    }),
    negative("cursor cannot select an absent run", [RequestPageFixture.MissingCursorRun], {
      code: ErrorCode.Arguments,
    }),
    negative("cursor cannot skip an absent request", [RequestPageFixture.MissingCursorRequest], {
      code: ErrorCode.Arguments,
    }),
  ],
};
