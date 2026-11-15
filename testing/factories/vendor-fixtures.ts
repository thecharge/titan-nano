import { strict as assert } from "node:assert";
import { cp, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  IoLimit,
  Packaging,
  ProcessIo,
  VendorFixtureBuild,
  VendorPreparationFixture,
} from "@titan/constants";
import { all } from "@titan/core";
import { packageCommandFailure } from "@titan/messages";
import { readBytes, readFileBytes } from "@titan/streams";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { exists } from "@titan/workspace";

export async function prepareVendorFixtures(source: string, destination: string): Promise<string> {
  await cp(source, destination, { recursive: true });
  const args = [
    process.execPath,
    VendorFixtureBuild.Command,
    resolve(source, Packaging.NativeToolFixture),
    VendorFixtureBuild.Target,
    VendorFixtureBuild.Minify,
    VendorFixtureBuild.Output,
    resolve(destination, Packaging.NativeToolFixture),
  ];
  const child = Bun.spawn(args, {
    stdin: ProcessIo.Ignore,
    stdout: ProcessIo.Ignore,
    stderr: ProcessIo.Pipe,
    timeout: VendorFixtureBuild.TimeoutMilliseconds,
  });
  const [code, diagnostics] = await all([
    () => child.exited,
    () => readBytes(child.stderr, IoLimit.ResponseBytes),
  ]);
  if (code !== 0) throw new Error(packageCommandFailure(args, diagnostics.toString()));
  return destination;
}

export async function vendorFixturePreparation(launcher: string, mode: VendorPreparationFixture) {
  return withTemporaryDirectory(async (root) => {
    let source = resolve(Packaging.VendorSources);
    const destination = resolve(root, Packaging.VendorStubs);
    if (mode !== VendorPreparationFixture.Source) source = resolve(root, "source");
    if (mode === VendorPreparationFixture.Malformed) {
      await mkdir(source);
      await writeFile(resolve(source, Packaging.NativeToolFixture), Buffer.from("{"));
    }
    const failure = await thrownBy(async () => {
      assert.equal(await prepareVendorFixtures(source, destination), destination);
    });
    assert.equal(failure instanceof Error, mode !== VendorPreparationFixture.Source);
    if (failure) return true;
    assert.equal(await exists(resolve(destination, launcher)), true);
    const helper = await readFileBytes(
      resolve(destination, Packaging.NativeToolFixture),
      IoLimit.ResponseBytes,
    );
    assert.equal(/from ["']@titan\//.test(helper.toString()), false);
    return true;
  });
}
