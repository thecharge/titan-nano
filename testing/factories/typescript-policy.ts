import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { IoLimit, ProcessIo, ProcessSignal, TypeScriptProject } from "@titan/constants";
import { all } from "@titan/core";
import { readBytes } from "@titan/streams";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { checkTypeScriptPolicy } from "../../tooling/scripts/check-typescript-policy.ts";
import { packageTypeScriptFixture, rootTypeScriptFixture } from "../cases/typescript-policy.ts";

async function prepareStrictWorkspace(
  root: string,
  rootPolicy: unknown,
  packagePolicy: unknown,
  patterns = ["packages/*"],
) {
  await writeFile(
    resolve(root, "package.json"),
    Buffer.from(JSON.stringify({ workspaces: { packages: patterns } })),
  );
  await writeFile(resolve(root, "tsconfig.json"), Buffer.from(JSON.stringify(rootPolicy)));
  await prepareStrictPackage(root, "one", packagePolicy);
}

async function prepareStrictPackage(root: string, name: string, policy: unknown) {
  const directory = resolve(root, "packages", name);
  await mkdir(resolve(directory, "src"), { recursive: true });
  await writeFile(resolve(directory, "package.json"), Buffer.from(JSON.stringify({ name })));
  if (policy !== null)
    await writeFile(resolve(directory, "tsconfig.json"), Buffer.from(JSON.stringify(policy)));
}

export async function typeScriptWorkspaceCapacity(count: number) {
  return withTemporaryDirectory(async (root) => {
    await prepareStrictWorkspace(root, rootTypeScriptFixture, packageTypeScriptFixture);
    for (let index = 1; index < count; index++)
      await prepareStrictPackage(root, String(index), packageTypeScriptFixture);
    return checkTypeScriptPolicy(root);
  });
}

export async function typeScriptWorkspace(
  rootPolicy: unknown,
  packagePolicy: unknown,
  patterns = ["packages/*"],
) {
  return withTemporaryDirectory(async (root) => {
    await prepareStrictWorkspace(root, rootPolicy, packagePolicy, patterns);
    return checkTypeScriptPolicy(root);
  });
}

export async function typeScriptCompilation(
  source: string,
  diagnostic?: number,
  extension = "ts",
  project = TypeScriptProject.Package,
) {
  return withTemporaryDirectory(async (root) => {
    await prepareStrictWorkspace(
      root,
      {
        ...rootTypeScriptFixture,
        compilerOptions: {
          ...rootTypeScriptFixture.compilerOptions,
          types: [],
          skipLibCheck: true,
        },
      },
      packageTypeScriptFixture,
    );
    assert.equal(await checkTypeScriptPolicy(root), 1);
    await writeFile(resolve(root, `packages/one/src/index.${extension}`), Buffer.from(source));
    const child = Bun.spawn(
      [
        process.execPath,
        resolve("node_modules/typescript/bin/tsc"),
        "--project",
        resolve(
          root,
          project === TypeScriptProject.Root ? "tsconfig.json" : "packages/one/tsconfig.json",
        ),
        "--noEmit",
        "--pretty",
        "false",
      ],
      { stdin: ProcessIo.Ignore, stdout: ProcessIo.Pipe, stderr: ProcessIo.Pipe, timeout: 4000 },
    );
    try {
      const [output, error, code] = await all([
        () => readBytes(child.stdout, IoLimit.ResponseBytes),
        () => readBytes(child.stderr, IoLimit.ResponseBytes),
        () => child.exited,
      ]);
      assert.equal(error.length, 0);
      assert.equal(code, diagnostic === undefined ? 0 : 2, output.toString());
      if (diagnostic !== undefined) {
        assert.ok(output.includes(Buffer.from(`TS${diagnostic}`)), output.toString());
        assert.ok(output.includes(Buffer.from(`index.${extension}`)), output.toString());
      } else assert.equal(output.length, 0);
      return code === 0;
    } finally {
      if (child.exitCode === null) child.kill(ProcessSignal.Kill);
      await child.exited;
    }
  });
}

export async function typeScriptTestingScope(policy: unknown) {
  return withTemporaryDirectory(async (root) => {
    await prepareStrictWorkspace(root, rootTypeScriptFixture, packageTypeScriptFixture, [
      "packages/*",
      "testing",
    ]);
    await mkdir(resolve(root, "testing"));
    await writeFile(
      resolve(root, "testing/package.json"),
      Buffer.from(JSON.stringify({ name: "@fixture/testing" })),
    );
    await writeFile(resolve(root, "testing/tsconfig.json"), Buffer.from(JSON.stringify(policy)));
    return checkTypeScriptPolicy(root);
  });
}
