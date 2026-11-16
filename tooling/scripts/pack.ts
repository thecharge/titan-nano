import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  CliRuntime,
  DashboardBuild,
  DashboardHtmlSource,
  DashboardPolicy,
  DashboardRoute,
  FileEncoding,
  HookFile,
  IoLimit,
  KnowledgeMeaningLocal,
  PackageManagerArgument,
  Packaging,
  PackagingAssets,
  ProcessIo,
  VendorPackage,
} from "@titan/constants";
import { readFileBytes } from "@titan/streams";
import {
  CliOutputSchema,
  DashboardPackedAssetsSchema,
  WorkspacePackageManifestSchema,
} from "@titan/types";
import { packageOutput } from "./package-output.ts";
import { nativeCodexVersion } from "./package-vendors.ts";

const root = resolve(import.meta.dir, HookFile.RepositoryRoot);
const distribution = resolve(root, process.argv[2] ?? Packaging.Distribution);
const destination = resolve(distribution, basename(Packaging.Destination));
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
const build = await Bun.build({
  entrypoints: [resolve(root, Packaging.CliSource)],
  outdir: destination,
  naming: Packaging.Bundle,
  target: Packaging.Target,
  external: [
    VendorPackage.CodexCli,
    VendorPackage.Claude,
    VendorPackage.Sandbox,
    VendorPackage.Transformers,
    KnowledgeMeaningLocal.SqliteVec,
  ],
  minify: false,
});
if (!build.success) {
  for (const log of build.logs) console.error(log);
  process.exit(1);
}
const hostBuild = await Bun.build({
  entrypoints: [resolve(root, Packaging.AgentSource)],
  outdir: destination,
  naming: Packaging.AgentBundle,
  target: Packaging.Target,
  external: [
    VendorPackage.CodexCli,
    VendorPackage.Claude,
    VendorPackage.Sandbox,
    VendorPackage.Transformers,
    KnowledgeMeaningLocal.SqliteVec,
  ],
  minify: false,
});
if (!hostBuild.success) throw new Error(String(hostBuild.logs));
const nativeToolBuild = await Bun.build({
  entrypoints: [resolve(root, Packaging.NativeToolSource)],
  outdir: destination,
  naming: Packaging.NativeToolBundle,
  target: Packaging.Target,
  minify: false,
});
if (!nativeToolBuild.success) throw new AggregateError(nativeToolBuild.logs);
const manifest = WorkspacePackageManifestSchema.parse(
  JSON.parse(
    (await readFileBytes(resolve(root, HookFile.Manifest), IoLimit.DataBytes)).toString(
      FileEncoding.Utf8,
    ),
  ),
);
await writeFile(
  resolve(destination, HookFile.Manifest),
  JSON.stringify(
    {
      name: Packaging.CliPackage,
      version: manifest.version,
      license: Packaging.LicenseId,
      private: true,
      type: Packaging.Module,
      bin: { titan: Packaging.BundleExport },
      files: [
        Packaging.Bundle,
        Packaging.AgentBundle,
        Packaging.NativeToolBundle,
        Packaging.Readme,
        Packaging.Examples,
        Packaging.Answers,
        Packaging.Assets,
        ...Packaging.LegalFiles,
      ],
      engines: { bun: Packaging.BunEngine },
      dependencies: {
        [VendorPackage.CodexCli]: await nativeCodexVersion(
          pathToFileURL(
            await Bun.resolve(VendorPackage.Codex, resolve(root, Packaging.CodexAdapter)),
          ).href,
        ),
        [VendorPackage.Claude]: manifest.workspaces.catalog[VendorPackage.Claude],
        [VendorPackage.Sandbox]: manifest.workspaces.catalog[VendorPackage.Sandbox],
        [VendorPackage.Transformers]: manifest.workspaces.catalog[VendorPackage.Transformers],
        [KnowledgeMeaningLocal.SqliteVec]:
          manifest.workspaces.catalog[KnowledgeMeaningLocal.SqliteVec],
      },
    },
    null,
    2,
  ),
);
await cp(resolve(root, Packaging.Examples), resolve(destination, Packaging.Examples), {
  recursive: true,
});
await cp(resolve(root, Packaging.Answers), resolve(destination, Packaging.Answers), {
  recursive: true,
});
await cp(resolve(root, Packaging.PreviewGuide), resolve(destination, Packaging.Readme));
for (const file of Packaging.LegalFiles) await cp(resolve(root, file), resolve(destination, file));
await mkdir(resolve(destination, Packaging.Assets));
const dashboard = await Bun.build({
  entrypoints: [resolve(root, DashboardBuild.Source)],
  target: DashboardBuild.Target,
  minify: true,
});
if (!dashboard.success) throw new AggregateError(dashboard.logs);
const dashboardAssets = [];
for (const output of dashboard.outputs) {
  const extension = extname(output.path);
  const html = extension === DashboardBuild.HtmlExtension;
  dashboardAssets.push({
    path: html ? DashboardRoute.Page : DashboardHtmlSource.Origin + basename(output.path),
    body: await output.text(),
    type: html
      ? DashboardPolicy.Html
      : extension === Packaging.ScriptExtension
        ? DashboardPolicy.Script
        : DashboardPolicy.Style,
  });
}
await writeFile(
  resolve(destination, DashboardBuild.PackedAssets),
  JSON.stringify(DashboardPackedAssetsSchema.parse(dashboardAssets)),
);
for (const [name, args] of PackagingAssets) {
  const out = await packageOutput(
    [process.execPath, resolve(root, Packaging.CliSource), ...args, CliRuntime.JsonFlag],
    root,
  );
  const envelope = CliOutputSchema.parse(JSON.parse(out.toString(FileEncoding.Utf8)));
  await writeFile(
    resolve(destination, Packaging.Assets, name),
    name.endsWith(Packaging.TextExtension)
      ? String(envelope.data)
      : JSON.stringify(envelope.data ?? null),
  );
}
const child = Bun.spawn(
  [
    process.execPath,
    PackageManagerArgument.Manager,
    PackageManagerArgument.Pack,
    PackageManagerArgument.Destination,
    distribution,
  ],
  {
    cwd: destination,
    stdout: ProcessIo.Inherit,
    stderr: ProcessIo.Inherit,
  },
);
process.exit(await child.exited);
