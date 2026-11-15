import { Database } from "bun:sqlite";
import { strict as assert } from "node:assert";
import { chmod, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { ErrorCode, SnapshotMutation, WorkspaceMode } from "@titan/constants";
import { all, hash } from "@titan/core";
import { readBytes } from "@titan/streams";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  exists,
  readTree,
  sourceVersion,
  treeHash,
  verifiedChunks,
  writeTree,
} from "@titan/workspace";

import { openDirectoryFiles } from "../support/descriptors.ts";

export function workspaceSelected(selected: string[], obstacle: string) {
  return withTemporaryDirectory(async (root) => {
    await mkdir(resolve(root, "kept"));
    await writeFile(resolve(root, "kept/a.txt"), "Kept");
    await writeFile(resolve(root, "kept/b.txt"), "Kept");
    await writeFile(resolve(root, "kept-extra.txt"), Buffer.alloc(128, 1));
    await symlink(resolve(root, "missing"), resolve(root, "unrelated"));
    const database = new Database(resolve(root, "state.db"));
    try {
      database.exec("PRAGMA journal_mode=WAL; CREATE TABLE records(value TEXT)");
      let changes = 0;
      const captured = await readTree(
        root,
        {
          max_workspace_entries: obstacle === "entries" ? 2 : 3,
          max_workspace_bytes: obstacle === "bytes" ? 3 : 8,
          max_workspace_depth: obstacle === "depth" ? 1 : 3,
        },
        () => ({
          accept(bytes: Buffer) {
            if (bytes.toString() !== "Kept") return;
            database.exec("INSERT INTO records VALUES ('Concurrent unrelated record')");
            changes++;
          },
        }),
        obstacle === "omitted" ? ["kept/a.txt"] : [],
        selected,
      );
      if (Object.keys(captured).length) assert.ok(changes > 0);
      assert.equal(
        (await readTree(root, undefined, undefined, ["unrelated"]))["state.db"] !== undefined,
        true,
      );
      return Object.keys(captured);
    } finally {
      database.close();
    }
  });
}

export function versionedSource(size: number, mutation: SnapshotMutation) {
  return withTemporaryDirectory(async (root) => {
    const path = resolve(root, "source.bin");
    await writeFile(path, Buffer.alloc(size, 1));
    const files = await readTree(root);
    const entry = files["source.bin"];
    assert.ok(entry);
    const version = await sourceVersion(path);
    if (mutation === SnapshotMutation.Changed) await writeFile(path, Buffer.alloc(size, 2));
    if (mutation === SnapshotMutation.Grown) await writeFile(path, Buffer.alloc(size + 1, 1));
    const bytes = await readBytes(verifiedChunks(entry, undefined, version), size + 1);
    assert.deepEqual(bytes, Buffer.alloc(size, 1));
    return true;
  });
}

export async function snapshotRoundTrip(size: number, fill: number, mutation: SnapshotMutation) {
  return withTemporaryDirectory(async (root) => {
    const source = resolve(root, "source");
    const target = resolve(root, "target");
    await mkdir(source);
    const file = resolve(source, "file.bin");
    await writeFile(file, Buffer.alloc(size, fill));
    const manifest = await readTree(source);
    if (mutation === SnapshotMutation.Changed) await writeFile(file, Buffer.alloc(size, fill + 1));
    if (mutation === SnapshotMutation.Grown) await writeFile(file, Buffer.alloc(size + 1, fill));
    if (mutation === SnapshotMutation.Deleted) await rm(file);
    const entry = manifest["file.bin"];
    if (entry && mutation === SnapshotMutation.Escape) manifest["../escape"] = entry;
    if (entry && mutation === SnapshotMutation.Metadata) manifest[".git/config"] = entry;
    await writeTree(target, manifest);
    const copied = await readTree(target);
    return { bytes: copied["file.bin"]?.bytes, sameHash: copied["file.bin"]?.hash === entry?.hash };
  });
}

export async function legacySnapshotHash(
  size: number,
  fill: number,
  expectedFill = fill,
  mutation: SnapshotMutation = SnapshotMutation.None,
) {
  return withTemporaryDirectory(async (root) => {
    const bytes = Buffer.alloc(size, fill);
    await writeFile(resolve(root, "file.bin"), bytes);
    const manifest = await readTree(root);
    if (mutation === SnapshotMutation.Changed)
      await writeFile(resolve(root, "file.bin"), Buffer.alloc(size, fill + 1));
    if (mutation === SnapshotMutation.Grown)
      await writeFile(resolve(root, "file.bin"), Buffer.alloc(size + 1, fill));
    return (
      (await treeHash(manifest)) ===
      hash(JSON.stringify([["file.bin", Buffer.alloc(size, expectedFill).toString("base64")]]))
    );
  });
}

export async function workspaceExists(path: string, loop: boolean) {
  return withTemporaryDirectory(async (root) => {
    const file = resolve(root, path);
    await mkdir(dirname(file), { recursive: true });
    if (loop) await symlink(file, file);
    else await writeFile(file, "Exists");
    assert.equal(await exists(file), true);
    assert.equal(await exists(resolve(root, "missing")), false);
    return true;
  });
}

export async function workspaceVisibleFiles(paths: string[]) {
  return withTemporaryDirectory(async (root) => {
    for (const path of paths) {
      const file = resolve(root, path);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, Buffer.from("fixture"));
    }
    return Object.keys(await readTree(root));
  });
}

export async function workspaceCopyBatch(count: number, mutation: SnapshotMutation) {
  return withTemporaryDirectory(async (root) => {
    const source = resolve(root, "source");
    const target = resolve(root, "target");
    await mkdir(target);
    await writeFile(resolve(target, "stale.bin"), Buffer.from("Removed before copying"));
    await all(
      Array.from({ length: count }, (_, index) => async () => {
        const path = resolve(source, `group-${index % 2}`, `file-${index}.bin`);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, Buffer.alloc(128 * 1024 + 1, index));
        await chmod(path, index % 2 ? WorkspaceMode.PrivateExecutable : WorkspaceMode.PrivateFile);
      }),
    );
    const manifest = await readTree(source);
    const first = Object.values(manifest)[0];
    assert.ok(first);
    if (mutation === SnapshotMutation.Changed)
      await writeFile(first.source, Buffer.alloc(first.bytes, 255));
    if (mutation === SnapshotMutation.Deleted) await rm(first.source);
    const error = await thrownBy(() => writeTree(target, manifest));
    assert.equal(await openDirectoryFiles(root), 0);
    const copied = await readTree(target);
    assert.equal(copied["stale.bin"], undefined);
    for (const [path, entry] of Object.entries(copied)) {
      assert.deepEqual(await readFile(entry.source), await readFile(resolve(source, path)));
      assert.equal(entry.hash, manifest[path]?.hash);
      assert.equal(entry.executable, manifest[path]?.executable);
    }
    if (mutation === SnapshotMutation.None) {
      assert.equal(error, undefined);
      assert.equal(Object.keys(copied).length, count);
    } else {
      assert.ok(error instanceof Error);
      assert.equal(
        Reflect.get(error, "code"),
        mutation === SnapshotMutation.Deleted ? "ENOENT" : ErrorCode.SnapshotChanged,
      );
      assert.ok(Object.keys(copied).length < count);
    }
    return true;
  });
}
