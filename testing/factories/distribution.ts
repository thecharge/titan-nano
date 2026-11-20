import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  HookFile,
  IoLimit,
  KnowledgeMemoryDatabase,
  PackageRegistryGate,
  Packaging,
} from "@titan/constants";
import { openVectorIndex } from "@titan/knowledge";
import { captureCommand } from "@titan/process";
import { readFileBytes } from "@titan/streams";
import { processExited } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { type PackageOutputOptions, PackageOutputOptionsSchema } from "@titan/types";
import { checkSqliteVector } from "../../apps/cli/src/prerequisites.ts";
import { packageOutput } from "../../tooling/scripts/package-output.ts";
import { nativeCodexVersion } from "../../tooling/scripts/package-vendors.ts";

export async function distributionVersion(manifest: string) {
  return withTemporaryDirectory(async (root) => {
    await mkdir(resolve(root, "dist"));
    await writeFile(resolve(root, "package.json"), Buffer.from(manifest));
    return nativeCodexVersion(pathToFileURL(resolve(root, "dist/index.js")).href);
  });
}

export async function distributionOutput(
  output: number,
  error: number,
  code: number,
  delay: number,
  options: PackageOutputOptions,
) {
  return withTemporaryDirectory(async (root) => {
    const pidFile = resolve(root, "child.pid");
    let result: Buffer | undefined;
    let failure: unknown;
    try {
      result = await packageOutput(
        [
          process.execPath,
          fileURLToPath(import.meta.resolve("../fixtures/package-output.ts")),
          pidFile,
          String(output),
          String(error),
          String(code),
          String(delay),
        ],
        root,
        options,
      );
    } catch (caught) {
      failure = caught;
    }
    const pid = Number((await readFileBytes(pidFile, IoLimit.HashBytes)).toString());
    assert.equal(Number.isSafeInteger(pid) && pid > 0, true);
    assert.equal(await processExited(pid), true);
    if (failure) throw failure;
    return result?.equals(Buffer.alloc(output, 197)) ?? false;
  });
}

export function distributionOutputOptions(options: unknown) {
  return PackageOutputOptionsSchema.parse(options);
}

export async function distributionOutputAdmission(options: unknown) {
  return withTemporaryDirectory(async (root) => {
    const spawn = Bun.spawn;
    let calls = 0;
    let output: unknown;
    let failure: unknown;
    const command = [
      process.execPath,
      fileURLToPath(import.meta.resolve("../fixtures/package-output.ts")),
      resolve(root, "child.pid"),
      "0",
      "0",
      "0",
      "0",
    ];
    Bun.spawn = new Proxy(spawn, {
      apply(target, receiver, args) {
        calls++;
        return Reflect.apply(target, receiver, args);
      },
    });
    try {
      output = await Reflect.apply(packageOutput, undefined, [command, root, options]);
    } catch (error) {
      failure = error;
    } finally {
      Bun.spawn = spawn;
    }
    if (failure) {
      assert.equal(calls, 0);
      throw failure;
    }
    assert.equal(calls, 1);
    assert.ok(Buffer.isBuffer(output));
    assert.equal(output.length, 0);
    const pid = Number(
      (await readFileBytes(resolve(root, "child.pid"), IoLimit.HashBytes)).toString(),
    );
    assert.equal(Number.isSafeInteger(pid) && pid > 0, true);
    assert.equal(await processExited(pid), true);
    return true;
  });
}

export async function nativeDistributionProbe(mode: string) {
  if (mode === "native") return checkSqliteVector();
  let closed = false;
  const result = await checkSqliteVector(async (path) => {
    assert.equal(path, KnowledgeMemoryDatabase);
    if (mode === "load-fault") throw new Error("Injected native loader fault");
    const index = await openVectorIndex(path);
    return {
      ...index,
      close: async () => {
        await index.close();
        closed = true;
        if (mode === "close-fault") throw new Error("Injected native cleanup fault");
      },
    };
  });
  assert.equal(closed, mode !== "load-fault");
  if (result.repair === null) return result;
  assert(result.repair.includes(`${process.platform}/${process.arch}`));
  assert(result.repair.includes("rerun titan doctor"));
  assert(result.repair.includes("Word search remains available"));
  return { ...result, repair: true };
}

export async function archiveDistributionProbe(mode: string): Promise<boolean> {
  return withTemporaryDirectory(async (directory) => {
    const contents: Record<string, string> = {
      [PackageRegistryGate.PackagePrefix + HookFile.Manifest]: "{}",
    };
    if (mode === "secret")
      contents[PackageRegistryGate.PackagePrefix + Packaging.Readme] = [
        "ghp",
        "aB3dE5fG7hJ9kL2mN4pQ6rS8tU1vW3xY5zA7",
      ].join("_");
    if (mode === "example")
      contents[PackageRegistryGate.PackagePrefix + PackageRegistryGate.ExampleWorkflow] =
        "name: example";
    if (mode === "private-run") contents["package/tests/.titan/runs/private.json"] = "{}";
    const archive = resolve(directory, PackageRegistryGate.Archive);
    await Bun.write(archive, await new Bun.Archive(contents, { compress: "gzip" }).blob());
    const gate = fileURLToPath(
      import.meta.resolve("../../tooling/scripts/check-package-registry.ts"),
    );
    const result = await captureCommand(
      [process.execPath, gate, PackageRegistryGate.Verify, archive],
      resolve(import.meta.dir, "../.."),
    );
    if (result.exit_code === 0) return true;
    const stderr = result.stderr.toString();
    if (stderr.includes(PackageRegistryGate.Secret)) throw new Error(PackageRegistryGate.Secret);
    if (stderr.includes(PackageRegistryGate.InvalidArchive))
      throw new Error(PackageRegistryGate.InvalidArchive);
    throw new Error(stderr);
  });
}
