import { strict as assert } from "node:assert";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ScriptSandbox } from "@titan/constants";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { verifySandboxDistribution } from "../../tooling/scripts/sandbox-distribution.ts";

export function sandboxDistribution(linux: boolean, fault: string) {
  return withTemporaryDirectory(async (directory) => {
    const source = ScriptSandbox.Source;
    const root = resolve(import.meta.dir, "../..");
    await writeFile(resolve(directory, ScriptSandbox.Binary), "native executable fixture");
    await writeFile(resolve(directory, source.Archive), "source archive fixture");
    await writeFile(resolve(directory, source.LicenseOutput), "Apache-2.0");
    await cp(resolve(root, source.Inventory), resolve(directory, source.InventoryOutput));
    await cp(resolve(root, source.Notices), resolve(directory, source.NoticesOutput));
    if (fault === "nested") {
      await mkdir(resolve(directory, "assets"));
      await writeFile(resolve(directory, "assets/syd"), "removed");
    }
    if (fault === "helper") await writeFile(resolve(directory, "syd"), "removed");
    if (fault === "source") await writeFile(resolve(directory, "syd-source.tar.gz"), "removed");
    if (fault === "notices") await writeFile(resolve(directory, source.NoticesOutput), "missing");
    if (fault === "missing") await rm(resolve(directory, ScriptSandbox.Binary));
    if (fault === "inventory" || fault === "license") {
      const inventory = await Bun.file(resolve(directory, source.InventoryOutput)).json();
      if (fault === "inventory") inventory.components.pop();
      if (fault === "license") inventory.components[0].license = "GPL-3.0-only";
      await writeFile(resolve(directory, source.InventoryOutput), JSON.stringify(inventory));
    }
    if (fault === "none") await verifySandboxDistribution(directory, linux);
    else await assert.rejects(() => verifySandboxDistribution(directory, linux));
    return true;
  });
}
