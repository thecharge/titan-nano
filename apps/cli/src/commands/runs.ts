import { resolve } from "node:path";
import {
  CliEventFormat,
  CliOption,
  CliOutput,
  CliRuntime,
  ErrorCode,
  ExitCode,
  IoLimit,
  KnowledgeScope,
  KnownHome,
  RunAction,
  ServerLimit,
  TextSymbol,
} from "@titan/constants";
import { isActiveRun, jsonByteLength, minutesLeft, runExitCode } from "@titan/core";
import { errorMessage, RunObservationError, TitanError } from "@titan/errors";
import { CliDiagnostic, CliOutputMessage, cliRunEvent, limitTimeLeft } from "@titan/messages";
import { parseArtifactSearch, parseEventSearch, parseRunListSearch } from "@titan/server/client";
import type {
  CliOptions,
  CommandContext,
  CommandHandler,
  CommandResult,
  KnownHomeResult,
  RunSnapshot,
} from "@titan/types";
import { CliEventLineSchema } from "@titan/types";
import { limitUntil } from "../limit-wait.ts";

export async function observe(context: CommandContext, run: RunSnapshot): Promise<RunSnapshot> {
  if (!context.options.watch) return run;
  const client = context.services.client(context.home);
  let current = run;
  let cursor = 0;
  if (!context.options[CliOption.Json]) cursor = await printEvents(context, run.run_id, cursor);
  while (isActiveRun(current.state)) {
    await context.services.wait(CliRuntime.PollMilliseconds);
    current = await client.get(run.run_id);
    if (!context.options[CliOption.Json]) cursor = await printEvents(context, run.run_id, cursor);
  }
  return current;
}

export async function runResult(context: CommandContext, run: RunSnapshot): Promise<CommandResult> {
  try {
    const data = await observe(context, run);
    const events = context.options.json
      ? await context.services.client(context.home).events(run.run_id)
      : undefined;
    return {
      data,
      ...(events ? { events } : {}),
      exitCode: context.options.watch ? runExitCode(data.state) : ExitCode.Success,
    };
  } catch (error) {
    if (error instanceof TitanError && error.exitCode === ExitCode.Transport)
      throw new RunObservationError(run.run_id, error);
    throw error;
  }
}

async function printEvents(context: CommandContext, id: string, after: number): Promise<number> {
  const client = context.services.client(context.home);
  let cursor = after;
  while (true) {
    const page = await client.events(id, { after: cursor });
    for (const event of page.events) context.emit(cliRunEvent(event.id, event.type, event.data));
    cursor = page.next_cursor;
    if (!page.has_more) return cursor;
  }
}
const control =
  (action: RunAction): CommandHandler =>
  async (context) => {
    const run = await context.services
      .client(context.home)
      .control(context.positionals[0] ?? TextSymbol.Empty, action);
    return runResult(context, run);
  };

async function followEvents(context: CommandContext): Promise<never> {
  const id = context.positionals[0] ?? TextSymbol.Empty;
  const client = context.services.client(context.home);
  const query = eventOptions(context.options);
  let after = query.after;
  while (true) {
    const page = await client.events(id, { ...query, after });
    for (const event of page.events) {
      const line = CliEventLineSchema.parse({
        ...event,
        schema_version: CliOutput.Version,
        run_id: id,
      });
      jsonByteLength(line, IoLimit.ResponseBytes);
      context.emit(
        context.options.format === CliEventFormat.JsonLines
          ? JSON.stringify(line)
          : cliRunEvent(event.id, event.type, event.data),
      );
    }
    after = page.next_cursor;
    if (!page.has_more) await context.services.wait(CliRuntime.PollMilliseconds);
  }
}

export const runHandlers = {
  usage: async ({ services, home, positionals: [argument] }) => ({
    data: await services.client(home).usage(argument ?? TextSymbol.Empty),
    exitCode: ExitCode.Success,
  }),
  artifact: async ({ services, home, positionals, options }) => ({
    data: await services
      .client(home)
      .artifact(
        positionals[0] ?? TextSymbol.Empty,
        positionals[1] ?? TextSymbol.Empty,
        artifactOptions(options),
      ),
    exitCode: ExitCode.Success,
  }),
  list: async ({ services, home, options, project }) => {
    const query = runListOptions(options);
    if (
      query.project_path !== undefined &&
      (options.scope === KnowledgeScope.Project || options[CliOption.Project] !== undefined) &&
      resolve(query.project_path) !== project
    )
      throw new TitanError(ErrorCode.Arguments, CliDiagnostic.ConflictingProjectSelectors);
    if (options.scope === KnowledgeScope.Project) {
      return {
        data: await services.client(home).list({ ...query, project_path: project }),
        exitCode: ExitCode.Success,
      };
    }
    if (options.scope === KnownHome.Scope) {
      const after = options[CliOption.HomeAfter] ?? TextSymbol.Empty;
      const registered = (await services.knownHomes?.(after)) ?? [];
      const homes = [...new Set([home, ...registered])]
        .filter((owner) => owner === null || owner > after)
        .sort();
      const lookup = services.existingRunClient ?? services.client;
      const inspect = async (owner: string | null): Promise<KnownHomeResult> => {
        if (owner === null) return { home: null, error: CliDiagnostic.InvalidHomeEntry };
        try {
          return { home: owner, page: await lookup(owner).list(query) };
        } catch (error) {
          return { home: owner, error: errorMessage(error) };
        }
      };
      const pages: Awaited<ReturnType<typeof inspect>>[] = [];
      let bytes = 0;
      let last = after;
      for (const owner of homes.slice(0, ServerLimit.KnownHomePageSize)) {
        let result = await inspect(owner);
        let size = jsonByteLength(result, IoLimit.ResponseBytes);
        if (size > IoLimit.ResponseBytes / 2) {
          result = { home: owner, error: CliDiagnostic.HomePageTooLarge };
          size = jsonByteLength(result, IoLimit.ResponseBytes);
        }
        if (bytes + size > IoLimit.ResponseBytes / 2) break;
        pages.push(result);
        bytes += size;
        if (owner !== null) last = owner;
      }
      const hasMore = pages.length < homes.length;
      return {
        data: { homes: pages, has_more: hasMore, next_home: hasMore ? last : null },
        exitCode: ExitCode.Success,
      };
    }
    return { data: await services.client(home).list(query), exitCode: ExitCode.Success };
  },
  events: async (context) => {
    if (context.options.follow) {
      return followEvents(context);
    }
    return {
      data: await context.services
        .client(context.home)
        .events(context.positionals[0] ?? TextSymbol.Empty, eventOptions(context.options)),
      exitCode: ExitCode.Success,
    };
  },
  status: async (context) => {
    const id = context.positionals[0] ?? TextSymbol.Empty;
    const client = context.services.client(context.home);
    if (!context.options.compact) return runResult(context, await client.get(id));
    let data = await client.get(id, true);
    while (context.options.watch && isActiveRun(data.state)) {
      await context.services.wait(CliRuntime.PollMilliseconds);
      data = await client.get(id, true);
    }
    return {
      data,
      exitCode: context.options.watch ? runExitCode(data.state) : ExitCode.Success,
    };
  },
  artifacts: async ({ services, home, positionals: [argument] }) => ({
    data: await services.client(home).artifacts(argument ?? TextSymbol.Empty),
    exitCode: ExitCode.Success,
  }),
  resume: async (context) => {
    const run = await context.services
      .client(context.home)
      .control(
        context.positionals[0] ?? TextSymbol.Empty,
        RunAction.Resume,
        context.options[CliOption.Backend],
      );
    const until = limitUntil(run.nodes, Date.now());
    if (until !== null && !context.options[CliOption.Backend] && !context.options[CliOption.Json])
      context.emit(limitTimeLeft(minutesLeft(until, Date.now())));
    return runResult(context, run);
  },
  pause: control(RunAction.Pause),
  cancel: control(RunAction.Cancel),
} satisfies Record<string, CommandHandler>;

export function artifactOptions(options: CliOptions) {
  return parseArtifactSearch({ offset: options.offset, limit: options.limit });
}
export function runListOptions(options: CliOptions) {
  if (
    options.scope !== undefined &&
    options.scope !== KnowledgeScope.Home &&
    options.scope !== KnowledgeScope.Project &&
    options.scope !== KnownHome.Scope
  )
    throw new TitanError(ErrorCode.Arguments, CliDiagnostic.RunScope);
  return parseRunListSearch({
    before: options.before,
    limit: options.limit,
    client_id: options[CliOption.ClientId],
    harness_session_id: options[CliOption.HarnessSessionId],
    project_path: options[CliOption.ProjectPath],
    state: options[CliOption.State],
  });
}
function eventOptions(options: CliOptions) {
  return parseEventSearch({ after: options.after, limit: options.limit });
}

export function validateEventOptions(options: CliOptions): void {
  eventOptions(options);
  if (options.follow && options.json)
    throw new TitanError(ErrorCode.Arguments, CliOutputMessage.FollowJson);
  if (options.format && (!options.follow || options.format !== CliEventFormat.JsonLines))
    throw new TitanError(ErrorCode.Arguments, CliOutputMessage.Format);
}
