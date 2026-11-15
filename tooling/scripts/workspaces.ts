import { dirname, join } from "node:path";
import { ErrorCode, FileEncoding, HookFile, TextSymbol } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { VerificationMessage } from "@titan/messages";
import {
  HookManifestSchema,
  type HookWorkspace,
  type InventoryReadLimitsInput,
  InventoryReadLimitsSchema,
} from "@titan/types";
import { readInventoryBytes } from "./inventory-bytes.ts";

export async function readWorkspaces(
  snapshot: string,
  input: InventoryReadLimitsInput = {},
): Promise<HookWorkspace[]> {
  const limits = InventoryReadLimitsSchema.parse(input);
  const bytes = await readInventoryBytes(
    join(snapshot, HookFile.Manifest),
    limits.manifest_bytes,
    limits.total_bytes,
  );
  let total = bytes.length;
  const root = HookManifestSchema.parse(JSON.parse(bytes.toString(FileEncoding.Utf8)));
  const patterns = root.workspaces?.packages ?? [];
  if (patterns.length > limits.max_patterns)
    throw new TitanError(ErrorCode.VerificationBudget, VerificationMessage.BoundaryBudget);
  const manifests = new Set<string>();
  const addPattern = async (pattern: string): Promise<void> => {
    for await (const file of new Bun.Glob(pattern + HookFile.ManifestSuffix).scan({
      cwd: snapshot,
    })) {
      if (manifests.has(file)) continue;
      if (manifests.size + 1 >= limits.max_workspaces)
        throw new TitanError(ErrorCode.VerificationBudget, VerificationMessage.BoundaryBudget);
      manifests.add(file);
    }
  };
  for (const pattern of patterns) await addPattern(pattern);
  const results: HookWorkspace[] = [{ directory: TextSymbol.Dot, manifest: root }];
  for (const file of manifests) {
    const document = await readInventoryBytes(
      join(snapshot, file),
      limits.manifest_bytes,
      limits.total_bytes - total,
    );
    total += document.length;
    const manifest = HookManifestSchema.parse(JSON.parse(document.toString(FileEncoding.Utf8)));
    results.push({ directory: dirname(file), manifest });
  }
  return results;
}
