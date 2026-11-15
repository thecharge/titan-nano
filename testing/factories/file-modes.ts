import { chmod, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { FakeBackend } from "@titan/backend-fake";
import { resolveConfig } from "@titan/config";
import { AgentTool, Backend, WorkspaceMode } from "@titan/constants";
import { Engine } from "@titan/runner";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { FileEntrySchema } from "@titan/types";
import { validateWorkflow } from "@titan/workflow";
import { fileIdentity, readTree, treeHash, writeTree } from "@titan/workspace";
import { isolatedWorkspace } from "../support/isolated.ts";

export async function snapshotMode(executable: boolean, changed: boolean) {
  return withTemporaryDirectory(async (root) => {
    const source = resolve(root, "source");
    const target = resolve(root, "target");
    await mkdir(source);
    const file = resolve(source, "script");
    await writeFile(file, Buffer.from("#!/bin/sh\nprintf delivered"));
    await chmod(file, executable ? WorkspaceMode.PrivateExecutable : WorkspaceMode.PrivateFile);
    const files = await readTree(source);
    if (changed)
      await chmod(file, executable ? WorkspaceMode.PrivateFile : WorkspaceMode.PrivateExecutable);
    await writeTree(target, files);
    const copied = await readTree(target);
    return {
      executable: copied.script?.executable,
      execution: executable
        ? await Bun.spawn(
            [
              process.execPath,
              resolve("testing/fixtures/workspace-executable.mjs"),
              resolve(target, "script"),
            ],
            { stdout: "ignore", stderr: "ignore" },
          ).exited
        : null,
      privateMode: (await stat(resolve(target, "script"))).mode & 0o7777,
      sameHash: (await treeHash(files)) === (await treeHash(copied)),
      sameIdentity: fileIdentity(files.script) === fileIdentity(copied.script),
    };
  });
}

export async function fileModeIdentity(executable: boolean, other: boolean) {
  return withTemporaryDirectory(async (root) => {
    const first = resolve(root, "first");
    const second = resolve(root, "second");
    await mkdir(first);
    await writeFile(resolve(first, "script"), Buffer.from("same content"));
    const files = await readTree(first);
    await writeTree(second, files);
    await chmod(
      resolve(first, "script"),
      executable ? WorkspaceMode.PrivateExecutable : WorkspaceMode.PrivateFile,
    );
    await chmod(
      resolve(second, "script"),
      other ? WorkspaceMode.PrivateExecutable : WorkspaceMode.PrivateFile,
    );
    const before = await readTree(first);
    const after = await readTree(second);
    const entry = before.script;
    const legacy = FileEntrySchema.parse({
      source: entry?.source,
      hash: entry?.hash,
      bytes: entry?.bytes,
    });
    return {
      sameIdentity: fileIdentity(before.script) === fileIdentity(after.script),
      sameTreeHash: (await treeHash(before)) === (await treeHash(after)),
      legacyNonExecutable: legacy.executable === false,
    };
  });
}

function modeStep(id: string) {
  return {
    id,
    do: { persona: "worker", task: "Preserve the requested executable flag" },
    falsify: [{ persona: "checker", task: "Inspect candidate bytes and executable flag" }],
  };
}

export async function engineFileMode(initial: boolean, conflict: boolean) {
  return withTemporaryDirectory(async (root) => {
    const home = resolve(root, "home");
    const project = resolve(root, "project");
    await mkdir(project);
    const source = resolve(project, "script");
    await writeFile(source, Buffer.from("original"));
    const originalMode = initial ? WorkspaceMode.PrivateExecutable : WorkspaceMode.PrivateFile;
    const deliveredMode = initial ? WorkspaceMode.PrivateFile : WorkspaceMode.PrivateExecutable;
    await chmod(source, originalMode);
    const backend = new FakeBackend(async (spec) => {
      const id = spec.invocation_id.split("/")[0];
      const file = resolve(spec.cwd, "script");
      if (spec.writable && conflict) {
        await writeFile(file, Buffer.from("updated"));
        await chmod(
          file,
          id === "left" ? WorkspaceMode.PrivateExecutable : WorkspaceMode.PrivateFile,
        );
      } else if (spec.writable && id === "first") await chmod(file, deliveredMode);
      else {
        const expected = conflict
          ? id === "left"
            ? WorkspaceMode.PrivateExecutable
            : WorkspaceMode.PrivateFile
          : deliveredMode;
        if (((await stat(file)).mode & 0o7777) !== expected)
          throw new Error("Candidate executable flag changed");
      }
      return {
        json: spec.writable
          ? { ok: true }
          : { verdict: "survived", evidence: "Inspected candidate executable flag" },
      };
    });
    const engine = new Engine(() => backend);
    const plan = validateWorkflow({
      name: "Executable file delivery",
      goal: "Preserve mode-only edits and reject conflicting permissions",
      personas: {
        worker: { description: "Writer", role: "Write", tools: [AgentTool.Write] },
        checker: { description: "Checker", role: "Check" },
      },
      steps: conflict
        ? [{ parallel: [modeStep("left"), modeStep("right")] }, modeStep("join")]
        : [modeStep("first"), modeStep("second")],
    });
    const run = await engine.create({
      project,
      plan,
      config: await resolveConfig({ home, project, overrides: isolatedWorkspace }),
      backend: Backend.Fake,
      client_id: "modes",
      submission_id: "delivery",
    });
    await engine.start(run.run_id);
    return {
      state: run.state,
      deliveredMode: run.artifacts
        ? (await stat(resolve(run.artifacts, "script"))).mode & 0o7777
        : null,
      originalPreserved:
        (await readFile(source)).equals(Buffer.from("original")) &&
        ((await stat(source)).mode & 0o7777) === originalMode,
      refutations: Object.values(run.nodes).reduce((total, node) => total + node.refutations, 0),
    };
  });
}
