import type { BackendId } from "../agents.ts";

export type CapacityStart = () => void;
export interface CapacityWaiter {
  key: string;
  start: CapacityStart;
  backend: BackendId | null;
  max_parallel: number;
}
