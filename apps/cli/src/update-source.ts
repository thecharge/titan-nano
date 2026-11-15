import { readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  ErrorCode,
  ExitCode,
  HookFile,
  IoLimit,
  PackageManagerArgument,
  Packaging,
  UpdateFile,
  UpdatePolicy,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { UpdateMessage } from "@titan/messages";
import { captureCommand } from "@titan/process";
import { readFileBytes } from "@titan/streams";
import { type UpdateRelease, UpdateSourceManifestSchema } from "@titan/types";

async function sourceCommand(command: readonly string[], cwd: string): Promise<Buffer> {
  try {
    const result = await captureCommand(command, cwd, {
      timeout_ms: UpdateFile.PackageMilliseconds,
      maximum_bytes: Packaging.OutputBytes,
    });
    if (result.exit_code !== ExitCode.Success) throw new Error(UpdateMessage.PackageFailed);
    return result.stdout;
  } catch {
    throw new TitanError(ErrorCode.Arguments, UpdateMessage.PackageFailed);
  }
}

export async function buildUpdateRelease(
  release: UpdateRelease,
  directory: string,
  runtime: string,
): Promise<string> {
  const source = join(directory, UpdateFile.Workspace);
  await sourceCommand(
    [
      UpdatePolicy.Git,
      ...UpdateFile.Clone,
      release.tag,
      UpdateFile.EndOptions,
      release.source,
      source,
    ],
    directory,
  );
  const object = (
    await sourceCommand(
      [UpdatePolicy.Git, UpdateFile.RevParse, UpdateFile.TagReferencePrefix + release.tag],
      source,
    )
  )
    .toString()
    .trim();
  if (object !== release.object)
    throw new TitanError(ErrorCode.ConfigConflict, UpdateMessage.TransactionChanged);
  const manifest = UpdateSourceManifestSchema.parse(
    JSON.parse(
      (await readFileBytes(join(source, HookFile.Manifest), IoLimit.DataBytes)).toString(),
    ),
  );
  if (manifest.version !== release.version)
    throw new TitanError(ErrorCode.ConfigConflict, UpdateMessage.TransactionChanged);
  await sourceCommand([runtime, ...UpdateFile.FrozenInstall], source);
  await sourceCommand([runtime, PackageManagerArgument.Run, Packaging.Prepare], source);
  const distribution = join(source, Packaging.Distribution);
  const archives = (await readdir(distribution)).filter(
    (name) => name.startsWith(Packaging.ArchivePrefix) && name.endsWith(Packaging.ArchiveExtension),
  );
  if (archives.length !== 1 || !archives[0])
    throw new TitanError(ErrorCode.Arguments, UpdateMessage.PackageFailed);
  return join(distribution, archives[0]);
}
