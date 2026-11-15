import { BoardLimit, ErrorCode, EventInspectionTransport } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

export const journalPageCases = {
  positive: [
    positive("count cap stops with a resumable cursor", [[1, 1], 0, 2], {
      ids: [1, 2],
      cursor: 2,
      more: true,
    }),
    positive("byte cap stops before accumulating the next event", [[600_000, 600_000], 0, 1000], {
      ids: [1, 2],
      cursor: 2,
      more: true,
    }),
    positive("last page retains only events after its cursor", [[1, 1], 2, 2], {
      ids: [3],
      cursor: 3,
      more: false,
    }),
    positive("latest cursor returns a stable empty page", [[1, 1], 3, 2], {
      ids: [],
      cursor: 3,
      more: false,
    }),
  ],
  negative: [
    negative("one oversized event fails explicitly", [[BoardLimit.EventPageBytes], 1, 2], {
      code: ErrorCode.EventSize,
    }),
    negative("future cursor cannot silently omit history", [[1, 1], 4, 2], {
      code: ErrorCode.EventCursor,
    }),
  ],
};

export const eventInspectionCases = {
  positive: [
    positive(
      "HTTP drains 1-event pages without gaps or duplicates",
      [EventInspectionTransport.Http, 1, false],
      true,
    ),
    positive(
      "HTTP drains 3-event pages without gaps or duplicates",
      [EventInspectionTransport.Http, 3, false],
      true,
    ),
    positive(
      "CLI drains 1-event pages without gaps or duplicates",
      [EventInspectionTransport.Cli, 1, false],
      true,
    ),
    positive(
      "CLI drains 3-event pages without gaps or duplicates",
      [EventInspectionTransport.Cli, 3, false],
      true,
    ),
    positive(
      "MCP drains 1-event pages without gaps or duplicates",
      [EventInspectionTransport.Mcp, 1, false],
      true,
    ),
    positive(
      "MCP drains 3-event pages without gaps or duplicates",
      [EventInspectionTransport.Mcp, 3, false],
      true,
    ),
  ],
  negative: [
    rejected(
      "HTTP rejects duplicate selectors",
      [EventInspectionTransport.Http, 2, false, "&after=0"],
      true,
    ),
    rejected(
      "HTTP rejects unknown selectors",
      [EventInspectionTransport.Http, 2, false, "&unknown=1"],
      true,
    ),
    rejected("HTTP refuses zero page size", [EventInspectionTransport.Http, 0, false], true),
    rejected("HTTP refuses future cursor", [EventInspectionTransport.Http, 2, true], true),
    rejected("CLI refuses zero page size", [EventInspectionTransport.Cli, 0, false], true),
    rejected("CLI refuses future cursor", [EventInspectionTransport.Cli, 2, true], true),
    rejected("MCP refuses zero page size", [EventInspectionTransport.Mcp, 0, false], true),
    rejected("MCP refuses future cursor", [EventInspectionTransport.Mcp, 2, true], true),
  ],
};

export const eventSearchCases = {
  positive: [
    positive("empty search uses bounded defaults", [{}], {
      after: 0,
      limit: BoardLimit.EventPageSize,
    }),
    positive("explicit decimal selectors become numbers", [{ after: "12", limit: "2" }], {
      after: 12,
      limit: 2,
    }),
  ],
  negative: [
    negative("unsafe cursor is rejected", [{ after: "9007199254740992" }], {
      code: ErrorCode.Arguments,
    }),
    negative("fractional cursor is rejected", [{ after: "1.5" }], { code: ErrorCode.Arguments }),
    negative("exponent notation is rejected", [{ after: "1e2" }], { code: ErrorCode.Arguments }),
    negative("page size cannot exceed the cap", [{ limit: String(BoardLimit.EventPageSize + 1) }], {
      code: ErrorCode.Arguments,
    }),
  ],
};

const eventPage = {
  schema_version: BoardLimit.EventPageVersion,
  run_id: "run",
  after: 0,
  events: [{ id: 1, time: 0, type: "committed", data: null }],
  next_cursor: 1,
  has_more: false,
};
const responseError = { code: ErrorCode.InvalidResponse, exitCode: 4 };

export const eventResponseCases = {
  positive: [
    positive(
      "empty page retains requested cursor",
      [{ ...eventPage, after: 4, events: [], next_cursor: 4 }, { after: 4 }],
      true,
    ),
    positive("committed event page parses at boundary", [eventPage], true),
    positive(
      "nonempty continuation advances exactly",
      [
        {
          ...eventPage,
          after: 4,
          events: [{ ...eventPage.events[0], id: 5 }],
          next_cursor: 5,
          has_more: true,
        },
        { after: 4, limit: 1 },
      ],
      true,
    ),
  ],
  negative: [
    negative("legacy array cannot masquerade as page", [[]], responseError),
    negative(
      "negative response cursor is transport error",
      [{ ...eventPage, next_cursor: -1 }],
      responseError,
    ),
    negative("wrong version is refused", [{ ...eventPage, schema_version: 2 }], responseError),
    negative(
      "missing version is refused",
      [{ run_id: "run", after: 0, events: [], next_cursor: 0, has_more: false }],
      responseError,
    ),
    negative("substituted run is refused", [{ ...eventPage, run_id: "other" }], responseError),
    negative(
      "substituted cursor is refused",
      [{ ...eventPage, after: 1, events: [{ ...eventPage.events[0], id: 2 }], next_cursor: 2 }],
      responseError,
    ),
    negative(
      "too many requested events are refused",
      [
        {
          ...eventPage,
          events: [...eventPage.events, { ...eventPage.events[0], id: 2 }],
          next_cursor: 2,
        },
        { limit: 1 },
      ],
      responseError,
    ),
    negative(
      "duplicated events are refused",
      [{ ...eventPage, events: [...eventPage.events, ...eventPage.events] }],
      responseError,
    ),
    negative(
      "skipped event is refused",
      [{ ...eventPage, events: [{ ...eventPage.events[0], id: 2 }], next_cursor: 2 }],
      responseError,
    ),
    negative(
      "reversed events are refused",
      [{ ...eventPage, events: [{ ...eventPage.events[0], id: 2 }, ...eventPage.events] }],
      responseError,
    ),
    negative("stalled cursor is refused", [{ ...eventPage, next_cursor: 0 }], responseError),
    negative(
      "empty page cannot claim more",
      [{ ...eventPage, events: [], next_cursor: 0, has_more: true }],
      responseError,
    ),
    negative("unrequested fields are refused", [{ ...eventPage, hidden: true }], responseError),
    negative(
      "oversized event page is refused",
      [
        {
          ...eventPage,
          events: [{ ...eventPage.events[0], data: "x".repeat(BoardLimit.EventPageBytes) }],
        },
      ],
      responseError,
    ),
  ],
};
