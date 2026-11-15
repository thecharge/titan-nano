import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { checkPackageReadme } from "../../tooling/scripts/package-readmes.ts";
import { readmeFixture } from "../cases/readmes.ts";

export async function readmeFile(
  present: boolean,
  directory: string,
  name: string,
  text: string = readmeFixture,
) {
  return withTemporaryDirectory(async (root) => {
    await mkdir(join(root, directory), { recursive: true });
    if (present) await writeFile(join(root, directory, "README.md"), Buffer.from(text));
    return checkPackageReadme(root, directory, name);
  });
}
