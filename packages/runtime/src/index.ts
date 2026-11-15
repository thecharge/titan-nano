import { resolveConfig, runtimeBuild } from "@titan/config";
import { Backend, ErrorCode, ProcessSignal, SignalEvent } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { unsupportedBackend } from "@titan/messages";
import { improveEarlier } from "@titan/runner";
import { startServer } from "@titan/server";
import {
  AgentHostSettingsSchema,
  type BackendFactory,
  type ImproveReport,
  type ImproveRequest,
  type ReadySink,
  type SignalSource,
} from "@titan/types";
import { HostedBackend } from "./hosted-backend.ts";
import { createHomeEmbedder } from "./local-model.ts";
import { nativeToolLaunch } from "./native-tools.ts";

export { nativeHostBackend, nativeHostPort, startAgentHost } from "./agent-host.ts";
export { hostFrame } from "./host-protocol.ts";
export { serveAgentHost } from "./host-service.ts";
export { hostTurn } from "./host-turn.ts";
export { HostedBackend, hostedTurn, spawnAgentHost } from "./hosted-backend.ts";

export function waitForStop(
  signals: SignalSource = process,
  cancellation?: AbortSignal,
): Promise<void> {
  return new Promise<void>((done) => {
    const stop = (): void => {
      signals.removeListener(ProcessSignal.Interrupt, stop);
      signals.removeListener(ProcessSignal.Terminate, stop);
      cancellation?.removeEventListener(SignalEvent.Abort, stop);
      done();
    };
    signals.once(ProcessSignal.Interrupt, stop);
    signals.once(ProcessSignal.Terminate, stop);
    cancellation?.addEventListener(SignalEvent.Abort, stop, { once: true });
    if (cancellation?.aborted) stop();
  });
}
async function backendFactory(home: string): Promise<BackendFactory> {
  const config = await resolveConfig({ home, project: home });
  const launches = config.value.server.backends;
  const host = AgentHostSettingsSchema.parse(config.value.server.agent_host);
  const { FakeBackend, ScriptedFakeBackend } = await import("@titan/backend-fake");
  const backends = {
    [Backend.Codex]: () => new HostedBackend(Backend.Codex, launches[Backend.Codex], host),
    [Backend.Claude]: () => new HostedBackend(Backend.Claude, launches[Backend.Claude], host),
    [Backend.Fake]: () => new FakeBackend(),
  };
  const factory: BackendFactory = (id, runConfig) => {
    const script = runConfig?.value.backends?.fake?.script;
    if (id === Backend.Fake && script) return new ScriptedFakeBackend(script);
    const create = backends[id];
    if (!create) throw new TitanError(ErrorCode.UnsupportedBackend, unsupportedBackend(id));
    return create();
  };
  return factory;
}

export async function improveEarlierRun(
  home: string,
  request: ImproveRequest,
): Promise<ImproveReport> {
  return improveEarlier(await backendFactory(home), { home, ...request });
}

export async function serveUntilStopped(
  home: string,
  ready: ReadySink,
  stopped?: () => Promise<void>,
): Promise<void> {
  const cancellation = new AbortController();
  const stopping = stopped ? stopped() : waitForStop(process, cancellation.signal);
  try {
    const build = await runtimeBuild(import.meta.path);
    const server = await startServer(home, await backendFactory(home), {
      ...(build ? { runtimeBuild: build } : {}),
      nativeTools: nativeToolLaunch(),
      embedders: [createHomeEmbedder(home)],
    });
    try {
      ready({ url: server.address.url, pid: server.address.pid });
      await Promise.race([stopping, server.stopped]);
    } finally {
      await server.stop();
    }
  } finally {
    cancellation.abort();
  }
}

export { claimHostFiles } from "./host-files.ts";
export { createHomeEmbedder, fetchLocalModel, inspectLocalModel } from "./local-model.ts";
