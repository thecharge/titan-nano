import { resolve } from "node:path";
import {
  ApprovalLevel,
  CliCommand,
  CliOption,
  CliPositionals,
  ErrorCode,
  ExitCode,
  RequestCommand,
  RequestDecision,
  TextSymbol,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { CliDescription, RequestMessage } from "@titan/messages";
import {
  type ClientAuthority,
  type CommandContext,
  type CommandDefinition,
  type CommandHandler,
  type CommandName,
  RequestAnswerInputSchema,
  RequestEscalationInputSchema,
  RequestPersonaSchema,
} from "@titan/types";
import {
  requestAnswerOptions,
  requestAnswerReason,
  requestListOptions,
  requestOptions,
  requestReason,
} from "../request-options.ts";

async function answer(
  context: CommandContext,
  authority: ClientAuthority,
  decision: RequestDecision,
  reason: unknown,
) {
  const options = requestOptions(context.options);
  const file = context.options[CliOption.Persona];
  const persona =
    file === undefined
      ? undefined
      : RequestPersonaSchema.parse(await context.services.loadData(resolve(file)));
  const input = RequestAnswerInputSchema.parse({
    run_id: context.positionals[0],
    request_id: context.positionals[1],
    version: options.version,
    decision,
    reason: requestReason(reason),
    ...(persona ? { persona } : {}),
  });
  return {
    data: await context.services
      .requests(context.home)
      .answer({ ...input, client_id: options.client_id }, authority),
    exitCode: ExitCode.Success,
  };
}
const requestHandlers = {
  list: async ({ services, home, options }) => {
    const query = requestListOptions(options);
    return { data: await services.requests(home).list(query), exitCode: ExitCode.Success };
  },
  show: async ({ services, home, positionals }) => ({
    data: await services
      .requests(home)
      .get(positionals[0] ?? TextSymbol.Empty, positionals[1] ?? TextSymbol.Empty),
    exitCode: ExitCode.Success,
  }),
  approve: async (context) =>
    answer(
      context,
      ApprovalLevel.Human,
      RequestDecision.Approve,
      requestAnswerReason(context.options),
    ),
  deny: async (context) =>
    answer(context, ApprovalLevel.Human, RequestDecision.Deny, context.positionals[2]),
  answer: async (context) => {
    if (context.options[CliOption.ToPerson]) {
      if (context.positionals[2] !== undefined)
        throw new TitanError(ErrorCode.Arguments, RequestMessage.Decision);
      const options = requestOptions(context.options);
      const input = RequestEscalationInputSchema.parse({
        run_id: context.positionals[0],
        request_id: context.positionals[1],
        version: options.version,
        reason: requestReason(context.options.reason),
      });
      return {
        data: await context.services
          .requests(context.home)
          .escalate({ ...input, client_id: options.client_id }),
        exitCode: ExitCode.Success,
      };
    }
    const flag =
      context.options.yes || context.options.persona
        ? RequestDecision.Approve
        : context.options.deny !== undefined
          ? RequestDecision.Deny
          : undefined;
    if (flag !== undefined && context.positionals[2] !== undefined)
      throw new TitanError(ErrorCode.Arguments, RequestMessage.Decision);
    const decision = RequestAnswerInputSchema.shape.decision.safeParse(
      flag ?? context.positionals[2],
    );
    if (!decision.success) throw new TitanError(ErrorCode.Arguments, RequestMessage.Decision);
    return answer(context, ApprovalLevel.Main, decision.data, requestAnswerReason(context.options));
  },
} satisfies Record<string, CommandHandler>;

const answerOptions = [
  CliOption.Home,
  CliOption.RequestVersion,
  CliOption.ClientId,
  CliOption.Reason,
] as const;
const requestSubcommands = {
  [RequestCommand.Show]: {
    description: CliDescription.Request,
    positionals: CliPositionals.Request,
    options: [CliOption.Home],
    handler: requestHandlers.show,
  },
} satisfies Record<string, CommandDefinition>;
export const requestDefinitions = {
  [CliCommand.Answer]: {
    description: CliDescription.Answer,
    positionals: CliPositionals.Answer,
    options: [
      ...answerOptions,
      CliOption.ToPerson,
      CliOption.Persona,
      CliOption.Yes,
      CliOption.Deny,
    ],
    validate: requestAnswerOptions,
    handler: requestHandlers.answer,
  },
  [CliCommand.Approve]: {
    description: CliDescription.Approve,
    positionals: CliPositionals.Request,
    options: [...answerOptions, CliOption.Persona],
    validate: requestAnswerOptions,
    handler: requestHandlers.approve,
  },
  [CliCommand.Deny]: {
    description: CliDescription.Deny,
    positionals: CliPositionals.Deny,
    options: [CliOption.Home, CliOption.RequestVersion, CliOption.ClientId],
    validate: requestOptions,
    handler: requestHandlers.deny,
  },
  [CliCommand.Requests]: {
    description: CliDescription.Request,
    options: [
      CliOption.Home,
      CliOption.Cursor,
      CliOption.Limit,
      CliOption.RunId,
      CliOption.ClientId,
      CliOption.HarnessSessionId,
      CliOption.ProjectPath,
      CliOption.State,
    ],
    handler: requestHandlers.list,
    validate: requestListOptions,
    subcommands: requestSubcommands,
  },
} satisfies Partial<Record<CommandName, CommandDefinition>>;
