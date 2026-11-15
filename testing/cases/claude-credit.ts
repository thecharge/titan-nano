import { ClaudeCreditCode, ClaudeRetryCause, ErrorCode } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

const rate = { error: ClaudeRetryCause.RateLimit, errorCode: ClaudeCreditCode.Required };
const billing = { error: ClaudeRetryCause.BillingError, errorCode: ClaudeCreditCode.Required };
const completed = {
  completed: true,
  code: null,
  retryable: false,
  delay: 0,
  observed: 2,
  closed: 1,
};
const blocked = { ...completed, completed: false, code: ErrorCode.QuotaExhausted, observed: 1 };

export const claudeCreditCases = {
  positive: [
    positive(
      "ordinary rate notice retains the successful final result",
      [{ error: ClaudeRetryCause.RateLimit }],
      completed,
    ),
    positive(
      "billing notice without a credit code retains its final result",
      [{ error: ClaudeRetryCause.BillingError }],
      completed,
    ),
    positive(
      "a nested tool failure cannot classify the main turn",
      [{ ...rate, parent_tool_use_id: "nested-tool" }],
      completed,
    ),
    positive(
      "a malformed credit code cannot invent exhausted quota",
      [{ ...rate, errorCode: 1 }],
      completed,
    ),
    positive(
      "a different error cause cannot claim exhausted credits",
      [{ ...rate, error: ClaudeRetryCause.ServerError }],
      completed,
    ),
  ],
  negative: [
    rejected("explicit rate credit exhaustion stops before a final answer", [rate], blocked),
    rejected("explicit billing credit exhaustion starts no automatic retry", [billing], blocked),
  ],
};
