import { AgentHost, AgentHostKind } from "@titan/constants";
import { classifyError } from "@titan/errors";
import type {
  AgentHostFactory,
  AgentHostOutput,
  AgentHostPort,
  EventSink,
  NativeToolPreflight,
} from "@titan/types";
import { AgentHostInputSchema } from "@titan/types/agent-host";
import { hostFrame, hostProtocolError } from "./host-protocol.ts";
import { hostTurn } from "./host-turn.ts";

export function serveAgentHost(
  port: AgentHostPort,
  factory: AgentHostFactory,
  resources: AsyncDisposableStack,
): void {
  let started = false;
  let acknowledgement: ReturnType<typeof Promise.withResolvers<void>> | null = null;
  const acknowledged = async (message: AgentHostOutput): Promise<void> => {
    if (acknowledgement) throw hostProtocolError();
    acknowledgement = Promise.withResolvers<void>();
    const accepted = acknowledgement.promise;
    port.send(hostFrame(message));
    await accepted;
  };
  const readiness: NativeToolPreflight = () => acknowledged({ type: AgentHostKind.NativeReady });
  const create: AgentHostFactory = (request) => factory(request, readiness);
  const sink: EventSink = (event) => acknowledged({ type: AgentHostKind.Event, event });
  const fail = (error: unknown): void => {
    const failure = classifyError(error);
    port.send(
      hostFrame({
        type: AgentHostKind.Error,
        code: failure.code.slice(0, AgentHost.ErrorCodeCharacters),
        message: failure.message.slice(0, AgentHost.ErrorMessageCharacters),
        retryable: failure.retryable,
        retry_after_ms: failure.retryAfterMs,
      }),
    );
  };
  port.disconnected(() => port.stop());
  const receive = (raw: unknown): void => {
    const request = AgentHostInputSchema.parse(hostFrame(raw));
    if (request.type === AgentHostKind.Ack && !acknowledgement) throw hostProtocolError();
    if (request.type === AgentHostKind.Ack) {
      acknowledgement?.resolve();
      acknowledgement = null;
      return;
    }
    if (started) throw hostProtocolError();
    started = true;
    void hostTurn(request, create, sink, resources)
      .then((answer) => {
        port.send(hostFrame({ type: AgentHostKind.Answer, answer }));
      })
      .catch(fail);
  };
  port.receive((raw) => {
    try {
      receive(raw);
    } catch (error) {
      fail(error);
    }
  });
  port.send({ type: AgentHostKind.Ready });
}
