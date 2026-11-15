import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createSecretScanner, verificationEnvironment } from "@titan/config";
import { ErrorCode, IoLimit, WorkspaceSecretFixture } from "@titan/constants";
import { all } from "@titan/core";
import { readBytes } from "@titan/streams";
import { withProcessDeadline } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { readTree, treeHash, writeTree } from "@titan/workspace";

export async function scopedWorkspace(mode: WorkspaceSecretFixture, copy: boolean) {
  return withTemporaryDirectory(async (root) => {
    const source = resolve(root, "source");
    const target = resolve(root, "target");
    await mkdir(source);
    const token = randomBytes(32).toString("hex");
    const scanner = () => createSecretScanner({ TITAN_EXECUTION_TOKEN: token });
    let path = "content.txt";
    if (mode === WorkspaceSecretFixture.Filename) path = `${token}.txt`;
    if (mode === WorkspaceSecretFixture.Directory) {
      await mkdir(resolve(source, token));
      path = `${token}/content.txt`;
    }
    let content = Buffer.from("Ordinary project content");
    if (mode === WorkspaceSecretFixture.Content) content = Buffer.from(token);
    if (mode === WorkspaceSecretFixture.Boundary)
      content = Buffer.concat([Buffer.alloc(IoLimit.ChunkBytes - 16, 97), Buffer.from(token)]);
    await writeFile(resolve(source, path), content);
    if (mode === WorkspaceSecretFixture.Separate) {
      await writeFile(resolve(source, "a.txt"), token.slice(0, 32));
      await writeFile(resolve(source, "b.txt"), token.slice(32));
    }
    const files = await readTree(source);
    const safe = [WorkspaceSecretFixture.Clean, WorkspaceSecretFixture.Separate].includes(mode);
    const capture = () =>
      copy ? writeTree(target, files, undefined, scanner) : readTree(source, undefined, scanner);
    if (safe) {
      await capture();
      const observed = await readTree(copy ? target : source, undefined, scanner);
      assert.equal(await treeHash(observed), await treeHash(files));
      assert.deepEqual(await readFile(resolve(copy ? target : source, path)), content);
    } else {
      await assert.rejects(capture(), { code: ErrorCode.SecretValue });
    }
    if (!safe && copy) {
      const captured = await readdir(target, { recursive: true });
      assert.deepEqual(captured, []);
      const entries = await readTree(target);
      assert.equal(Object.keys(entries).length, 0);
    }
    return true;
  });
}

export async function globalWorkspaceGuard(copy: boolean, leaked: boolean) {
  return withTemporaryDirectory(async (root) => {
    const source = resolve(root, "source");
    await mkdir(source);
    const token = randomBytes(32).toString("hex");
    await writeFile(resolve(source, "content.txt"), leaked ? token : "Ordinary project content");
    const child = Bun.spawn(
      [
        process.execPath,
        resolve(import.meta.dir, "../fixtures/workspace-scoped-secret.mjs"),
        source,
        resolve(root, "target"),
        copy ? "copy" : "read",
      ],
      {
        env: { ...verificationEnvironment(root), TITAN_WORKSPACE_TOKEN: token },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    return withProcessDeadline(child, 3000, async () => {
      const [stdout, stderr, code] = await all([
        () => readBytes(child.stdout, 1024),
        () => readBytes(child.stderr, 4096),
        () => child.exited,
      ] as const);
      assert.equal(code, 0);
      assert.equal(stdout.includes(Buffer.from(token)), false);
      assert.equal(stderr.byteLength, 0);
      assert.deepEqual(JSON.parse(stdout.toString()), {
        code: leaked ? ErrorCode.SecretValue : null,
      });
      return true;
    });
  });
}
