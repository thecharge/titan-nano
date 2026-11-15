import { Database } from "bun:sqlite";
import { strict as assert } from "node:assert";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ErrorCode, IoLimit, SnapshotMutation } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { readTree, writeTree } from "@titan/workspace";
import { openDirectoryFiles } from "../support/descriptors.ts";

export async function treeStability(mutation: SnapshotMutation, inspect = false, selected = false) {
  return withTemporaryDirectory(async (root) => {
    const path = resolve(root, "state.db");
    const database = new Database(path);
    let closed = false;
    try {
      if (mutation !== SnapshotMutation.Grown && !inspect) database.exec("PRAGMA journal_mode=WAL");
      database.exec(
        "PRAGMA wal_autocheckpoint=0; CREATE TABLE records(value TEXT); INSERT INTO records VALUES ('Original record')",
      );
      const padding = Buffer.alloc(IoLimit.ChunkBytes, 41);
      await writeFile(resolve(root, "padding.bin"), Buffer.concat([padding, padding, padding]));
      const names = new Set(
        (await readdir(root)).filter((name) => !selected || name !== "padding.bin"),
      );
      const observed = new Set<string>();
      let current = "";
      let invoked = false;
      const scanner = () => {
        const path = current;
        return {
          accept(bytes: Buffer) {
            if (names.has(bytes.toString())) {
              current = bytes.toString();
              return;
            }
            observed.add(path);
            if (observed.size !== names.size || invoked) return;
            invoked = true;
            if (inspect || mutation === SnapshotMutation.Escape)
              assert.deepEqual(database.query("SELECT value FROM records").all(), [
                { value: "Original record" },
              ]);
            if (mutation === SnapshotMutation.Changed)
              database.exec("INSERT INTO records VALUES ('Concurrent record')");
            if (mutation === SnapshotMutation.Metadata)
              database.exec("PRAGMA wal_checkpoint(TRUNCATE)");
            if (mutation === SnapshotMutation.Grown)
              database.exec(
                "PRAGMA journal_mode=WAL; INSERT INTO records VALUES ('Concurrent record')",
              );
            if (mutation === SnapshotMutation.Deleted) {
              database.close();
              closed = true;
            }
          },
        };
      };
      const failure = await thrownBy(async () => {
        const captured = await readTree(
          root,
          undefined,
          scanner,
          [],
          selected ? ["state.db", "state.db-wal", "state.db-shm", "state.db-journal"] : undefined,
        );
        assert.ok(captured["state.db"]);
        await writeTree(resolve(root, ".titan/captured"), captured);
      });
      assert.equal(invoked, true);
      if (mutation === SnapshotMutation.None) assert.equal(failure, undefined);
      else {
        assert.ok(failure instanceof TitanError);
        assert.equal(failure.code, ErrorCode.SnapshotChanged);
      }
      return {
        refused: failure !== undefined,
        liveDatabasePreserved: (await readTree(root))["state.db"] !== undefined,
      };
    } finally {
      if (!closed) database.close();
      assert.equal(await openDirectoryFiles(root), 0);
    }
  });
}

export async function runtimeOmissions(mode: string): Promise<boolean> {
  return withTemporaryDirectory(async (root) => {
    const prefix = mode === "nested" ? "home/" : "";
    if (prefix) await mkdir(resolve(root, "home"));
    const name = `${prefix}runs.db`;
    const note = `${prefix}notes.txt`;
    const database = new Database(resolve(root, name));
    database.exec("PRAGMA journal_mode=WAL; CREATE TABLE records(value TEXT)");
    await writeFile(resolve(root, note), "Source document");
    const omitted = ["", "-wal", "-shm", "-journal"].map((suffix) => name + suffix);
    if (mode === "unowned") omitted.splice(0, omitted.length, "another.db");
    if (mode === "prefix") omitted.splice(0, omitted.length, "runs.db-extra");
    if (mode === "escape") omitted.splice(0, omitted.length, "../runs.db");
    let changed = false;
    try {
      const error = await thrownBy(async () => {
        const files = await readTree(
          root,
          undefined,
          () => ({
            accept(bytes: Buffer) {
              if (changed || bytes.toString() !== "Source document") return;
              changed = true;
              database.exec("INSERT INTO records VALUES ('Concurrent runtime write')");
            },
          }),
          omitted,
        );
        assert.deepEqual(Object.keys(files), [note]);
        await writeTree(resolve(root, ".titan/evidence"), files);
      });
      if (mode === "same" || mode === "nested") {
        assert.equal(error, undefined);
        assert.equal(changed, true);
      } else if (mode === "escape") {
        assert.ok(error instanceof Error);
        assert.equal(changed, false);
      } else {
        assert.ok(error instanceof TitanError);
        assert.equal(error.code, ErrorCode.SnapshotChanged);
        assert.equal(changed, true);
      }
      assert.equal(database.query("SELECT COUNT(*) AS count FROM records").get() !== null, true);
      return true;
    } finally {
      database.close();
    }
  });
}

export async function inventoryStability(companion: string, occurrence: number) {
  return withTemporaryDirectory(async (root) => {
    const database = new Database(resolve(root, "state.db"));
    database.exec(
      "PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE records(value TEXT); INSERT INTO records VALUES ('Retained')",
    );
    let observations = 0;
    let closed = false;
    try {
      const failure = await thrownBy(async () => {
        const files = await readTree(root, undefined, () => ({
          accept(bytes: Buffer) {
            if (bytes.toString() !== companion) return;
            observations++;
            if (observations !== occurrence) return;
            database.close();
            closed = true;
          },
        }));
        assert.deepEqual(Object.keys(files).sort(), ["state.db", "state.db-shm", "state.db-wal"]);
      });
      assert.ok(observations > 0);
      if (occurrence) {
        assert.equal(closed, true);
        assert.ok(failure instanceof TitanError);
        assert.equal(failure.code, ErrorCode.SnapshotChanged);
      } else assert.equal(failure, undefined);
      const inspect = new Database(resolve(root, "state.db"), { readonly: true });
      try {
        assert.deepEqual(inspect.query("SELECT value FROM records").all(), [{ value: "Retained" }]);
      } finally {
        inspect.close();
      }
      return true;
    } finally {
      if (!closed) database.close();
      assert.equal(await openDirectoryFiles(root), 0);
    }
  });
}
