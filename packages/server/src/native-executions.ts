import { createSecretScanner, nativeAgentEnvironment } from "@titan/config";
import {
  ConfigDefault,
  ErrorCode,
  IoLimit,
  NativeTool,
  type NativeToolTransport,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { NativeToolMessage } from "@titan/messages";
import { jsonBytes } from "@titan/streams";
import {
  NativeToolConnectionSchema,
  type NativeToolCurrent,
  type NativeToolEndpoint,
  type NativeToolExecution,
  type NativeToolExecutionOwner,
  type NativeToolLaunch,
  NativeToolLaunchSchema,
  type NativeToolScope,
  NativeToolServerSettingsSchema,
} from "@titan/types";
import type { NativeToolAuthority } from "./native-tools.ts";

export class NativeExecutions implements NativeToolExecutionOwner {
  private launch;
  private timeout;
  constructor(
    private authority: NativeToolAuthority,
    private endpoint: NativeToolEndpoint,
    launch: NativeToolLaunch,
    timeout: number,
    private transport: NativeToolTransport = ConfigDefault.NativeTransport,
  ) {
    this.launch = NativeToolLaunchSchema.parse(launch);
    this.timeout = NativeToolServerSettingsSchema.parse({
      timeout_ms: timeout,
      transport,
    }).timeout_ms;
  }
  open(
    scope: NativeToolScope,
    current: NativeToolCurrent,
    runDirectory: string,
  ): NativeToolExecution {
    const parsed = NativeToolConnectionSchema.omit({ token: true }).safeParse({
      url: new URL(NativeTool.Route, this.endpoint()).href,
      scope,
      run_directory: runDirectory,
      timeout_ms: this.timeout,
    });
    if (!parsed.success) throw new TitanError(ErrorCode.Arguments, NativeToolMessage.Invalid);
    const lease = this.authority.open(parsed.data.scope, current);
    const connection = { ...parsed.data, token: lease.token };
    const scanner = () => createSecretScanner(nativeAgentEnvironment(connection));
    return {
      binding: { transport: this.transport, connection, launch: this.launch },
      scanner,
      guard: async (value) => {
        lease.guard();
        scanner().accept(await jsonBytes(value, IoLimit.DataBytes));
      },
      close: () => lease.close(),
    };
  }
}
