import type { AgentHostFactory, AgentHostStart, EventSink } from "@titan/types";
import { claimHostFiles } from "./host-files.ts";

export async function hostTurn(
  request: AgentHostStart,
  factory: AgentHostFactory,
  sink: EventSink,
  resources: AsyncDisposableStack,
) {
  await claimHostFiles(request.spec, resources);
  const backend = await factory(request);
  const session = request.session_id
    ? await backend.resume(request.session_id, request.spec, request.native_tools)
    : await backend.start(request.spec, request.native_tools);
  try {
    return await session.send(request.prompt, sink, new AbortController().signal);
  } finally {
    await session.close();
  }
}
