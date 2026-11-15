import { ClaudeRetryCause, ClaudeRetryLimit, ErrorCode } from "@titan/constants";
import { OperationalError } from "@titan/errors";
import { ClaudeMessage } from "@titan/messages";
import { ClaudeRetrySchema } from "@titan/types/agents";

export function claudeRetry(event: unknown): OperationalError {
  const parsed = ClaudeRetrySchema.safeParse(event);
  if (!parsed.success)
    return new OperationalError(ErrorCode.ClaudeProtocol, ClaudeMessage.InvalidRetry);
  const retry = parsed.data;
  if (
    retry.error === ClaudeRetryCause.RateLimit &&
    retry.error_status === ClaudeRetryLimit.RateLimitStatus
  )
    return new OperationalError(
      ErrorCode.RateLimited,
      ClaudeMessage.RateLimited,
      true,
      retry.retry_delay_ms,
    );
  if (
    retry.error_status !== null &&
    retry.error_status >= ClaudeRetryLimit.ServiceStatusMinimum &&
    (retry.error === ClaudeRetryCause.Overloaded || retry.error === ClaudeRetryCause.ServerError)
  )
    return new OperationalError(
      ErrorCode.ProviderUnavailable,
      ClaudeMessage.ServiceUnavailable,
      true,
      retry.retry_delay_ms,
    );
  return new OperationalError(ErrorCode.ClaudeExecution, ClaudeMessage.UnknownRetry);
}
