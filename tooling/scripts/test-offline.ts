import { mkdir, realpath } from "node:fs/promises";
import { join } from "node:path";
import {
  HookCommand,
  OfflineRunArguments,
  OfflineTest,
  PodmanArgument,
  TextSymbol,
} from "@titan/constants";
import { OfflineMessage } from "@titan/messages";
import { commandStatus } from "./hook-process.ts";
import { imageName, root } from "./test-image.ts";

function fastEnvironment(): string[] {
  return process.env[OfflineTest.FastVariable] === OfflineTest.FastValue
    ? [OfflineTest.FastOption]
    : [];
}

async function runOffline(): Promise<number> {
  if (process.platform !== OfflineTest.Platform || !Bun.which(OfflineTest.Runtime)) {
    console.error(OfflineMessage.Unsupported);
    return 1;
  }
  const image = await imageName();
  const present = await commandStatus(
    [OfflineTest.Runtime, ...PodmanArgument.ImageExists, image],
    root,
  );
  if (present !== 0) {
    console.error(OfflineMessage.Prepare);
    return 1;
  }
  await mkdir(join(root, OfflineTest.Coverage), { recursive: true });
  const cache = await realpath(join(root, OfflineTest.DependencyCache));
  return commandStatus(
    [
      OfflineTest.Runtime,
      ...OfflineRunArguments,
      PodmanArgument.Volume,
      root + TextSymbol.Colon + OfflineTest.Workspace + PodmanArgument.ReadOnly,
      PodmanArgument.Volume,
      join(root, OfflineTest.Coverage) +
        TextSymbol.Colon +
        join(OfflineTest.Workspace, OfflineTest.Coverage) +
        PodmanArgument.ReadWrite,
      PodmanArgument.Volume,
      cache + TextSymbol.Colon + cache + PodmanArgument.ReadOnly,
      PodmanArgument.WorkDirectory + OfflineTest.Workspace,
      OfflineTest.BoundaryEnvironment,
      ...fastEnvironment(),
      image,
      HookCommand.Bun,
      OfflineTest.Driver,
      ...process.argv.slice(2),
    ],
    root,
  );
}

const code = await runOffline();
if (code !== 0) console.error(OfflineMessage.Failed);
process.exitCode = code;
