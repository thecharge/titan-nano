import { CliOption, ErrorCode } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { RequestMessage } from "@titan/messages";
import { parseRequestListSearch } from "@titan/server/requests";
import { type CliOptions, RequestAnswerInputSchema, RequestCliOptionsSchema } from "@titan/types";

export function requestOptions(options: CliOptions) {
  const parsed = RequestCliOptionsSchema.safeParse({
    version: options[CliOption.RequestVersion],
    client_id: options[CliOption.ClientId],
  });
  if (!parsed.success) throw new TitanError(ErrorCode.Arguments, RequestMessage.Options);
  return parsed.data;
}
export function requestReason(value: unknown): string {
  const parsed = RequestAnswerInputSchema.shape.reason.safeParse(value);
  if (!parsed.success) throw new TitanError(ErrorCode.Arguments, RequestMessage.Reason);
  return parsed.data;
}
export function requestAnswerOptions(options: CliOptions): void {
  requestOptions(options);
  const choices = [
    options.persona !== undefined,
    options.yes === true,
    options.deny !== undefined,
    options[CliOption.ToPerson] === true,
  ];
  if (choices.filter(Boolean).length > 1)
    throw new TitanError(ErrorCode.Arguments, RequestMessage.Decision);
  requestAnswerReason(options);
}

export function requestAnswerReason(options: CliOptions): string {
  return requestReason(
    options.reason ??
      options.deny ??
      (options.yes
        ? RequestMessage.Accepted
        : options.persona
          ? RequestMessage.PersonaSupplied
          : undefined),
  );
}

export function requestListOptions(options: CliOptions) {
  return parseRequestListSearch(
    Object.fromEntries(
      Object.entries({
        cursor: options.cursor,
        limit: options.limit,
        run_id: options[CliOption.RunId],
        client_id: options[CliOption.ClientId],
        harness_session_id: options[CliOption.HarnessSessionId],
        project_path: options[CliOption.ProjectPath],
        state: options.state,
      }).filter(([, value]) => value !== undefined),
    ),
  );
}
