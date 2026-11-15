import type { LocalModelStatus } from "../local-model.ts";

export type LocalModelFetch = (url: string, options: RequestInit) => Promise<Response>;

export interface LocalModelCache {
  readonly directory: string;
  readonly revision: string;
  inspect(): Promise<LocalModelStatus>;
}
