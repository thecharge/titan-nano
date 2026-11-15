import {
  CliOption,
  CliPositionals,
  CliRuntime,
  ErrorCode,
  ExitCode,
  RunStatus,
  TextSymbol,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { CliDescription, ImproveLoopMessage } from "@titan/messages";
import {
  type CliOptions,
  type CommandDefinition,
  type CommandHandler,
  type ImproveReport,
  type ImproveRequest,
  ImproveRequestSchema,
} from "@titan/types";

function improveRounds(options: CliOptions): number | undefined {
  const raw = options[CliOption.Rounds];
  if (raw === undefined) return undefined;
  if (!CliRuntime.PositiveIntegerPattern.test(raw) || !Number.isSafeInteger(Number(raw)))
    throw new TitanError(ErrorCode.Arguments, ImproveLoopMessage.Rounds);
  return Number(raw);
}

function validateImproveOptions(options: CliOptions): void {
  improveRounds(options);
}

function improveRequest(root: string, options: CliOptions): ImproveRequest {
  const persona = options[CliOption.Persona];
  const rounds = improveRounds(options);
  return ImproveRequestSchema.parse({
    root,
    ...(persona === undefined ? {} : { persona }),
    ...(rounds === undefined ? {} : { rounds }),
  });
}

function improveLines(report: ImproveReport): string[] {
  return [
    ...report.rounds.map((entry) =>
      entry.file === null
        ? ImproveLoopMessage.NotKept(entry.round, String(entry.reason))
        : ImproveLoopMessage.Kept(entry.round, entry.file),
    ),
    ImproveLoopMessage.Summary(
      report.rounds.filter((entry) => entry.file !== null).length,
      report.rounds.length,
    ),
  ];
}

const improveHandler: CommandHandler = async (context) => {
  const run = await context.services
    .client(context.home)
    .get(context.positionals[0] ?? TextSymbol.Empty);
  if (run.state !== RunStatus.Passed && run.state !== RunStatus.Failed)
    throw new TitanError(ErrorCode.Arguments, ImproveLoopMessage.NotFinished(run.state));
  const report = await context.services.improve(
    context.home,
    improveRequest(run.root, context.options),
  );
  if (context.options[CliOption.Json]) return { data: report, exitCode: ExitCode.Success };
  for (const line of improveLines(report)) context.emit(line);
  return { exitCode: ExitCode.Success };
};

export const improveDefinition: CommandDefinition = {
  description: CliDescription.Improve,
  positionals: CliPositionals.Run,
  options: [CliOption.Home, CliOption.Persona, CliOption.Rounds],
  validate: validateImproveOptions,
  handler: improveHandler,
};
