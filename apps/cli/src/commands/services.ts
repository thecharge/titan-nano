import { ExitCode } from "@titan/constants";
import type { CommandHandler } from "@titan/types";

export const serviceHandlers = {
  serve: async ({ services, home, emit }) => {
    await services.serve(home, (address) => emit({ ready: true, ...address, home }));
    return { exitCode: ExitCode.Success };
  },
  mcp: async ({ services, home }) => {
    await services.mcp(home);
    return { exitCode: ExitCode.Success };
  },
  toolServer: async ({ services }) => {
    await services.toolServer();
    return { exitCode: ExitCode.Success };
  },
} satisfies Record<string, CommandHandler>;
