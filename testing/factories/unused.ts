import { mkdir, symlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  DocumentationFormatConfiguration,
  IoLimit,
  UnusedConfiguration,
  UnusedFixture,
  UnusedToolBindings,
} from "@titan/constants";
import { all } from "@titan/core";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { UnusedFixtureSchema, UnusedToolBindingsSchema } from "@titan/types";
import { readTree, treeHash } from "@titan/workspace";
import { checkUnused } from "../../tooling/scripts/check-unused.ts";

async function write(root: string, file: string, value: string): Promise<void> {
  const path = resolve(root, file);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, Buffer.from(value));
}

async function prepare(root: string): Promise<void> {
  await all([
    () => write(root, "knip.json", JSON.stringify(UnusedConfiguration)),
    () => write(root, "dprint.json", JSON.stringify(DocumentationFormatConfiguration)),
    () =>
      write(
        root,
        ".secretlintrc.json",
        JSON.stringify({ rules: [{ id: "@secretlint/secretlint-rule-preset-recommend" }] }),
      ),
  ]);
}

export async function unusedCheck(mode: UnusedFixture, extension = "ts") {
  UnusedFixtureSchema.parse(mode);
  return withTemporaryDirectory(async (root) => {
    await prepare(root);
    await symlink(resolve(import.meta.dir, "../../node_modules"), resolve(root, "node_modules"));
    const dependencies = Object.fromEntries(
      UnusedToolBindings.map((binding) => [binding.dependency, "1.0.0"]),
    );
    if (mode === UnusedFixture.Dependency) dependencies["@fixture/unused"] = "1.0.0";
    await write(
      root,
      "package.json",
      JSON.stringify({
        name: "fixture",
        private: true,
        type: "module",
        workspaces: ["apps/*", "packages/*", "testing", "testing/packages/*"],
        devDependencies: dependencies,
      }),
    );
    await all(
      [
        "apps/cli",
        "packages/backend-codex",
        "packages/backend-claude",
        "packages/core",
        "testing/packages/framework",
      ].map((directory) => async () => {
        await write(
          root,
          `${directory}/package.json`,
          JSON.stringify({
            name: `@fixture/${directory.split("/").at(-1)}`,
            type: "module",
            exports: { ".": "./src/index.ts" },
          }),
        );
        await write(root, `${directory}/src/index.ts`, "export const value = 1;");
      }),
    );
    await write(
      root,
      "testing/package.json",
      JSON.stringify({ name: "@fixture/testing", private: true }),
    );
    await all(
      [
        "tooling/scripts/inside-offline.ts",
        "tooling/scripts/probe-package.ts",
        "tooling/scripts/bootstrap-install.ts",
        "testing/main.test.ts",
        "testing/fixtures/vendor.mjs",
      ].map((file) => () => write(root, file, "export {};")),
    );
    if (mode === UnusedFixture.File || mode === UnusedFixture.Ignored)
      await write(root, `apps/cli/src/unused.${extension}`, "export const unused = 1;");
    if (mode === UnusedFixture.Ignored)
      await write(root, ".gitignore", `apps/cli/src/unused.${extension}`);
    if (mode === UnusedFixture.Used) {
      await write(root, `apps/cli/src/used.${extension}`, "export const used = 1;");
      await write(
        root,
        "apps/cli/src/index.ts",
        `import { used } from "./used.${extension}"; console.log(used);`,
      );
    }
    if (mode === UnusedFixture.Export) {
      await write(
        root,
        `apps/cli/src/used.${extension}`,
        "export const used = 1; export const unused = 2;",
      );
      await write(
        root,
        "apps/cli/src/index.ts",
        `import { used } from "./used.${extension}"; console.log(used);`,
      );
    }
    if (mode === UnusedFixture.Import)
      await write(
        root,
        "apps/cli/src/index.ts",
        'import missing from "./missing.ts"; console.log(missing);',
      );
    if (mode === UnusedFixture.Duplicate)
      await write(
        root,
        "apps/cli/src/index.ts",
        "export const first = 1; export const second = first;",
      );
    const before = await treeHash(await readTree(root));
    const code = await checkUnused(root);
    return {
      code,
      unchanged: before === (await treeHash(await readTree(root))),
    };
  });
}

export async function unusedAdmission(
  policy: unknown,
  oversized = false,
  bindings: unknown = UnusedToolBindings,
) {
  return withTemporaryDirectory(async (root) => {
    await prepare(root);
    await writeFile(
      resolve(root, "knip.json"),
      oversized ? Buffer.alloc(IoLimit.DataBytes + 1) : Buffer.from(JSON.stringify(policy)),
    );
    let spawned = 0;
    const error = await thrownBy(() =>
      checkUnused(
        root,
        async () => {
          spawned++;
          return 0;
        },
        bindings,
      ),
    );
    return { admitted: !(error instanceof Error), spawned };
  });
}

export function unusedBindings(bindings: unknown) {
  return UnusedToolBindingsSchema.safeParse(bindings).success;
}
