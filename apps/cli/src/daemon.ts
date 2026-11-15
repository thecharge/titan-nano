import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveConfig, runtimeBuild } from "@titan/config";
import {
  AgentHost,
  CliCommand,
  CliRuntime,
  DaemonStartup,
  EmbeddedRuntimeBuild,
  ErrorCode,
  ExitCode,
  HttpHeader,
  IoLimit,
  LocalServer,
  McpIdentity,
  Packaging,
  ProbeOption,
  ProcessIo,
  ProcessSignal,
  ServerRoute,
  UpdateFile,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { ServerMessage, serverVersionMismatch } from "@titan/messages";
import { readAddress } from "@titan/server/client";
import { ownMaintenance, ownStoppedHome, requestServerStop } from "@titan/server/maintenance";
import { readBytes } from "@titan/streams";
import { type DaemonProcess, type DaemonStartupServices, ServerHealthSchema } from "@titan/types";

export function daemonEntry(source = import.meta.path): string {
  return source.endsWith(AgentHost.SourceExtension)
    ? fileURLToPath(import.meta.resolve(DaemonStartup.CliEntry))
    : resolve(import.meta.dir, Packaging.Bundle);
}

export async function probeDaemon(
  home: string,
  timeout: number,
  version: string | null = McpIdentity.Version,
  build?: string | null,
): Promise<boolean> {
  try {
    const address = await readAddress(home);
    const response = await fetch(new URL(ServerRoute.Health, address.url), {
      headers: { [HttpHeader.Authorization]: LocalServer.Bearer + address.token },
      signal: AbortSignal.timeout(Math.max(1, Math.ceil(timeout))),
    });
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      return false;
    }
    const bytes = await readBytes(response.body, IoLimit.AddressBytes);
    const parsed = ServerHealthSchema.safeParse(JSON.parse(bytes.toString()));
    if (!parsed.success) return false;
    if (version !== null && parsed.data.version !== version)
      throw new TitanError(
        ErrorCode.ServerVersion,
        serverVersionMismatch(parsed.data.version, version),
        ExitCode.Transport,
      );
    const expectedBuild = build === undefined ? await runtimeBuild(import.meta.path) : build;
    if (
      version !== null &&
      expectedBuild &&
      response.headers.get(HttpHeader.RuntimeBuild) !== EmbeddedRuntimeBuild &&
      response.headers.get(HttpHeader.RuntimeBuild) !== expectedBuild
    )
      throw new TitanError(
        ErrorCode.ServerVersion,
        ServerMessage.BuildMismatch,
        ExitCode.Transport,
      );
    return true;
  } catch (error) {
    if (error instanceof TitanError && error.code === ErrorCode.ServerVersion) throw error;
    return false;
  }
}

export const daemonStartupServices: DaemonStartupServices = {
  probe: probeDaemon,
  stopIdle: stopIdleDaemon,
  launch: launchDaemon,
  now: () => performance.now(),
  wait: (milliseconds) => Bun.sleep(milliseconds),
};

function launchDaemon(home: string, entry = daemonEntry(), version?: string): DaemonProcess {
  return Bun.spawn(
    [process.execPath, entry, CliCommand.Serve, ProbeOption.Home, home, CliRuntime.JsonFlag],
    {
      env: { ...process.env, ...(version ? { [UpdateFile.PinnedRuntime]: version } : {}) },
      detached: true,
      stdin: ProcessIo.Ignore,
      stdout: ProcessIo.Ignore,
      stderr: ProcessIo.Ignore,
    },
  );
}

export async function ensureDaemon(
  home: string,
  services: DaemonStartupServices = daemonStartupServices,
): Promise<void> {
  const config = await resolveConfig({ home, project: home });
  const timeout = config.value.server.startup_timeout_ms ?? DaemonStartup.TimeoutMilliseconds;
  const deadline = services.now() + timeout;
  try {
    if (await services.probe(home, Math.min(timeout, DaemonStartup.ProbeMilliseconds))) return;
  } catch (error) {
    if (
      !(error instanceof TitanError) ||
      error.code !== ErrorCode.ServerVersion ||
      !services.stopIdle
    )
      throw error;
    await services.stopIdle(home);
  }
  if (services.now() >= deadline) throw startupFailure();
  let child: DaemonProcess;
  try {
    child = services.launch(home);
  } catch {
    throw startupFailure();
  }
  let connected = false;
  try {
    connected = await waitForDaemon(home, deadline, services);
    if (!connected) throw startupFailure();
    child.unref();
  } finally {
    if (!connected && child.exitCode === null) child.kill(ProcessSignal.Kill);
    if (!connected) await child.exited;
  }
}

export async function stopIdleDaemon(home: string): Promise<void> {
  await using resources = new AsyncDisposableStack();
  await ownMaintenance(home, resources);
  const running = await probeDaemon(home, DaemonStartup.ProbeMilliseconds, null);
  if (running) await requestServerStop(home);
  await ownStoppedHome(home, resources);
}

function startupFailure(): TitanError {
  return new TitanError(
    ErrorCode.ServerUnavailable,
    ServerMessage.StartupFailed,
    ExitCode.Transport,
  );
}

async function waitForDaemon(
  home: string,
  deadline: number,
  services: DaemonStartupServices,
): Promise<boolean> {
  while (services.now() < deadline) {
    const remaining = deadline - services.now();
    if (await services.probe(home, Math.min(remaining, DaemonStartup.ProbeMilliseconds)))
      return true;
    await services.wait(
      Math.min(DaemonStartup.PollMilliseconds, Math.max(0, deadline - services.now())),
    );
  }
  return false;
}
