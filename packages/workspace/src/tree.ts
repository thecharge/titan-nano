import { opendir } from "node:fs/promises";
import { resolve } from "node:path";
import { ErrorCode, ErrorField, FileErrorCode, PathPart, TextSymbol } from "@titan/constants";
import { all, filePathCovers } from "@titan/core";
import { TitanError } from "@titan/errors";
import { snapshotSpecialFile, snapshotSymlink, WorkspaceMessage } from "@titan/messages";
import {
  type FileMap,
  FileReadPathsSchema,
  type SecretScannerFactory,
  WorkspaceEntryNameSchema,
  type WorkspaceLimitsInput,
  WorkspaceLimitsSchema,
  WorkspaceOmissionsSchema,
  type WorkspaceTraversal,
} from "@titan/types";
import { assertRelative } from "./paths.ts";
import { fileEntry, sourceVersion } from "./source.ts";

function traversal(
  input?: WorkspaceLimitsInput,
  omitted: readonly string[] = [],
): WorkspaceTraversal {
  return {
    limits: WorkspaceLimitsSchema.parse({
      max_workspace_entries: input?.max_workspace_entries,
      max_workspace_bytes: input?.max_workspace_bytes,
      max_workspace_depth: input?.max_workspace_depth,
    }),
    entries: 0,
    bytes: 0,
    omitted: WorkspaceOmissionsSchema.parse(omitted),
  };
}

function admit(state: WorkspaceTraversal, depth: number): void {
  if (depth > state.limits.max_workspace_depth)
    throw new TitanError(ErrorCode.WorkspaceDepth, WorkspaceMessage.Depth);
  if (state.entries >= state.limits.max_workspace_entries)
    throw new TitanError(ErrorCode.WorkspaceEntries, WorkspaceMessage.Entries);
  state.entries++;
}

async function collectTree(
  root: string,
  prefix: string,
  depth: number,
  inventory: Map<string, string>,
  state: WorkspaceTraversal,
  scanner?: SecretScannerFactory,
  selected?: readonly string[],
): Promise<void> {
  const directory = await opendir(resolve(root, prefix));
  for await (const item of directory) {
    if (!WorkspaceEntryNameSchema.safeParse(item.name).success) continue;
    const path = prefix ? [prefix, item.name].join(PathPart.Separator) : item.name;
    if (state.omitted.includes(path)) continue;
    if (
      selected &&
      !selected.some(
        (entry) =>
          entry === PathPart.Current || filePathCovers(entry, path) || filePathCovers(path, entry),
      )
    )
      continue;
    admit(state, depth);
    scanner?.().accept(Buffer.from(path));
    if (item.isSymbolicLink()) throw new TitanError(ErrorCode.UnsafeSymlink, snapshotSymlink(path));
    if (item.isDirectory())
      await collectTree(root, path, depth + 1, inventory, state, scanner, selected);
    else if (item.isFile()) inventory.set(path, TextSymbol.Empty);
    else throw new TitanError(ErrorCode.UnsupportedFile, snapshotSpecialFile(path));
  }
}

async function inventoryTree(
  root: string,
  limits?: WorkspaceLimitsInput,
  scanner?: SecretScannerFactory,
  omitted: readonly string[] = [],
  selected?: readonly string[],
): Promise<Map<string, string>> {
  const inventory = new Map<string, string>();
  try {
    await collectTree(
      root,
      TextSymbol.Empty,
      1,
      inventory,
      traversal(limits, omitted),
      scanner,
      selected,
    );
    await all(
      [...inventory.keys()].map((path) => async () => {
        inventory.set(path, await sourceVersion(resolve(root, path)));
      }),
    );
  } catch (error) {
    if (error instanceof Error && Reflect.get(error, ErrorField.Code) === FileErrorCode.Missing)
      throw new TitanError(ErrorCode.SnapshotChanged, root);
    throw error;
  }
  return inventory;
}

async function captureTree(
  root: string,
  inventory: Map<string, string>,
  state: WorkspaceTraversal,
  scanner?: SecretScannerFactory,
): Promise<FileMap> {
  const guarded = () => {
    const scoped = scanner?.();
    return {
      accept(bytes: Buffer) {
        state.bytes += bytes.length;
        if (state.bytes > state.limits.max_workspace_bytes)
          throw new TitanError(ErrorCode.WorkspaceBytes, WorkspaceMessage.Bytes);
        scoped?.accept(bytes);
      },
    };
  };
  try {
    return Object.fromEntries(
      await all(
        [...inventory.keys()].map((path) => async () => {
          scanner?.().accept(Buffer.from(path));
          const entry = await fileEntry(
            resolve(root, path),
            state.limits.max_workspace_bytes,
            guarded,
          );
          return [path, entry] as const;
        }),
      ),
    );
  } catch (error) {
    if (error instanceof Error && Reflect.get(error, ErrorField.Code) === FileErrorCode.Missing)
      throw new TitanError(ErrorCode.SnapshotChanged, root);
    throw error;
  }
}

export async function readTree(
  root: string,
  limits?: WorkspaceLimitsInput,
  scanner?: SecretScannerFactory,
  omitted: readonly string[] = [],
  selected?: readonly string[],
): Promise<FileMap> {
  const selection = selected === undefined ? undefined : FileReadPathsSchema.parse(selected);
  const before = await inventoryTree(root, limits, scanner, omitted, selection);
  const files = await captureTree(root, before, traversal(limits), scanner);
  const verified = await captureTree(root, before, traversal(limits), scanner);
  const after = await inventoryTree(root, limits, scanner, omitted, selection);
  if (
    before.size !== after.size ||
    before.size !== Object.keys(files).length ||
    before.size !== Object.keys(verified).length
  )
    throw new TitanError(ErrorCode.SnapshotChanged, root);
  for (const [path, version] of before)
    if (after.get(path) !== version || files[path]?.hash !== verified[path]?.hash)
      throw new TitanError(ErrorCode.SnapshotChanged, path);
  return Object.fromEntries(
    Object.entries(files).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function admitPath(state: WorkspaceTraversal, seen: Set<string>, path: string): void {
  const parts = assertRelative(path).split(PathPart.Separator);
  for (let depth = 1; depth <= parts.length; depth++) {
    const key = parts.slice(0, depth).join(PathPart.Separator);
    if (seen.has(key)) continue;
    admit(state, depth);
    seen.add(key);
  }
}

export function assertManifestBounds(files: FileMap, limits?: WorkspaceLimitsInput): void {
  const state = traversal(limits);
  const seen = new Set<string>();
  for (const [path, entry] of Object.entries(files)) {
    admitPath(state, seen, path);
    state.bytes += entry.bytes;
    if (!Number.isSafeInteger(state.bytes) || state.bytes > state.limits.max_workspace_bytes)
      throw new TitanError(ErrorCode.WorkspaceBytes, WorkspaceMessage.Bytes);
  }
}
