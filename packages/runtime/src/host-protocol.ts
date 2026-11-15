import { AgentHost, ErrorCode } from "@titan/constants";
import { OperationalError, TitanError } from "@titan/errors";
import { AgentHostMessage } from "@titan/messages";
import { jsonByteLength } from "@titan/streams";

export function hostFrame<T>(value: T): T {
  try {
    jsonByteLength(value, AgentHost.MessageBytes);
  } catch (error) {
    if (error instanceof TitanError && error.code === ErrorCode.StreamLimit)
      throw new OperationalError(ErrorCode.ProtocolJson, AgentHostMessage.Size);
    throw hostProtocolError();
  }
  return value;
}

export function hostProtocolError(): OperationalError {
  return new OperationalError(ErrorCode.ProtocolJson, AgentHostMessage.Protocol);
}
