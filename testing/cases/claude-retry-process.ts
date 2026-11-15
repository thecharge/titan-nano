import { ErrorCode, VendorStubMode } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const claudeProcessRetryCases = {
  positive: [
    positive(
      "Claude worker rate limit crosses the host and daemon",
      [true, VendorStubMode.RateLimitOnce, 1],
      { passed: true, executions: 2, retries: 1, recoveries: 1, error: null },
    ),
    positive(
      "Claude checker service retry survives completed-run reload",
      [false, VendorStubMode.ServiceRetryOnce, 1],
      { passed: true, executions: 2, retries: 1, recoveries: 1, error: null },
    ),
  ],
  negative: [
    rejected(
      "repeated worker limits cannot refill after daemon death",
      [true, VendorStubMode.RateLimitAlways, 1],
      { passed: false, executions: 2, retries: 1, recoveries: 1, error: ErrorCode.RateLimited },
    ),
    rejected(
      "zero checker allowance survives daemon death",
      [false, VendorStubMode.RateLimitOnce, 0],
      { passed: false, executions: 1, retries: 0, recoveries: 0, error: ErrorCode.RateLimited },
    ),
  ],
};
