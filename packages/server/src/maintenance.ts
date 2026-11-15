import { constants } from "node:fs";
import { chmod, cp, lstat, mkdtemp, open, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { RunStore } from "@titan/board";
import {
  ConfigWrite,
  DaemonStartup,
  ErrorCode,
  ErrorField,
  FileErrorCode,
  HttpMethod,
  IoLimit,
  KnowledgeFile,
  ServerCredential,
  ServerDatabaseAdapter,
  ServerFile,
  ServerLimit,
  ServerRoute,
  ServerSql,
  UpdateFile,
  UpdatePhase,
  UpdatePolicy,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { ServerMessage, UpdateMessage } from "@titan/messages";
import { readFileBytes } from "@titan/streams";
import {
  ServerStopResponseSchema,
  StoredRunSchema,
  type UpdateBackup,
  type UpdateCatalog,
  UpdateTransactionSchema,
} from "@titan/types";
import { exists } from "@titan/workspace";
import { callAsPerson } from "./client.ts";

async function guardLease(
  path: string,
  resources: AsyncDisposableStack,
  create: boolean,
): Promise<void> {
  const file = await open(
    path,
    constants.O_RDWR |
      constants.O_NOFOLLOW |
      constants.O_NONBLOCK |
      (create ? constants.O_CREAT : 0),
    ServerLimit.FileMode,
  ).catch((error: unknown) => {
    if (
      !create &&
      error instanceof Error &&
      Reflect.get(error, ErrorField.Code) === FileErrorCode.Missing
    )
      return undefined;
    throw error;
  });
  if (!file) return;
  resources.defer(() => file.close());
  const metadata = await file.stat();
  if (
    !metadata.isFile() ||
    metadata.nlink !== ServerCredential.Links ||
    (process.getuid && metadata.uid !== process.getuid())
  )
    throw new TitanError(ErrorCode.ServerLocked, ServerMessage.Lock);
}

async function claim(
  home: string,
  path: string,
  resources: AsyncDisposableStack,
  message: string,
): Promise<void> {
  try {
    for (const suffix of KnowledgeFile.SqliteSidecars)
      await guardLease(resolve(home, path + suffix), resources, suffix.length === 0);
    const lease = new Bun.SQL({
      adapter: ServerDatabaseAdapter,
      filename: resolve(home, path),
    });
    resources.defer(() => lease.close());
    for (const query of ServerSql.ClaimWriter) await lease.unsafe(query);
    await chmod(resolve(home, path), ServerLimit.FileMode);
  } catch {
    throw new TitanError(ErrorCode.ServerLocked, message);
  }
}

export function ownMaintenance(home: string, resources: AsyncDisposableStack): Promise<void> {
  return claim(home, ServerFile.MaintenanceLease, resources, ServerMessage.Maintenance);
}

export function ownOfflineHome(home: string, resources: AsyncDisposableStack): Promise<void> {
  return claim(home, ServerFile.Lease, resources, ServerMessage.Lock);
}

export async function ownStoppedHome(home: string, resources: AsyncDisposableStack): Promise<void> {
  const deadline = performance.now() + DaemonStartup.TimeoutMilliseconds;
  while (true) {
    await using attempt = new AsyncDisposableStack();
    try {
      await ownOfflineHome(home, attempt);
      resources.use(attempt.move());
      return;
    } catch (error) {
      if (performance.now() >= deadline) throw error;
    }
    await Bun.sleep(DaemonStartup.PollMilliseconds);
  }
}

export function ownUpdateCheck(home: string, resources: AsyncDisposableStack): Promise<void> {
  return claim(
    home,
    UpdatePolicy.CacheFile + ConfigWrite.LockSuffix,
    resources,
    UpdateMessage.Failed,
  );
}

export async function requestServerStop(home: string, idleOnly = true): Promise<void> {
  ServerStopResponseSchema.parse(
    await callAsPerson(home, ServerRoute.Stop, HttpMethod.Post, { idle_only: idleOnly }),
  );
}

async function copyCatalogFile(source: string, destination: string): Promise<void> {
  if (!(await exists(source))) return;
  if (!(await lstat(source)).isFile())
    throw new TitanError(ErrorCode.Arguments, UpdateMessage.BackupPath);
  await cp(source, destination);
}

export async function inspectUpdateCatalog(
  home: string,
  backup?: UpdateBackup,
  locate?: (root: string) => string,
): Promise<UpdateCatalog> {
  const filename = resolve(home, ServerFile.Database);
  if (!(await exists(filename))) return { projects: [], runs: [] };
  await using resources = new AsyncDisposableStack();
  const temporary = await mkdtemp(resolve(tmpdir(), UpdateFile.CatalogPrefix));
  resources.defer(() => rm(temporary, { recursive: true, force: true }));
  const copied = resolve(temporary, ServerFile.Database);
  for (const suffix of KnowledgeFile.SqliteSidecars)
    await copyCatalogFile(filename + suffix, copied + suffix);
  const database = new Bun.SQL({
    adapter: ServerDatabaseAdapter,
    filename: copied,
    readonly: true,
  });
  try {
    const rows = StoredRunSchema.array().parse(await database.unsafe(ServerSql.Stored));
    const projects = new Set<string>();
    const runs: string[] = [];
    for (const row of rows) {
      const store = new RunStore(row.root);
      const run =
        backup && locate
          ? await store.inspectCopy(locate(row.root), null)
          : await store.inspectCopy(row.root, null);
      projects.add(run.project);
      runs.push(row.root);
    }
    return { projects: [...projects].sort(), runs };
  } finally {
    await database.close();
  }
}

export async function assertUpdateSettled(home: string): Promise<void> {
  const path = resolve(home, UpdateFile.Transaction);
  if (!(await exists(path))) return;
  const transaction = UpdateTransactionSchema.parse(
    JSON.parse((await readFileBytes(path, IoLimit.DataBytes)).toString()),
  );
  if (transaction.phase !== UpdatePhase.Complete && transaction.phase !== UpdatePhase.RolledBack)
    throw new TitanError(ErrorCode.ServerLocked, UpdateMessage.RecoveryRequired);
}
