import { constants } from "node:fs";
import { lstat, mkdir, open, opendir, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import {
  AgentHost,
  ErrorCode,
  ErrorField,
  FileErrorCode,
  KnowledgeFile,
  ServerDatabaseAdapter,
  ServerLimit,
  ServerSql,
  WorkspaceFileLinks,
} from "@titan/constants";
import { fileScopesOverlap } from "@titan/core";
import { OperationalError } from "@titan/errors";
import { AgentHostMessage } from "@titan/messages";
import {
  type AgentSpec,
  AgentSpecSchema,
  HostClaimRowSchema,
  HostClaimRowsSchema,
  HostFileClaimSchema,
  HostLeaseErrorSchema,
} from "@titan/types";

async function directory(path: string): Promise<void> {
  await mkdir(path, { recursive: true, mode: ServerLimit.DirectoryMode });
  if (!(await lstat(path)).isDirectory())
    throw new OperationalError(ErrorCode.ExecutionInterrupted, AgentHostMessage.Busy);
}

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
  const status = await file.stat();
  if (
    !status.isFile() ||
    status.nlink !== WorkspaceFileLinks ||
    (process.getuid && status.uid !== process.getuid())
  )
    throw new OperationalError(ErrorCode.ExecutionInterrupted, AgentHostMessage.Busy);
}

async function database(path: string, resources: AsyncDisposableStack): Promise<Bun.SQL> {
  for (const suffix of KnowledgeFile.SqliteSidecars)
    await guardLease(path + suffix, resources, suffix.length === 0);
  const lease = new Bun.SQL({ adapter: ServerDatabaseAdapter, filename: path });
  resources.defer(() => lease.close());
  return lease;
}

async function claim(path: string, write: boolean, resources: AsyncDisposableStack): Promise<void> {
  const lease = await database(path, resources);
  for (const query of write ? ServerSql.ClaimWriter : AgentHost.ReadLease)
    await lease.unsafe(query);
}

async function boundedClaims(root: string): Promise<void> {
  let count = 0;
  for await (const entry of await opendir(root)) {
    if (
      !entry.isFile() ||
      !AgentHost.ClaimName.test(entry.name) ||
      Number.parseInt(entry.name, 10) >= AgentHost.MaximumClaims ||
      count >= AgentHost.MaximumClaims * 4
    )
      throw new OperationalError(ErrorCode.ExecutionInterrupted, AgentHostMessage.Busy);
    count++;
  }
}

export async function claimHostFiles(
  input: AgentSpec,
  resources: AsyncDisposableStack,
): Promise<void> {
  const spec = AgentSpecSchema.parse(input);
  await mkdir(spec.cwd, { recursive: true });
  const root = resolve(await realpath(spec.cwd), AgentHost.Directory);
  await using acquired = new AsyncDisposableStack();
  await directory(root);
  try {
    await using admission = new AsyncDisposableStack();
    await claim(resolve(root, AgentHost.AdmissionLease), true, admission);
    await claim(resolve(root, AgentHost.Lease), spec.file_scope === undefined, acquired);
    if (spec.file_scope) await claimScopes(root, spec, acquired);
    resources.use(acquired.move());
  } catch {
    throw new OperationalError(ErrorCode.ExecutionInterrupted, AgentHostMessage.Busy);
  }
}

async function claimScopes(
  root: string,
  spec: AgentSpec,
  resources: AsyncDisposableStack,
): Promise<void> {
  const project = await realpath(spec.cwd);
  const current = HostFileClaimSchema.parse({
    run_id: spec.run_id,
    execution_id: spec.execution_id,
    binding: spec.file_scope?.claim,
    mode: spec.file_scope?.mode,
    paths: spec.file_scope?.paths.map((path) => resolve(project, path)),
    read_paths: spec.file_scope?.read_paths?.map((path) => resolve(project, path)),
  });
  const rootClaims = resolve(root, AgentHost.ClaimsDirectory);
  await directory(rootClaims);
  await boundedClaims(rootClaims);
  await using catalogueResources = new AsyncDisposableStack();
  const catalogue = await database(resolve(root, AgentHost.ScopeCatalogue), catalogueResources);
  await catalogue.unsafe(AgentHost.CatalogueInitialize);
  const rows = HostClaimRowsSchema.parse(await catalogue.unsafe(AgentHost.CatalogueRead));
  const occupied = new Set<number>();
  for (const row of rows) {
    const previous = HostFileClaimSchema.parse(JSON.parse(row.record));
    if (await alive(resolve(rootClaims, row.slot + AgentHost.ClaimSuffix))) {
      occupied.add(row.slot);
      if (fileScopesOverlap(current, previous))
        throw new OperationalError(ErrorCode.ExecutionInterrupted, AgentHostMessage.Busy);
    } else await catalogue.unsafe(AgentHost.CatalogueDelete, [row.slot]);
  }
  let slot = 0;
  while (occupied.has(slot)) slot++;
  HostClaimRowSchema.shape.slot.parse(slot);
  await claim(resolve(rootClaims, slot + AgentHost.ClaimSuffix), true, resources);
  await catalogue.unsafe(AgentHost.CatalogueInsert, [slot, JSON.stringify(current)]);
}

async function alive(path: string): Promise<boolean> {
  await using resources = new AsyncDisposableStack();
  const lease = await database(path, resources);
  try {
    for (const query of AgentHost.ProbeLease) await lease.unsafe(query);
    return false;
  } catch (error) {
    if (!HostLeaseErrorSchema.safeParse(error).success) throw error;
    return true;
  }
}
