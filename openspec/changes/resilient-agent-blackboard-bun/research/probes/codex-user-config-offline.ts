import { strict as assert } from "node:assert";
import { realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { OfflineRunArguments, OfflineTest, PodmanArgument, ProcessIo } from "@titan/constants";
import { withTemporaryDirectory } from "../../../../../testing/packages/framework/src/files.ts";
import { imageName } from "../../../../../tooling/scripts/test-image.ts";

const supplied = process.argv[2];
assert.ok(supplied, "Supply the pinned native Codex binary path");
const binary = await realpath(supplied);
await withTemporaryDirectory(async (temporary) => {
  const built = await Bun.build({
    entrypoints: [resolve(import.meta.dir, "codex-user-config.ts")],
    outdir: temporary,
    naming: "probe.js",
    target: "bun",
  });
  assert.ok(built.success, String(built.logs));
  const child = Bun.spawn(
    [
      OfflineTest.Runtime,
      ...OfflineRunArguments,
      PodmanArgument.Volume,
      `${binary}:/codex:ro`,
      PodmanArgument.Volume,
      `${resolve(temporary, "probe.js")}:/probe.js:ro`,
      "--workdir=/tmp",
      await imageName(),
      "bun",
      "/probe.js",
      "/codex",
    ],
    {
      stdout: ProcessIo.Inherit,
      stderr: ProcessIo.Inherit,
    },
  );
  assert.equal(await child.exited, 0);
});
