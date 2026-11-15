import { mkdir } from "node:fs/promises";
import { join } from "node:path";

export async function stateFile(cwd, name) {
  const directory = join(cwd, ".titan/vendor-fixture");
  await mkdir(directory, { recursive: true });
  return join(directory, name);
}
