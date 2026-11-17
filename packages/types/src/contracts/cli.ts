import type { CliOptions, CommandPositional, CommandResult, OptionName } from "../cli.ts";
import type { CliOutputContext } from "../cli-output.ts";
import type { DashboardClient } from "../dashboard.ts";
import type { ImproveReport, ImproveRequest } from "../improve-loop.ts";
import type { KnowledgeInput } from "../knowledge.ts";
import type { LocalModelStatus } from "../local-model.ts";
import type { RequestClient } from "../request-client.ts";
import type { SubmissionReceiptInput, SubmissionReceiptRecord } from "../submission-receipts.ts";
import type { RunClient } from "./client.ts";
import type { KnowledgeClient } from "./knowledge.ts";
import type { ReadySink } from "./runtime.ts";

export interface CliServices {
  inspectModel(home: string): Promise<LocalModelStatus>;
  fetchModel(home: string): Promise<LocalModelStatus>;
  notice(text: string): void;
  updateNotice?(home: string, version: string): Promise<string | null>;
  autoUpdate?(context: CommandContext, args: readonly string[]): Promise<number | null>;
  recoverRuntime?(
    context: CommandContext,
    args: readonly string[],
    version: string,
    build?: string,
  ): Promise<number | null>;
  handoff?(
    launcher: string,
    args: readonly string[],
    project: string,
    pinnedRuntime?: string,
  ): Promise<number>;
  prepareSubmission(home: string, input: SubmissionReceiptInput): Promise<SubmissionReceiptRecord>;
  loadData(path: string): Promise<unknown>;
  loadKnowledge(path: string): Promise<KnowledgeInput>;
  knowledge(home: string): KnowledgeClient;
  output(value: unknown, json: boolean, context?: CliOutputContext): void;
  client(home: string): RunClient;
  knownHomes?(after?: string): Promise<(string | null)[]>;
  existingRunClient?(home: string): RunClient;
  requests(home: string): RequestClient;
  dashboard(home: string): DashboardClient;
  improve(home: string, request: ImproveRequest): Promise<ImproveReport>;
  serve(home: string, ready: ReadySink, stopped?: () => Promise<void>): Promise<void>;
  mcp(home: string): Promise<unknown>;
  toolServer(): Promise<void>;
  wait(milliseconds: number): Promise<void>;
  launch(
    command: readonly string[],
    environment: Record<string, string | undefined>,
    cwd?: string,
  ): Promise<number>;
  program(name: string): string | null;
  sdk(name: string): boolean;
  executable?: readonly [string, string] | undefined;
  environment: Record<string, string | undefined>;
  cwd(): string;
  version: string;
  runtimeVersion: string;
}
export interface CommandContext {
  options: CliOptions;
  positionals: readonly string[];
  home: string;
  project: string;
  services: CliServices;
  emit(value: unknown): void;
}
export type CommandHandler = (context: CommandContext) => Promise<CommandResult>;

export interface CommandDefinition {
  description: string;
  positionals?: readonly CommandPositional[];
  subcommands?: Readonly<Record<string, CommandDefinition>>;
  options: readonly OptionName[];
  handler?: CommandHandler;
  validate?: (options: CliOptions) => void;
  protocol?: boolean;
}
