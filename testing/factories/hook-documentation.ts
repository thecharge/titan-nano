import { strict as assert } from "node:assert";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { HookCheckCommands, HookCheckScope, HookFile } from "@titan/constants";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { checkHookSnapshot } from "../../tooling/scripts/hook-checks.ts";
import { commandOutput } from "../../tooling/scripts/hook-process.ts";
import { hookScope, readHookChanges } from "../../tooling/scripts/hook-scope.ts";
import { hookPolicyFixture } from "../cases/hook-policy.ts";
import { prepareTools, syntheticCredential } from "./hooks.ts";

export async function documentationGate(
  paths: string[],
  changes: unknown,
  failure: string | null = null,
  secret = false,
  failureStatus = 1,
) {
  return withTemporaryDirectory(async (directory) => {
    await prepareTools(directory);
    await writeFile(join(directory, HookFile.Configuration), Bun.YAML.stringify(hookPolicyFixture));
    await writeFile(
      join(directory, HookFile.Manifest),
      JSON.stringify({
        name: "@fixture/root",
        workspaces: { packages: ["packages/*"] },
      }),
    );
    await mkdir(join(directory, "packages/runner"), { recursive: true });
    await writeFile(
      join(directory, "packages/runner/package.json"),
      JSON.stringify({ name: "@fixture/runner" }),
    );
    for (const path of paths) {
      await mkdir(dirname(join(directory, path)), { recursive: true });
      await writeFile(
        join(directory, path),
        Buffer.from(secret ? await syntheticCredential() : "Ordinary documentation fixture"),
      );
    }
    const observed: string[][] = [];
    const reports: string[] = [];
    const code = await Reflect.apply(checkHookSnapshot, undefined, [
      directory,
      paths,
      async (command: readonly string[]) => {
        observed.push([...command]);
        return command.includes(failure ?? "") ? failureStatus : 0;
      },
      (message: string) => reports.push(message),
      changes,
    ]);
    if (secret) {
      assert.equal(code, 1);
      assert.deepEqual(observed, []);
      assert.deepEqual(reports, []);
      return { code, productTests: false };
    }
    assert.equal(reports.length, observed.length + 1);
    assert.ok(reports.at(-1)?.startsWith(observed.at(-1)?.join(" ") ?? ""));
    assert.match(reports.at(-1) ?? "", /: exit [0-9]+, [0-9]+ ms$/);
    const checks = HookCheckCommands.filter(
      (command: readonly string[]) => !command.includes("test"),
    );
    const failed = checks.findIndex((command: readonly string[]) =>
      command.includes(failure ?? ""),
    );
    assert.deepEqual(
      observed.filter((command) => !command.includes("test")),
      failed < 0 ? checks : checks.slice(0, failed + 1),
    );
    return { code, productTests: observed.some((command) => command.includes("test")) };
  });
}

export async function hookTreeScope(
  mode: string,
  document = "docs/guide.md",
): Promise<HookCheckScope> {
  return withTemporaryDirectory(async (root) => {
    const git = (...args: string[]) => commandOutput(["git", ...args], { cwd: root });
    await git("init", "--initial-branch=main");
    await mkdir(join(root, "docs"));
    await mkdir(join(root, "packages/runner/src"), { recursive: true });
    const source = join(root, "packages/runner/src/engine.ts");
    const guide = join(root, document);
    await mkdir(dirname(guide), { recursive: true });
    await writeFile(source, Buffer.from("initial source"));
    await writeFile(guide, Buffer.from("initial guide"));
    await git("add", ".");
    const initial = await git("write-tree");
    const base = await git(
      "-c",
      "user.name=Titan Fixture",
      "-c",
      "user.email=titan@example.invalid",
      "commit-tree",
      initial,
      "-m",
      "baseline",
    );
    await git("update-ref", "HEAD", base);
    if (mode === "rename-source") await rename(source, join(root, "docs/moved.md"));
    else await writeFile(mode === "staged-guide" ? guide : source, Buffer.from("changed snapshot"));
    await git("add", ".");
    const earlier = await git("write-tree");
    if (mode === "staged-guide") await writeFile(source, Buffer.from("unstaged source"));
    else await writeFile(guide, Buffer.from("later guide"));
    if (mode === "later-guide" || mode === "earlier-source") await git("add", ".");
    const later = await git("write-tree");
    const tree =
      mode === "invalid-tree"
        ? "not-an-object"
        : mode === "clean-index"
          ? initial
          : mode === "earlier-source"
            ? earlier
            : later;
    const comparison =
      mode === "new-reference"
        ? null
        : mode === "missing-base"
          ? "missing"
          : mode === "later-guide"
            ? earlier
            : base;
    const changes = await readHookChanges(root, tree, comparison);
    return changes === null ? HookCheckScope.Full : hookScope(changes, ["packages/runner"]);
  });
}
