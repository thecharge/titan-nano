import { ErrorCode } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { VerificationMessage } from "@titan/messages";
import { readFileBytes } from "@titan/streams";

export async function readInventoryBytes(
  path: string,
  maximum: number,
  remaining: number = maximum,
): Promise<Buffer> {
  if (remaining < 1)
    throw new TitanError(ErrorCode.VerificationBudget, VerificationMessage.BoundaryBudget);
  return readFileBytes(path, Math.min(maximum, remaining));
}
