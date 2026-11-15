import { dirname } from "node:path";
import { HarnessSdk, HarnessSdkOwners, SdkOwner } from "@titan/constants";

function resolvable(name: string, from: string): string | undefined {
  try {
    return Bun.resolveSync(name, from);
  } catch {
    return undefined;
  }
}

export function sdkInstalled(name: string, from = import.meta.dir): boolean {
  if (resolvable(name, from)) return true;
  if (name === HarnessSdk.Codex && resolvable(SdkOwner.CodexManifest, from)) return true;
  const runtime = resolvable(SdkOwner.Runtime, from);
  const entry = HarnessSdkOwners.find((item) => item.sdk === name);
  const owner = runtime && entry ? resolvable(entry.owner, dirname(runtime)) : undefined;
  return owner !== undefined && resolvable(name, dirname(owner)) !== undefined;
}
