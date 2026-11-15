import { readFile, symlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { DocumentationFormat, DocumentationFormatConfiguration, IoLimit } from "@titan/constants";
import { thrownBy } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { checkDocumentationFormat } from "../../tooling/scripts/check-format-docs.ts";

export async function documentationFormatting(file: string, source: string) {
  return withTemporaryDirectory(async (root) => {
    await writeFile(
      resolve(root, DocumentationFormat.File),
      JSON.stringify(DocumentationFormatConfiguration),
    );
    await symlink(resolve(import.meta.dir, "../../node_modules"), resolve(root, "node_modules"));
    const path = resolve(root, file);
    const before = Buffer.from(source);
    await writeFile(path, before);
    const code = await checkDocumentationFormat(root);
    return { code, unchanged: before.equals(await readFile(path)) };
  });
}

export async function documentationAdmission(policy: unknown, oversized = false) {
  return withTemporaryDirectory(async (root) => {
    await writeFile(
      resolve(root, DocumentationFormat.File),
      oversized ? Buffer.alloc(IoLimit.DataBytes + 1) : Buffer.from(JSON.stringify(policy)),
    );
    let spawned = 0;
    let code: number | null = null;
    const error = await thrownBy(async () => {
      code = await checkDocumentationFormat(root, async () => {
        spawned++;
        return 0;
      });
    });
    return { admitted: !(error instanceof Error), spawned, code };
  });
}
