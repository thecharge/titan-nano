import {
  AgentEventKind,
  AgentHostKind,
  HostReadinessFixture,
  HostReadinessMode,
  TextSymbol,
} from "@titan/constants";

const mode = process.argv[2];
const usage = { input_tokens: 1, output_tokens: 1, cost_usd: null };
const result = {
  text: TextSymbol.Empty,
  json: { delivered: true },
  session_id: HostReadinessFixture.Session,
  usage,
};
const answer = { type: AgentHostKind.Answer, answer: result };
const event = { type: AgentEventKind.Session, session_id: null, data: {} };
let repeated = false;
let emitted = false;
process.on("message", (request) => {
  if (request.type === AgentHostKind.NativeReady) {
    process.send(answer);
    return;
  }
  if (request.type === AgentHostKind.Ack && mode === HostReadinessMode.Accepted && !emitted) {
    emitted = true;
    process.send({ type: AgentHostKind.Event, event });
    return;
  }
  if (request.type === AgentHostKind.Ack) {
    const repeat = mode === HostReadinessMode.Duplicate && !repeated;
    repeated = true;
    process.send(repeat ? { type: AgentHostKind.NativeReady } : answer);
    return;
  }
  if (mode === HostReadinessMode.EarlyAnswer) {
    process.send(answer);
    return;
  }
  if (mode === HostReadinessMode.EarlyEvent) {
    process.send({ type: AgentHostKind.Event, event });
    return;
  }
  process.send({ type: AgentHostKind.NativeReady });
});
process.send({ type: AgentHostKind.Ready });
