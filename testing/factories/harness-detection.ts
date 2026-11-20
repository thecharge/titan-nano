import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { detectHarness } from "@titan/config";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { HarnessInput, HarnessSignal } from "@titan/types";
import { z } from "zod";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { inspectHandlers } from "../../apps/cli/src/commands/inspect.ts";
import { detectedBackend } from "../../apps/cli/src/harness-backend.ts";
import { sdkInstalled } from "../../apps/cli/src/sdk.ts";

export function harnessDetection(input: HarnessInput, signals?: HarnessSignal[]) {
  try {
    return { ok: true, ...detectHarness(input, signals) };
  } catch (error) {
    return failure(error);
  }
}

const emitted: unknown[] = [];

const failure = (error: unknown) => ({
  ok: false,
  code: Reflect.get(Object(error), "code"),
  message: Reflect.get(Object(error), "message"),
});

export async function doctorHarness(
  environment: Record<string, string | undefined>,
  programs: string[],
  sdks: string[],
) {
  const services = {
    ...defaultServices,
    environment,
    program: (name: string) => (programs.includes(name) ? `/bin/${name}` : null),
    sdk: (name: string) => sdks.includes(name),
  };
  const result = await inspectHandlers.doctor({
    options: {},
    positionals: [],
    home: "/home",
    project: "/project",
    services,
    emit: emitted.push.bind(emitted),
  });
  const data = z
    .object({ harness: z.string(), tools: z.record(z.string(), z.string()) })
    .parse(result.data);
  return { harness: data.harness, ...data.tools };
}

export function sdkLookup(name: string) {
  return sdkInstalled(name);
}

export async function bundledSdkLookup(name: string, installed: boolean) {
  return withTemporaryDirectory(async (root) => {
    if (installed) {
      const folder = resolve(root, "node_modules/@openai/codex");
      await mkdir(folder, { recursive: true });
      await writeFile(
        resolve(folder, "package.json"),
        '{"name":"@openai/codex","version":"0.171.0"}',
      );
    }
    return sdkInstalled(name, root);
  });
}

export function backendFor(
  environment: Record<string, string | undefined>,
  workflow: string | undefined,
  flag: string | undefined,
) {
  try {
    return {
      ok: true,
      backend: detectedBackend(
        {
          options: flag === undefined ? {} : { harness: flag },
          positionals: [],
          home: "/home",
          project: "/project",
          services: {
            ...defaultServices,
            environment,
            program: (command: string) =>
              environment.TITAN_TEST_FOUND === command ? command : null,
          },
          emit: emitted.push.bind(emitted),
        },
        workflow,
      ),
    };
  } catch (error) {
    return failure(error);
  }
}
