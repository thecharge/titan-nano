import { ErrorCode } from "@titan/constants";
import { OperationalError } from "@titan/errors";

export function retainSessionId(current: string | null, observed: string, message: string): string {
  if (current !== null && observed !== current)
    throw new OperationalError(ErrorCode.SessionUnavailable, message);
  return observed;
}
