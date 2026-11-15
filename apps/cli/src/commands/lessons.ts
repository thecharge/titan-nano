import { CliOption, CliPositionals, ExitCode } from "@titan/constants";
import { listLessons } from "@titan/knowledge";
import { CliDescription } from "@titan/messages";
import { type CommandDefinition, LessonListSchema } from "@titan/types";

export const lessonsDefinition: CommandDefinition = {
  description: CliDescription.Lessons,
  positionals: CliPositionals.Words,
  options: [CliOption.Home],
  handler: async ({ services, home, positionals }) => ({
    data: LessonListSchema.parse({
      lessons: await listLessons(services.knowledge(home), positionals),
    }),
    exitCode: ExitCode.Success,
  }),
};
