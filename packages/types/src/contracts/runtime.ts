import type { ProcessSignal } from "@titan/constants";

export interface SignalSource {
  once(signal: ProcessSignal, listener: () => void): unknown;
  removeListener(signal: ProcessSignal, listener: () => void): unknown;
}

import type { ServerReady } from "../transport.ts";
export type ReadySink = (address: ServerReady) => void;
