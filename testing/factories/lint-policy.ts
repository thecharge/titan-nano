import { strict as assert } from "node:assert";
import { cp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { object, verificationEnvironment } from "@titan/config";
import { FileEncoding, IoLimit, LintPolicy, ProcessIo, ProcessSignal } from "@titan/constants";
import { all } from "@titan/core";
import { readBytes, readFileBytes } from "@titan/streams";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { checkLintPolicy, validLintPolicy } from "../../tooling/scripts/check-lint-policy.ts";

async function policyBytes() {
  return readFileBytes(resolve(LintPolicy.File), IoLimit.DataBytes);
}

export async function lintPolicyCandidate(path: string[], value: unknown, reverse = false) {
  const base = object(JSON.parse((await policyBytes()).toString(FileEncoding.Utf8)));
  let target = base;
  for (const part of path.slice(0, -1)) {
    const child = object(target[part]);
    target[part] = child;
    target = child;
  }
  const field = path.at(-1);
  if (field) target[field] = value;
  return validLintPolicy(reverse ? Object.fromEntries(Object.entries(base).reverse()) : base);
}

export async function lintPolicyFile(mode: string) {
  return withTemporaryDirectory(async (root) => {
    const path = resolve(root, LintPolicy.File);
    const bytes = await policyBytes();
    let content = bytes;
    if (mode === "compact") content = Buffer.from(JSON.stringify(JSON.parse(bytes.toString())));
    if (mode === "malformed") content = Buffer.from("{");
    if (mode === "null") content = Buffer.from("null");
    if (mode === "empty") content = Buffer.from("{}");
    if (mode === "large") content = Buffer.alloc(IoLimit.DataBytes + 1, 32);
    if (mode !== "missing") await writeFile(path, content);
    const code = await checkLintPolicy(root);
    if (mode !== "missing") assert.deepEqual(await readFile(path), content);
    return code;
  });
}

async function prepareLintSource(root: string, files: Record<string, string>) {
  await writeFile(resolve(root, LintPolicy.File), await policyBytes());
  await cp(resolve("tsconfig.json"), resolve(root, "tsconfig.json"));
  await symlink(resolve("node_modules"), resolve(root, "node_modules"));
  for (const path of [LintPolicy.ValuePlugin, LintPolicy.ShapePlugin, LintPolicy.LiteralPlugin]) {
    await mkdir(dirname(resolve(root, path)), { recursive: true });
    await cp(resolve(path), resolve(root, path));
  }
  for (const [path, source] of Object.entries(files)) {
    await mkdir(dirname(resolve(root, path)), { recursive: true });
    await writeFile(resolve(root, path), Buffer.from(source));
  }
}

async function runBiome(root: string, args: string[]) {
  const child = Bun.spawn([process.execPath, resolve(LintPolicy.Cli), ...args], {
    cwd: root,
    stdin: ProcessIo.Ignore,
    stdout: ProcessIo.Pipe,
    stderr: ProcessIo.Pipe,
    timeout: LintPolicy.TimeoutMilliseconds,
    env: verificationEnvironment(root),
  });
  try {
    const [output, error, code] = await all([
      () => readBytes(child.stdout, IoLimit.ResponseBytes),
      () => readBytes(child.stderr, IoLimit.ResponseBytes),
      () => child.exited,
    ]);
    return { code, diagnostics: Buffer.concat([output, error]) };
  } finally {
    if (child.exitCode === null) child.kill(ProcessSignal.Kill);
    await child.exited;
  }
}

export async function lintSource(files: Record<string, string>, diagnostic?: string) {
  return withTemporaryDirectory(async (root) => {
    await prepareLintSource(root, files);
    const paths = Object.keys(files);
    const formatting = await runBiome(root, ["format", "--write", ...paths]);
    assert.equal(formatting.code, 0, formatting.diagnostics.toString());
    const expected = await all(paths.map((path) => () => readFile(resolve(root, path))));
    const { code, diagnostics } = await runBiome(root, [
      "ci",
      "--colors=off",
      "--max-diagnostics=20",
      "--error-on-warnings",
      ...paths,
    ]);
    for (const [index, path] of paths.entries())
      assert.deepEqual(await readFile(resolve(root, path)), expected[index]);
    assert.equal(code, diagnostic ? 1 : 0, diagnostics.toString());
    if (diagnostic)
      assert.ok(diagnostics.includes(Buffer.from(diagnostic)), diagnostics.toString());
    return { code, matched: Boolean(diagnostic), unchanged: true };
  });
}
