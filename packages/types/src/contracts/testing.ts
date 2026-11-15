import type { Run } from "../board.ts";
import type { KnowledgeCall } from "../knowledge.ts";
import type { AsyncTask } from "./util.ts";

export type DirectoryAction<T = unknown> = (directory: string) => Promise<T>;
export type TestHttpResponse = Response | ((request: Request) => Response | Promise<Response>);

export type ArtifactRunAction<T = unknown> = (run: Run, home: string) => Promise<T>;
export type CatalogAction<T = unknown> = (home: string, restart: AsyncTask<void>) => Promise<T>;
export type KnowledgeTestInvoke = (call: KnowledgeCall) => Promise<unknown>;
export type PackageProbeCommand = (args: string[], expected?: number) => Promise<unknown>;
