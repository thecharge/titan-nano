import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  FileEncoding,
  HashAlgorithm,
  HookFile,
  LocalModel,
  OfflineTest,
  PodmanArgument,
} from "@titan/constants";
import { LocalModelStore } from "@titan/workspace";
import { commandStatus } from "./hook-process.ts";
import { prepareScriptSandbox } from "./prepare-script-sandbox.ts";

export const root = resolve(import.meta.dir, HookFile.RepositoryRoot);
export const containerfile = resolve(root, OfflineTest.Containerfile);

export async function imageName(directory: string = root): Promise<string> {
  const contents = await readFile(resolve(directory, OfflineTest.Containerfile));
  const digest = createHash(HashAlgorithm.Sha256).update(contents).digest(FileEncoding.Hex);
  return OfflineTest.ImagePrefix + digest.slice(0, OfflineTest.ImageDigestLength);
}

if (import.meta.main) {
  await prepareScriptSandbox(root);
  await new LocalModelStore(resolve(root, LocalModel.TestHome)).fetch();
  process.exitCode = await commandStatus(
    [
      OfflineTest.Runtime,
      ...PodmanArgument.Build,
      containerfile,
      PodmanArgument.Tag,
      await imageName(),
      resolve(root, OfflineTest.BuildContext),
    ],
    root,
  );
}
