import { ErrorCode, RequestPageClientFixture } from "@titan/constants";
import { negative, positive } from "@titan/test-factories";

export const requestPageClientCases = {
  positive: [
    positive("selected response retains exact filters", [RequestPageClientFixture.Selected], true),
    positive("empty selection is valid", [RequestPageClientFixture.Empty], true),
  ],
  negative: [
    negative("malformed response is refused", [RequestPageClientFixture.Malformed], {
      code: ErrorCode.InvalidResponse,
    }),
    negative("changed query is refused", [RequestPageClientFixture.Query], {
      code: ErrorCode.InvalidResponse,
    }),
    negative("foreign caller is refused", [RequestPageClientFixture.Caller], {
      code: ErrorCode.InvalidResponse,
    }),
    negative("foreign session is refused", [RequestPageClientFixture.Session], {
      code: ErrorCode.InvalidResponse,
    }),
    negative("foreign project is refused", [RequestPageClientFixture.Project], {
      code: ErrorCode.InvalidResponse,
    }),
    negative("foreign run is refused", [RequestPageClientFixture.Run], {
      code: ErrorCode.InvalidResponse,
    }),
    negative("foreign state is refused", [RequestPageClientFixture.State], {
      code: ErrorCode.InvalidResponse,
    }),
    negative("count overflow is refused", [RequestPageClientFixture.Count], {
      code: ErrorCode.InvalidResponse,
    }),
    negative("duplicate identities are refused", [RequestPageClientFixture.Duplicate], {
      code: ErrorCode.InvalidResponse,
    }),
    negative("stalled cursor is refused", [RequestPageClientFixture.Cursor], {
      code: ErrorCode.InvalidResponse,
    }),
    negative("response byte overflow is refused", [RequestPageClientFixture.Bytes], {
      code: ErrorCode.InvalidResponse,
    }),
    negative("invalid caller count fails before transport", [RequestPageClientFixture.Input], {
      code: ErrorCode.Arguments,
    }),
    negative("query getter is not evaluated", [RequestPageClientFixture.Accessor], {
      code: ErrorCode.Arguments,
    }),
  ],
};
