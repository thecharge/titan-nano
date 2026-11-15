import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  FileEncoding,
  HookFile,
  IoLimit,
  LocalModel,
  OfflineRunArguments,
  OfflineTest,
  PackageManagerArgument,
  Packaging,
  PodmanArgument,
  ProcessIo,
  TextSymbol,
  VendorPackage,
} from "@titan/constants";
import { packageCheckFailure, VerificationMessage } from "@titan/messages";
import { readFileBytes } from "@titan/streams";
import { PackageManifestSchema } from "@titan/types";
import { prepareUpdatePackages } from "../../testing/factories/installed-update.ts";
import { prepareVendorFixtures } from "../../testing/factories/vendor-fixtures.ts";
import { imageName, root } from "./test-image.ts";

async function run(args: string[], cwd: string): Promise<void> {
  const child = Bun.spawn(args, {
    cwd,
    stdout: ProcessIo.Inherit,
    stderr: ProcessIo.Inherit,
    stdin: ProcessIo.Inherit,
  });
  if ((await child.exited) !== 0) throw new Error(packageCheckFailure(args));
}
if (!Bun.which(OfflineTest.Runtime)) throw new Error(VerificationMessage.PodmanRequired);
const image = await imageName();
await run([OfflineTest.Runtime, ...PodmanArgument.ImageExists, image], root);
await run([process.execPath, PackageManagerArgument.Run, Packaging.Prepare], root);
const manifest = PackageManifestSchema.parse(
  JSON.parse(
    (await readFileBytes(resolve(root, HookFile.Manifest), IoLimit.DataBytes)).toString(
      FileEncoding.Utf8,
    ),
  ),
);
const installation = await mkdtemp(resolve(tmpdir(), Packaging.TemporaryPrefix));
try {
  await run(
    [
      process.execPath,
      PackageManagerArgument.Add,
      resolve(
        root,
        Packaging.Distribution,
        `${Packaging.ArchivePrefix}${manifest.version}${Packaging.ArchiveExtension}`,
      ),
    ],
    installation,
  );
  await cp(resolve(root, LocalModel.TestHome), resolve(installation, LocalModel.TestHome), {
    recursive: true,
  });
  await prepareVendorFixtures(
    resolve(root, Packaging.VendorSources),
    resolve(installation, Packaging.VendorStubs),
  );
  await prepareUpdatePackages(root, resolve(installation, Packaging.UpdateFixtures));
  const probe = await Bun.build({
    entrypoints: [resolve(root, Packaging.ProbeSource)],
    outdir: installation,
    naming: Packaging.ProbeFile,
    target: Packaging.Target,
    external: [VendorPackage.Codex, VendorPackage.Claude],
  });
  if (!probe.success) throw new AggregateError(probe.logs);

  await run(
    [
      OfflineTest.Runtime,
      ...OfflineRunArguments,
      PodmanArgument.Volume,
      `${installation}${TextSymbol.Colon}${Packaging.InstalledDirectory}${PodmanArgument.ReadWrite}`,
      `${PodmanArgument.WorkDirectory}${Packaging.InstalledDirectory}`,
      Packaging.ProbeEnvironment,
      image,
      Packaging.Target,
      Packaging.ProbeFile,
    ],
    installation,
  );
} finally {
  await rm(installation, { recursive: true, force: true });
}
