import { fileURLToPath } from "node:url";
import { FileEncoding, IoLimit, Packaging, VendorPackage } from "@titan/constants";
import { readFileBytes } from "@titan/streams";
import { CodexNativeDependencySchema } from "@titan/types";

export async function nativeCodexVersion(entry: string): Promise<string> {
  const path = fileURLToPath(new URL(Packaging.VendorManifest, entry));
  const bytes = await readFileBytes(path, IoLimit.DataBytes);
  const manifest = CodexNativeDependencySchema.parse(JSON.parse(bytes.toString(FileEncoding.Utf8)));
  return manifest.dependencies[VendorPackage.CodexCli];
}
