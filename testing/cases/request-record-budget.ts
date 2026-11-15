import { ErrorCode, RequestTurnAdmissionFixture } from "@titan/constants";
import { negative, positive } from "@titan/test-factories";

export const requestRecordBudgetCases = {
  positive: [
    positive("large request and complete answer replay after reload", [8192, 4096], true),
    positive("near-limit request with short answer remains valid", [1024, 1], true),
  ],
  negative: [
    negative("opening metadata exceeds exact input allowance", [0, 1], {
      code: ErrorCode.InvalidRequest,
    }),
    negative("opening metadata exceeds remaining allowance", [64, 1], {
      code: ErrorCode.InvalidRequest,
    }),
    negative("complete answer exceeds small remaining allowance", [512, 4096], {
      code: ErrorCode.InvalidRequest,
    }),
    negative("complete answer exceeds larger remaining allowance", [1024, 4096], {
      code: ErrorCode.InvalidRequest,
    }),
  ],
};

export const requestTurnRecordAdmissionCases = {
  positive: [
    positive("large worker turn member reaches the publisher once", [8192, false], true),
    positive("near-limit checker turn member reaches the publisher once", [1024, true], true),
  ],
  negative: [
    negative("worker turn metadata exceeds exact member allowance", [0, false], {
      code: ErrorCode.InvalidRequest,
    }),
    negative("checker turn metadata exceeds remaining member allowance", [64, true], {
      code: ErrorCode.InvalidRequest,
    }),
    negative(
      "worker turn cannot substitute an execution",
      [8192, false, RequestTurnAdmissionFixture.Execution],
      {
        code: ErrorCode.PermissionDenied,
      },
    ),
    negative(
      "checker turn cannot substitute a native session",
      [8192, true, RequestTurnAdmissionFixture.Session],
      {
        code: ErrorCode.PermissionDenied,
      },
    ),
    negative(
      "expired worker turn cannot reach the publisher",
      [8192, false, RequestTurnAdmissionFixture.Expired],
      {
        code: ErrorCode.RequestExpired,
      },
    ),
    negative(
      "expired checker turn cannot reach the publisher",
      [8192, true, RequestTurnAdmissionFixture.Expired],
      {
        code: ErrorCode.RequestExpired,
      },
    ),
  ],
};
