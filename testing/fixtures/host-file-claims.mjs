import { FileAccessMode } from "@titan/constants";
import { claimHostFiles } from "@titan/runtime";
import { agentSpec } from "@titan/test-factories";

const resources = new AsyncDisposableStack();
const spec = agentSpec(String(process.argv[2]));
spec.file_scope = { mode: FileAccessMode.Write, paths: [String(process.argv[3])] };
await claimHostFiles(spec, resources);
process.on("message", async () => {
  await resources.disposeAsync();
  process.exit(0);
});
process.send?.({ ready: true });
