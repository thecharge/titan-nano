import type { Readable, Writable } from "node:stream";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import {
  ConfigDefault,
  ErrorCode,
  IoLimit,
  NativeToolStdioEvent,
  Newline,
  ServerLimit,
  SignalEvent,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { NativeToolBridgeMessage } from "@titan/messages";
import { jsonByteLength } from "@titan/streams";

export class NativeStdioTransport extends StdioServerTransport {
  private stopped = new AbortController();
  private stopping: Promise<void> | undefined;
  private ended = () => {
    void this.close();
  };

  constructor(
    private input: Readable = process.stdin,
    private output: Writable = process.stdout,
    private timeout: number = ConfigDefault.HostStartupMilliseconds,
  ) {
    super(input, output, { maxBufferSize: ServerLimit.RequestBytes });
  }

  override async start(): Promise<void> {
    await super.start();
    this.input.once(NativeToolStdioEvent.End, this.ended);
    this.output.once(NativeToolStdioEvent.Close, this.ended);
    this.output.on(NativeToolStdioEvent.Error, this.ended);
    if (this.input.readableEnded) await this.close();
  }

  override async close(): Promise<void> {
    this.stopped.abort();
    this.input.off(NativeToolStdioEvent.End, this.ended);
    this.output.off(NativeToolStdioEvent.Close, this.ended);
    this.output.off(NativeToolStdioEvent.Error, this.ended);
    this.stopping ??= Promise.resolve().then(() => super.close());
    await this.stopping;
  }

  override async send(message: JSONRPCMessage): Promise<void> {
    jsonByteLength(message, IoLimit.ResponseBytes - 1);
    if (this.stopped.signal.aborted || this.output.destroyed || this.output.writableEnded)
      throw new TitanError(ErrorCode.ServerUnavailable, NativeToolBridgeMessage.Output);
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error | null): void => {
        clearTimeout(timer);
        this.stopped.signal.removeEventListener(SignalEvent.Abort, cancelled);
        if (error)
          reject(new TitanError(ErrorCode.ServerUnavailable, NativeToolBridgeMessage.Output));
        else resolve();
      };
      const cancelled = (): void => finish(new Error(NativeToolBridgeMessage.Output));
      const timer = setTimeout(this.ended, this.timeout);
      this.stopped.signal.addEventListener(SignalEvent.Abort, cancelled, { once: true });
      try {
        this.output.write(JSON.stringify(message) + Newline, finish);
      } catch {
        cancelled();
      }
    });
  }
}
