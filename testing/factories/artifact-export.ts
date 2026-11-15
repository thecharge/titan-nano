import { strict as assert } from "node:assert";
import { copyFile, lstat, mkdir, open, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { exportArtifact, inspectArtifacts } from "@titan/artifacts";
import { atomicWriteStream, RunStore, runResultChunks } from "@titan/board";
import {
  ArtifactExportFile,
  ArtifactExportFixture,
  BoardFile,
  BoardLimit,
  CliOption,
  ErrorCode,
  FileOpenMode,
  IoLimit,
  Newline,
  RunArtifactFile,
  RunStatus,
  WorkspaceFile,
  WorkspaceMode,
} from "@titan/constants";
import { hash } from "@titan/core";
import { TitanError } from "@titan/errors";
import { jsonBytes, readFileBytes } from "@titan/streams";
import { thrownBy } from "@titan/test-framework";
import {
  ArtifactExportManifestSchema,
  ArtifactExportSchema,
  type Run,
  type WorkspaceWriter,
} from "@titan/types";
import { exists, readTree, treeHash, writeTree } from "@titan/workspace";
import { createCli } from "../../apps/cli/src/application.ts";
import { defaultServices } from "../../apps/cli/src/bootstrap.ts";
import { withArtifactRun } from "./artifacts.ts";

export async function artifactExport(mode: ArtifactExportFixture, cli = false) {
  const content =
    mode === ArtifactExportFixture.Binary ? Buffer.alloc(131_073, 0xff) : Buffer.from("delivered");
  async function observe(run: Run, home: string) {
    const root = dirname(home);
    const inspection = await inspectArtifacts(run);
    const path = mode === ArtifactExportFixture.Nested ? "notes/report.txt" : "source.txt";
    const selected = inspection.files.find((file) => file.path === path);
    assert.ok(selected);
    const source = resolve(inspection.directory, selected.path);
    const original = await readFileBytes(source, IoLimit.DataBytes);
    const kept = await treeHash(await readTree(inspection.directory));
    const project = await treeHash(await readTree(run.project));
    let destination = resolve(root, "export");
    let id = selected.id;
    let write: WorkspaceWriter = writeTree;
    if (mode === ArtifactExportFixture.Existing) {
      await mkdir(destination);
      await writeFile(resolve(destination, "sentinel"), Buffer.from("keep"));
    }
    if (mode === ArtifactExportFixture.LinkedTarget) await symlink("absent", destination);
    if (mode === ArtifactExportFixture.LinkedParent) {
      await symlink(root, resolve(root, "alias"));
      destination = resolve(root, "alias/export");
    }
    if (mode === ArtifactExportFixture.MissingParent) destination = resolve(root, "absent/export");
    if (mode === ArtifactExportFixture.FileParent) {
      await writeFile(resolve(root, "parent"), Buffer.from("file"));
      destination = resolve(root, "parent/export");
    }
    if (mode === ArtifactExportFixture.Relative) destination = "relative-export";
    if (mode === ArtifactExportFixture.RunStorage) destination = resolve(run.root, "export");
    if (mode === ArtifactExportFixture.InvalidId) id = "bad";
    if (mode === ArtifactExportFixture.MissingId) id = hash("missing");
    if (mode === ArtifactExportFixture.Changed) await writeFile(source, Buffer.from("changed"));
    if (mode === ArtifactExportFixture.LinkedSource) {
      const external = resolve(root, "external");
      await writeFile(external, original);
      await rm(source);
      await symlink(external, source);
    }
    if (mode === ArtifactExportFixture.NotPassed) run.state = RunStatus.Blocked;
    if (mode === ArtifactExportFixture.OversizedMetadata) await rewriteExportIdentity(run);
    if (mode === ArtifactExportFixture.LongName) destination = resolve(root, "x".repeat(300));
    if (mode === ArtifactExportFixture.PartialWrite)
      write = async (directory) => {
        await mkdir(directory);
        await writeFile(resolve(directory, "partial"), Buffer.from("partial"));
        throw new TitanError(ErrorCode.ArtifactExport, "Injected partial copy failure");
      };
    if (mode === ArtifactExportFixture.ChangedDuringCopy)
      write = async (directory, files, limits) => {
        await writeFile(source, Buffer.from("changed during copy"));
        await writeTree(directory, files, limits);
      };
    if (mode === ArtifactExportFixture.MissingCopy)
      write = async (directory) => {
        await mkdir(directory);
      };
    if (mode === ArtifactExportFixture.AlteredCopy)
      write = async (directory, files, limits) => {
        await writeTree(directory, files, limits);
        await writeFile(resolve(directory, selected.path), Buffer.from("wrong copied bytes"));
      };
    if (mode === ArtifactExportFixture.ManifestConflict)
      write = async (directory, files, limits) => {
        await writeTree(directory, files, limits);
        await writeFile(
          resolve(destination, ArtifactExportFile.Manifest),
          Buffer.from("collision"),
        );
      };
    const output: unknown[] = [];
    let result: unknown;
    const error = await thrownBy(async () => {
      if (cli) {
        const main = createCli({ ...defaultServices, output: (value) => output.push(value) });
        await main([
          "artifacts",
          "export",
          run.run_id,
          id,
          "--home",
          home,
          `--${CliOption.Output}`,
          destination,
          "--json",
        ]);
        result = output[0];
      } else result = await exportArtifact(run, id, destination, write);
    });
    assert.equal(await treeHash(await readTree(run.project)), project);
    if (error) {
      if (mode === ArtifactExportFixture.Existing)
        assert.equal(
          (await readFileBytes(resolve(destination, "sentinel"), IoLimit.DataBytes)).toString(),
          "keep",
        );
      else if (mode === ArtifactExportFixture.LinkedTarget)
        assert.ok((await lstat(destination)).isSymbolicLink());
      else if (mode === ArtifactExportFixture.FileParent)
        assert.equal(
          (await readFileBytes(resolve(root, "parent"), IoLimit.DataBytes)).toString(),
          "file",
        );
      else if (mode !== ArtifactExportFixture.LongName)
        assert.equal(await exists(destination), false);
      assert.ok(
        !(await readdir(root)).some((entry) => entry.endsWith(WorkspaceFile.TemporarySuffix)),
      );
      throw error;
    }
    const receipt = ArtifactExportSchema.parse(result);
    const manifest = ArtifactExportManifestSchema.parse(
      JSON.parse((await readFileBytes(receipt.manifest, IoLimit.DataBytes)).toString()),
    );
    assert.deepEqual(manifest, receipt.delivery);
    assert.equal(manifest.file.id, id);
    assert.equal(manifest.run_id, run.run_id);
    assert.equal(manifest.workflow_revision, run.workflow_revision);
    assert.equal(manifest.delivery_hash, inspection.hash);
    assert.deepEqual(
      await readFileBytes(resolve(receipt.directory, manifest.content), IoLimit.DataBytes),
      original,
    );
    assert.equal(
      Boolean(
        (await lstat(resolve(receipt.directory, manifest.content))).mode &
          WorkspaceMode.ExecutableBits,
      ),
      selected.executable,
    );
    assert.equal((await lstat(receipt.directory)).mode & 0o777, WorkspaceMode.PrivateExecutable);
    assert.equal(await treeHash(await readTree(inspection.directory)), kept);
    return true;
  }
  return withArtifactRun(
    mode === ArtifactExportFixture.Executable,
    observe,
    mode === ArtifactExportFixture.Nested ? "notes/report.txt" : "added.txt",
    content,
  );
}

async function rewriteExportIdentity(run: Run): Promise<void> {
  run.workflow_id = "x".repeat(IoLimit.DataBytes);
  const journal = resolve(run.root, BoardFile.Journal);
  const temporary = `${journal}${WorkspaceFile.TemporarySuffix}`;
  const file = await open(temporary, FileOpenMode.Exclusive, WorkspaceMode.PrivateFile);
  try {
    for await (const event of new RunStore(run.root).events(run.version)) {
      event.state.workflow_id = run.workflow_id;
      await file.writeFile(await jsonBytes(event, BoardLimit.RecordBytes));
      await file.writeFile(Buffer.from(Newline));
    }
  } finally {
    await file.close();
  }
  await copyFile(temporary, journal);
  await rm(temporary);
  await atomicWriteStream(
    resolve(run.root, RunArtifactFile.Result),
    runResultChunks(run, { deliver: run.nodes.deliver?.output }),
    BoardLimit.RecordBytes,
  );
  assert.equal((await inspectArtifacts(run)).workflow_id, run.workflow_id);
}
