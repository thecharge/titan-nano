import { ErrorCode, RequestCliFixture } from "@titan/constants";
import { negative, positive } from "@titan/test-factories";

export const requestCliAliasCases = {
  positive: [
    positive(
      "the yes option approves the exact observed request",
      [RequestCliFixture.AgentApprove, true],
      true,
    ),
    positive(
      "the deny option preserves its supplied explanation",
      [RequestCliFixture.AgentDeny, true],
      true,
    ),
  ],
  negative: [
    negative(
      "conflicting answer options fail before client access",
      [RequestCliFixture.AgentApprove, true, true],
      { code: ErrorCode.Arguments },
    ),
    negative(
      "a positional decision cannot override a selected answer option",
      [RequestCliFixture.AgentDeny, true, true],
      { code: ErrorCode.Arguments },
    ),
  ],
};

export const requestCliCases = {
  positive: [
    positive("agent approves selected main request", [RequestCliFixture.AgentApprove], true),
    positive("agent denies selected main request", [RequestCliFixture.AgentDeny], true),
    positive("person approves selected human request", [RequestCliFixture.PersonApprove], true),
    positive("person denies selected human request", [RequestCliFixture.PersonDeny], true),
    positive("show inspects exact run and request", [RequestCliFixture.Read], true),
    positive("answer uses fresh address after restart", [RequestCliFixture.Reload], true),
  ],
  negative: [
    negative("missing reason fails before client", [RequestCliFixture.MissingReason], {
      code: ErrorCode.Arguments,
    }),
    negative("excessive reason fails before client", [RequestCliFixture.LongReason], {
      code: ErrorCode.Arguments,
    }),
    negative("missing observed version fails before client", [RequestCliFixture.MissingVersion], {
      code: ErrorCode.Arguments,
    }),
    negative("unsafe observed version fails before client", [RequestCliFixture.UnsafeVersion], {
      code: ErrorCode.Arguments,
    }),
    negative("missing client fails before client", [RequestCliFixture.MissingClient], {
      code: ErrorCode.Arguments,
    }),
    negative("blank reason fails before client", [RequestCliFixture.BlankReason], {
      code: ErrorCode.Arguments,
    }),
    negative("unsafe run fails before client", [RequestCliFixture.BadRun], {
      code: ErrorCode.InvalidId,
    }),
    negative("unsafe request fails before client", [RequestCliFixture.BadRequest], {
      code: ErrorCode.InvalidId,
    }),
    negative("stale version preserves pending request", [RequestCliFixture.Stale], {
      code: ErrorCode.RequestConflict,
    }),
    negative("repeated decision preserves first answer", [RequestCliFixture.Repeated], {
      code: ErrorCode.RequestConflict,
    }),
    negative("agent answer cannot grant human approval", [RequestCliFixture.HumanAgent], {
      code: ErrorCode.PermissionDenied,
    }),
    negative("person command refuses missing token", [RequestCliFixture.MissingToken], {
      code: ErrorCode.PermissionDenied,
    }),
    negative("person command refuses linked token", [RequestCliFixture.LinkedToken], {
      code: ErrorCode.PermissionDenied,
    }),
  ],
};
