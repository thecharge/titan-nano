import { ErrorCode, RequestLimit } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

export const requestQueueSettingCases = {
  positive: [
    positive(
      "owner request operation allowance has an explicit default",
      [{}],
      RequestLimit.PendingOperations,
    ),
    positive("owner can admit one request operation", [{ max_pending_request_operations: 1 }], 1),
    positive("owner can admit two request operations", [{ max_pending_request_operations: 2 }], 2),
  ],
  negative: [
    negative(
      "zero pending request operations is refused",
      [{ max_pending_request_operations: 0 }],
      { code: ErrorCode.InvalidConfig },
    ),
    negative(
      "excessive pending request operations is refused",
      [{ max_pending_request_operations: RequestLimit.PendingOperations + 1 }],
      { code: ErrorCode.InvalidConfig },
    ),
    negative(
      "fractional pending request operations is refused",
      [{ max_pending_request_operations: 1.5 }],
      { code: ErrorCode.InvalidConfig },
    ),
    negative(
      "text pending request operations is refused",
      [{ max_pending_request_operations: "2" }],
      { code: ErrorCode.InvalidConfig },
    ),
    negative(
      "project cannot lower owner request queue",
      [{ max_pending_request_operations: 1 }, false],
      { code: ErrorCode.OwnerSetting },
    ),
    negative(
      "project cannot raise owner request queue",
      [{ max_pending_request_operations: RequestLimit.PendingOperations }, false],
      { code: ErrorCode.OwnerSetting },
    ),
  ],
};
export const requestQueueCapacityCases = {
  positive: [
    positive("two runs can open requests while a peer is held", [2, false], true),
    positive("an independent answer proceeds while a peer is held", [2, true], true),
  ],
  negative: [
    rejected(
      "saturated owner queue refuses an independent opening then recovers",
      [1, false],
      true,
    ),
    rejected("saturated owner queue refuses an independent answer then recovers", [1, true], true),
  ],
};
