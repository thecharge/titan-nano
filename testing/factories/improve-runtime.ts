import { resolve } from "node:path";
import { ErrorCode, ImproveLoopScenario } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { improveEarlierRun } from "@titan/runtime";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { ImproveRequestSchema } from "@titan/types";
import { earlierRun } from "./improve-command.ts";

export function improveRuntime(
  missing: boolean,
  rounds: number | undefined,
  persona: string | undefined,
): Promise<string> {
  return withTemporaryDirectory(async (root) => {
    const { home, run } = await earlierRun(
      root,
      ImproveLoopScenario.PartNone,
      ImproveLoopScenario.AnswerSame,
    );
    const request = ImproveRequestSchema.parse({
      root: missing ? resolve(root, ImproveLoopScenario.UnknownRun) : run.root,
      ...(rounds === undefined ? {} : { rounds }),
      ...(persona === undefined ? {} : { persona }),
    });
    try {
      return JSON.stringify(await improveEarlierRun(home, request));
    } catch (error) {
      if (error instanceof TitanError && error.code === ErrorCode.Arguments) return error.message;
      throw error;
    }
  });
}
