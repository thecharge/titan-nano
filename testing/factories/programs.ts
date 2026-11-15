import { chmod, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { requireProgram } from "@titan/core";
import { withTemporaryDirectory } from "@titan/test-framework/files";

export async function programFile(mode: string, executable: boolean) {
  return withTemporaryDirectory(async (root) => {
    const path = resolve(root, "program");
    if (mode === "directory") await mkdir(path);
    if (mode === "regular" || mode === "nonexec") {
      await writeFile(path, Buffer.from("program fixture"));
      await chmod(path, mode === "regular" ? 0o700 : 0o600);
    }
    await requireProgram(path, executable);
    return true;
  });
}
