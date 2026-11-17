import { setTimeout } from "node:timers/promises";
import {
  CliOption,
  CliPositionals,
  CliRuntime,
  ErrorCode,
  ExitCode,
  KnowledgeCommand,
  KnowledgeLimit,
  KnowledgeScope,
  TextSymbol,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import {
  inspectPendingKnowledge,
  KnowledgeHub,
  localMeaning,
  projectHubHome,
  ScopedKnowledgeHub,
} from "@titan/knowledge";
import { KnowledgeMessage } from "@titan/messages";
import { createHomeEmbedder } from "@titan/runtime";
import {
  type CliOptions,
  type CommandContext,
  type CommandDefinition,
  type CommandHandler,
  KnowledgeDraftSchema,
  KnowledgeMaintenanceQuerySchema,
  KnowledgeScopeSchema,
  KnowledgeSearchSchema,
  KnowledgeUpdateSchema,
  ScopedKnowledgeHistoryWindowSchema,
  ScopedKnowledgeListSchema,
} from "@titan/types";

import { rememberHome } from "../known-homes.ts";

function knowledgeScope(options: CliOptions): KnowledgeScope {
  const parsed = KnowledgeScopeSchema.safeParse(options.scope ?? KnowledgeScope.Project);
  if (!parsed.success) throw new TitanError(ErrorCode.Arguments, KnowledgeMessage.ScopeInvalid);
  return parsed.data;
}

async function openProject(home: string, modelHome: string): Promise<KnowledgeHub> {
  let failure: unknown;
  for (let attempt = 1; attempt <= KnowledgeLimit.OpenAttempts; attempt += 1) {
    try {
      return await KnowledgeHub.open(
        home,
        {},
        undefined,
        localMeaning(home, createHomeEmbedder(modelHome)),
      );
    } catch (error) {
      failure = error;
      if (!(error instanceof TitanError && error.code === ErrorCode.ServerLocked)) break;
      await setTimeout(KnowledgeLimit.OpenWaitMilliseconds);
    }
  }
  throw failure;
}

async function withProject<T>(
  context: CommandContext,
  action: (hub: KnowledgeHub) => Promise<T>,
): Promise<T> {
  await rememberHome(context.home);
  const hub = await openProject(projectHubHome(context.project), context.home);
  try {
    return await action(hub);
  } finally {
    await hub.close();
  }
}

async function withScoped<T>(
  context: CommandContext,
  action: (hub: ScopedKnowledgeHub) => Promise<T>,
): Promise<T> {
  return withProject(context, async (project) => {
    const scoped = ScopedKnowledgeHub.join(
      project,
      context.services.knowledge(context.home),
      undefined,
      (scope, query) =>
        inspectPendingKnowledge(
          scope === KnowledgeScope.Project ? projectHubHome(context.project) : context.home,
          query,
        ),
    );
    try {
      return await action(scoped);
    } finally {
      await scoped.close();
    }
  });
}

function knowledgeVersion(options: CliOptions): number {
  const raw = options[CliOption.EntryVersion] ?? TextSymbol.Empty;
  const version = CliRuntime.PositiveIntegerPattern.test(raw) ? Number(raw) : 0;
  if (!Number.isSafeInteger(version) || version < 1)
    throw new TitanError(ErrorCode.Arguments, KnowledgeMessage.Version);
  return version;
}

function maintenanceOptions(options: CliOptions) {
  knowledgeScope(options);
  const parsed = KnowledgeMaintenanceQuerySchema.safeParse({
    apply: options.apply,
    before: options.before,
  });
  if (!parsed.success)
    throw new TitanError(ErrorCode.Arguments, KnowledgeMessage.MaintenanceInvalid);
  return parsed.data;
}

function knowledgeSearch(options: CliOptions, question?: string) {
  if (options.limit !== undefined && !CliRuntime.PositiveIntegerPattern.test(options.limit))
    throw new TitanError(ErrorCode.Arguments, KnowledgeMessage.Search);
  const parsed = KnowledgeSearchSchema.safeParse({
    question,
    ...(options.all === undefined ? {} : { all: options.all }),
    ...(options.kind === undefined ? {} : { kind: options.kind }),
    mode: options.mode,
    limit: options.limit === undefined ? undefined : Number(options.limit),
  });
  if (!parsed.success) throw new TitanError(ErrorCode.Arguments, KnowledgeMessage.Search);
  return parsed.data;
}

function knowledgeList(options: CliOptions) {
  if (options.limit !== undefined && !CliRuntime.PositiveIntegerPattern.test(options.limit))
    throw new TitanError(ErrorCode.Arguments, KnowledgeMessage.ListInvalid);
  const parsed = ScopedKnowledgeListSchema.safeParse({
    kind: options.kind,
    scope: options.scope,
    tag: options.tag,
    state: options.state,
    limit: options.limit === undefined ? undefined : Number(options.limit),
  });
  if (!parsed.success) throw new TitanError(ErrorCode.Arguments, KnowledgeMessage.ListInvalid);
  return parsed.data;
}

function knowledgeHistory(options: CliOptions) {
  for (const value of [options.before, options.limit])
    if (value !== undefined && !CliRuntime.PositiveIntegerPattern.test(value))
      throw new TitanError(ErrorCode.Arguments, KnowledgeMessage.ListInvalid);
  const parsed = ScopedKnowledgeHistoryWindowSchema.safeParse({
    scope: options.scope,
    before: options.before === undefined ? undefined : Number(options.before),
    limit: options.limit === undefined ? undefined : Number(options.limit),
  });
  if (!parsed.success) throw new TitanError(ErrorCode.Arguments, KnowledgeMessage.ListInvalid);
  return parsed.data;
}

const knowledgeHandlers = {
  list: async (context) => {
    const query = knowledgeList(context.options);
    return {
      data: await withScoped(context, (hub) => hub.list(query)),
      exitCode: ExitCode.Success,
    };
  },
  stats: async (context) => ({
    data: await withScoped(context, (hub) => hub.stats()),
    exitCode: ExitCode.Success,
  }),
  show: async (context) => {
    const { scope, ...history } = knowledgeHistory(context.options);
    return {
      data: await withScoped(context, (hub) =>
        hub.show(context.positionals[0] ?? TextSymbol.Empty, scope, history),
      ),
      exitCode: ExitCode.Success,
    };
  },
  help: async () => ({
    data: { description: KnowledgeMessage.Command, subcommands: Object.values(KnowledgeCommand) },
    exitCode: ExitCode.Success,
  }),
  add: async (context) => {
    const scope = knowledgeScope(context.options);
    const input = await context.services.loadKnowledge(context.positionals[0] ?? TextSymbol.Empty);
    const result =
      scope === KnowledgeScope.Home
        ? await context.services.knowledge(context.home).add(input)
        : await withProject(context, (project) => project.add(input));
    return { data: { ...result, scope }, exitCode: ExitCode.Success };
  },
  get: async (context) => ({
    data: await withScoped(context, (hub) => hub.get(context.positionals[0] ?? TextSymbol.Empty)),
    exitCode: ExitCode.Success,
  }),
  update: async (context) => {
    const { positionals, options } = context;
    const version = knowledgeVersion(options);
    const entry = await context.services.loadKnowledge(positionals[1] ?? TextSymbol.Empty);
    if (
      (entry.id !== undefined && entry.id !== positionals[0]) ||
      (entry.version !== undefined && entry.version !== version)
    )
      throw new TitanError(ErrorCode.Arguments, KnowledgeMessage.ImportedIdentity);
    const input = KnowledgeUpdateSchema.safeParse({
      id: positionals[0],
      version,
      entry: KnowledgeDraftSchema.strip().parse(entry),
    });
    if (!input.success) throw new TitanError(ErrorCode.Arguments, KnowledgeMessage.Invalid);
    return {
      data: await withScoped(context, async (hub) =>
        hub.hub((await hub.get(input.data.id)).scope).update(input.data),
      ),
      exitCode: ExitCode.Success,
    };
  },
  delete: async (context) => {
    const version = knowledgeVersion(context.options);
    const id = context.positionals[0] ?? TextSymbol.Empty;
    return {
      data: await withScoped(context, async (hub) =>
        hub.hub((await hub.get(id)).scope).delete({ id, version }),
      ),
      exitCode: ExitCode.Success,
    };
  },
  search: async (context) => {
    const query = knowledgeSearch(context.options, context.positionals[0]);
    return {
      data: await withScoped(context, (hub) => hub.search(query)),
      exitCode: ExitCode.Success,
    };
  },
  prune: async (context) => {
    const scope = knowledgeScope(context.options);
    const input = maintenanceOptions(context.options);
    return {
      data: {
        ...(await withScoped(context, (hub) =>
          hub.hub(scope).maintenance(KnowledgeCommand.Prune, input),
        )),
        scope,
      },
      exitCode: ExitCode.Success,
    };
  },
  consolidate: async (context) => {
    const scope = knowledgeScope(context.options);
    const input = maintenanceOptions(context.options);
    return {
      data: {
        ...(await withScoped(context, (hub) =>
          hub.hub(scope).maintenance(KnowledgeCommand.Consolidate, input),
        )),
        scope,
      },
      exitCode: ExitCode.Success,
    };
  },
  restore: async (context) => {
    const scope = knowledgeScope(context.options);
    return {
      data: {
        ...(await withScoped(context, (hub) =>
          hub.hub(scope).restore(context.positionals[0] ?? TextSymbol.Empty),
        )),
        scope,
      },
      exitCode: ExitCode.Success,
    };
  },
  promote: async (context) => ({
    data: {
      ...(await withScoped(context, (hub) =>
        hub.promote(context.positionals[0] ?? TextSymbol.Empty),
      )),
      scope: KnowledgeScope.Home,
    },
    exitCode: ExitCode.Success,
  }),
  reindex: async ({ services, home }) => ({
    data: await services.knowledge(home).reindex(),
    exitCode: ExitCode.Success,
  }),
} satisfies Record<string, CommandHandler>;

const knowledgeSubcommands = {
  [KnowledgeCommand.Prune]: {
    description: KnowledgeMessage.Prune,
    options: [
      CliOption.Home,
      CliOption.Project,
      CliOption.Scope,
      CliOption.Apply,
      CliOption.Before,
    ],
    validate: maintenanceOptions,
    handler: knowledgeHandlers.prune,
  },
  [KnowledgeCommand.Consolidate]: {
    description: KnowledgeMessage.Consolidate,
    options: [
      CliOption.Home,
      CliOption.Project,
      CliOption.Scope,
      CliOption.Apply,
      CliOption.Before,
    ],
    validate: maintenanceOptions,
    handler: knowledgeHandlers.consolidate,
  },
  [KnowledgeCommand.Restore]: {
    description: KnowledgeMessage.Restore,
    positionals: CliPositionals.KnowledgeId,
    options: [CliOption.Home, CliOption.Project, CliOption.Scope],
    validate: knowledgeScope,
    handler: knowledgeHandlers.restore,
  },
  [KnowledgeCommand.Add]: {
    description: KnowledgeMessage.Add,
    positionals: CliPositionals.KnowledgeFile,
    options: [CliOption.Home, CliOption.Project, CliOption.Scope],
    validate: knowledgeScope,
    handler: knowledgeHandlers.add,
  },
  [KnowledgeCommand.Get]: {
    description: KnowledgeMessage.Get,
    positionals: CliPositionals.KnowledgeId,
    options: [CliOption.Home, CliOption.Project],
    handler: knowledgeHandlers.get,
  },
  [KnowledgeCommand.Update]: {
    description: KnowledgeMessage.Update,
    positionals: CliPositionals.KnowledgeUpdate,
    options: [CliOption.Home, CliOption.Project, CliOption.EntryVersion],
    validate: knowledgeVersion,
    handler: knowledgeHandlers.update,
  },
  [KnowledgeCommand.Delete]: {
    description: KnowledgeMessage.Delete,
    positionals: CliPositionals.KnowledgeId,
    options: [CliOption.Home, CliOption.Project, CliOption.EntryVersion],
    validate: knowledgeVersion,
    handler: knowledgeHandlers.delete,
  },
  [KnowledgeCommand.Search]: {
    description: KnowledgeMessage.SearchTool,
    positionals: CliPositionals.Question,
    options: [
      CliOption.Home,
      CliOption.Project,
      CliOption.Mode,
      CliOption.Kind,
      CliOption.Limit,
      CliOption.All,
    ],
    handler: knowledgeHandlers.search,
  },
  [KnowledgeCommand.Promote]: {
    description: KnowledgeMessage.Promote,
    positionals: CliPositionals.KnowledgeId,
    options: [CliOption.Home, CliOption.Project],
    handler: knowledgeHandlers.promote,
  },
  [KnowledgeCommand.List]: {
    description: KnowledgeMessage.List,
    options: [
      CliOption.Home,
      CliOption.Project,
      CliOption.Kind,
      CliOption.Scope,
      CliOption.Tag,
      CliOption.State,
      CliOption.Limit,
    ],
    validate: knowledgeList,
    handler: knowledgeHandlers.list,
  },
  [KnowledgeCommand.Stats]: {
    description: KnowledgeMessage.Stats,
    options: [CliOption.Home, CliOption.Project],
    handler: knowledgeHandlers.stats,
  },
  [KnowledgeCommand.Show]: {
    description: KnowledgeMessage.Show,
    positionals: CliPositionals.KnowledgeId,
    options: [
      CliOption.Home,
      CliOption.Project,
      CliOption.Scope,
      CliOption.Before,
      CliOption.Limit,
    ],
    validate: knowledgeHistory,
    handler: knowledgeHandlers.show,
  },
  [KnowledgeCommand.Reindex]: {
    description: KnowledgeMessage.Reindex,
    options: [CliOption.Home],
    handler: knowledgeHandlers.reindex,
  },
} satisfies Record<string, CommandDefinition>;
export const knowledgeDefinition: CommandDefinition = {
  description: KnowledgeMessage.Command,
  options: [CliOption.Home],
  handler: knowledgeHandlers.help,
  subcommands: knowledgeSubcommands,
};
