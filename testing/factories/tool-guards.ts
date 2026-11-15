import { mkdir, realpath, symlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { HookMessage } from "@titan/messages";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { BoundaryFinding } from "@titan/types";
import { linkSnapshotDependencies } from "../../tooling/scripts/hook-dependencies.ts";
import { checkHookPolicy } from "../../tooling/scripts/hook-policy.ts";
import { commandOutput, reportHookFailure } from "../../tooling/scripts/hook-process.ts";
import { runMessageCheck } from "../../tooling/scripts/message-command.ts";
import { inspectPackageGraph } from "../../tooling/scripts/package-graph.ts";
import { ciPolicyFixture } from "../cases/ci-policy.ts";
import { hookPolicyFixture } from "../cases/hook-policy.ts";
import { prepareTools } from "./hooks.ts";

export async function loadedPolicy(mode: string) {
  return withTemporaryDirectory(async (directory) => {
    await prepareTools(directory);
    await writeFile(resolve(directory, "lefthook.yml"), Bun.YAML.stringify(hookPolicyFixture));
    if (mode === "second")
      await mkdir(resolve(directory, ".github/workflows"), { recursive: true });
    if (mode === "secrets")
      await writeFile(resolve(directory, ".secretlintrc.json"), JSON.stringify({ rules: [] }));
    if (mode === "commits")
      await writeFile(resolve(directory, ".commitlintrc.json"), JSON.stringify({ extends: [] }));
    if (mode.startsWith("ci-")) {
      const verify = { ...ciPolicyFixture.jobs.verify, "continue-on-error": true };
      await mkdir(resolve(directory, ".github/workflows"), { recursive: true });
      await writeFile(
        resolve(
          directory,
          ".github/workflows",
          mode === "ci-manual"
            ? "manual.yaml"
            : mode === "ci-hidden"
              ? ".hidden.yml"
              : "verify.yml",
        ),
        Buffer.from(
          Bun.YAML.stringify(
            mode === "ci-manual"
              ? { ...ciPolicyFixture, on: { workflow_dispatch: null } }
              : mode === "ci-live"
                ? { ...ciPolicyFixture, env: { TITAN_LIVE_CLAUDE: "1" } }
                : {
                    ...ciPolicyFixture,
                    jobs: { verify },
                  },
          ),
        ),
      );
    }
    await checkHookPolicy(directory);
    return true;
  });
}
export async function messageCommand(mode: string) {
  return withTemporaryDirectory(async (directory) => {
    await prepareTools(directory);
    await writeFile(resolve(directory, "lefthook.yml"), Bun.YAML.stringify(hookPolicyFixture));
    const path = resolve(directory, "message.txt");
    if (mode === "missing") return runMessageCheck(directory);
    await writeFile(
      path,
      mode === "invalid"
        ? "updated stuff"
        : mode === "scoped"
          ? "fix(cli): retain run selector"
          : "fix: repair hook checks",
    );
    return runMessageCheck(directory, path);
  });
}
export async function hookFailure(mode: string) {
  return reportHookFailure(
    mode === "known"
      ? new Error(HookMessage.InvalidPolicy)
      : mode === "output"
        ? new Error(HookMessage.OutputLimit)
        : mode === "unknown"
          ? new Error("Untrusted diagnostic")
          : null,
  );
}
export async function hookProcess(mode: string) {
  return withTemporaryDirectory(async (cwd) => {
    const expression =
      mode === "limit"
        ? 'process.stdout.write("x".repeat(1100000)); setTimeout(()=>{}, 1000)'
        : mode === "failure"
          ? "process.exit(2)"
          : 'process.stdout.write(" checked ")';
    return commandOutput([process.execPath, "-e", expression], { cwd, raw: mode === "raw" });
  });
}
export async function guardedProcess(mode: string) {
  if (mode === "invalid") return Reflect.apply(Bun.spawn, Bun, [42]);
  if (mode === "blocked")
    return Bun.spawn({ cmd: ["curl", "https://example.invalid"], stdout: "ignore" });
  const child =
    mode === "object"
      ? Bun.spawn({ cmd: [process.execPath, "-e", "process.exit(0)"], stdout: "ignore" })
      : Bun.spawn([process.execPath, "-e", "process.exit(0)"], { stdout: "ignore" });
  return child.exited;
}
export async function binaryContainment(mode: string) {
  return withTemporaryDirectory(async (root) => {
    const snapshot = resolve(root, "snapshot");
    const cache = resolve(root, "node_modules/.bun");
    await mkdir(snapshot);
    await mkdir(cache, { recursive: true });
    await mkdir(resolve(root, "node_modules/.bin"));
    for (const directory of [root, snapshot])
      await writeFile(resolve(directory, "bun.lock"), "fixture lock");
    await writeFile(
      resolve(snapshot, "package.json"),
      JSON.stringify({ name: "fixture", packageManager: `bun@${Bun.version}` }),
    );
    const target = resolve(
      mode.startsWith("escape") ? root : cache,
      mode === "second" ? "second-tool" : "tool",
    );
    await writeFile(target, "fixture binary");
    await symlink(target, resolve(root, "node_modules/.bin/tool"));
    await linkSnapshotDependencies(root, snapshot);
    return (await realpath(resolve(snapshot, "node_modules/.bin/tool"))) === target;
  });
}
export function graphManifest(mode: string) {
  const rules = (findings: readonly BoundaryFinding[]) => findings.map((finding) => finding.rule);
  const exports = { ".": "./src/index.ts" };
  const workspace = {
    directory: "packages/example",
    manifest: { name: "@titan/example", exports },
    sources: { "src/index.ts": "export const value=1;" },
  };
  if (mode === "duplicate") return rules(inspectPackageGraph([workspace, workspace]));
  if (mode === "missing")
    return rules(inspectPackageGraph([{ ...workspace, manifest: { name: "@titan/example" } }]));
  return rules(inspectPackageGraph([workspace]));
}
