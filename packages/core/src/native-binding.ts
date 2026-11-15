import { ErrorCode } from "@titan/constants";
import { OperationalError } from "@titan/errors";
import { NativeToolBridgeMessage } from "@titan/messages";
import type { AgentSpec } from "@titan/types";
import { type NativeToolBinding, NativeToolBindingSchema } from "@titan/types/native-tools";

export function nativeBinding(
  spec: AgentSpec,
  input?: NativeToolBinding,
): NativeToolBinding | undefined {
  if (input === undefined) return undefined;
  const parsed = NativeToolBindingSchema.safeParse(input);
  if (
    !parsed.success ||
    parsed.data.connection.scope.run_id !== spec.run_id ||
    parsed.data.connection.scope.execution_id !== spec.execution_id
  )
    throw new OperationalError(ErrorCode.PermissionDenied, NativeToolBridgeMessage.Startup);
  return parsed.data;
}
