import { strict as assert } from "node:assert";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ExitCode } from "@titan/constants";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";

export async function dryRunLines(
  candidates: number,
  attempts: number,
  falsifiers: number,
  judge: boolean,
  steps: number,
  maxSteps: number,
): Promise<string> {
  return withTemporaryDirectory(async (root) => {
    const personas = {
      worker: { description: "Worker", role: "Write a result" },
      checker: { description: "Checker", role: "Refute the result" },
      judge: { description: "Judge", role: "Pick a candidate" },
    };
    const step = (id: string) => ({
      id,
      do: { persona: "worker", task: "Solve" },
      candidates,
      max_attempts: attempts,
      falsify: Array.from({ length: falsifiers }, () => ({ persona: "checker", task: "Refute" })),
      ...(judge ? { judge: "judge" } : {}),
    });
    const file = resolve(root, "workflow.yaml");
    await writeFile(
      file,
      Bun.YAML.stringify({
        name: "Dry run",
        goal: "Show the cost",
        personas,
        steps: Array.from({ length: steps }, (_, index) => step(`step-${index}`)),
      }),
    );
    const printed: string[] = [];
    const main = createCli({
      ...defaultServices,
      output: (value) => {
        if (typeof value === "string") printed.push(value);
      },
    });
    const code = await main([
      "run",
      file,
      "--dry-run",
      "--home",
      resolve(root, "home"),
      "--project",
      root,
      "--set",
      `limits.max_steps=${maxSteps}`,
    ]);
    assert.equal(code, ExitCode.Success);
    return printed.join("|");
  });
}
