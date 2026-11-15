import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AgentHost, NativeTool, Packaging } from "@titan/constants";
import { NativeToolLaunchSchema } from "@titan/types";

export function nativeToolLaunch() {
  const entry = import.meta.path.endsWith(AgentHost.SourceExtension)
    ? fileURLToPath(import.meta.resolve(NativeTool.Source))
    : resolve(import.meta.dir, Packaging.NativeToolBundle);
  return NativeToolLaunchSchema.parse({
    command: process.execPath,
    args: [AgentHost.SmallHeap, entry],
  });
}
