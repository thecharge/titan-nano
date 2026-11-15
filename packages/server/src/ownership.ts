import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  ErrorCode,
  ErrorField,
  FileEncoding,
  IoLimit,
  MissingProcessCode,
  ServerFile,
  ServerLimit,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { ServerMessage } from "@titan/messages";
import { readFileBytes } from "@titan/streams";
import { ServerOwnerSchema } from "@titan/types";
import { exists } from "@titan/workspace";
import { ownOfflineHome } from "./maintenance.ts";

async function rejectLiveOwner(lock: string): Promise<void> {
  const bytes = await readFileBytes(resolve(lock, ServerFile.Owner), IoLimit.AddressBytes);
  const owner = ServerOwnerSchema.parse(JSON.parse(bytes.toString(FileEncoding.Utf8)));
  if (owner.lease) return;
  try {
    process.kill(owner.pid, 0);
  } catch (error) {
    if (error instanceof Error && Reflect.get(error, ErrorField.Code) === MissingProcessCode)
      return;
  }
  throw new TitanError(ErrorCode.ServerLocked, ServerMessage.Lock);
}

export async function ownServer(home: string, resources: AsyncDisposableStack): Promise<void> {
  await ownOfflineHome(home, resources);
  try {
    const lock = resolve(home, ServerFile.Lock);
    if (await exists(lock)) {
      await rejectLiveOwner(lock);
      await rm(lock, { recursive: true });
    }
    await mkdir(lock, { mode: ServerLimit.DirectoryMode });
    resources.defer(() => rm(lock, { recursive: true, force: true }));
    await writeFile(
      resolve(lock, ServerFile.Owner),
      Buffer.from(JSON.stringify({ pid: process.pid, started_at: Date.now(), lease: true })),
      { mode: ServerLimit.FileMode },
    );
  } catch {
    throw new TitanError(ErrorCode.ServerLocked, ServerMessage.Lock);
  }
}
