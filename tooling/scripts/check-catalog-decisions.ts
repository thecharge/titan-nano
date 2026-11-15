import { join } from "node:path";
import { CatalogDecisionFile, FileEncoding, IoLimit } from "@titan/constants";
import { readFileBytes } from "@titan/streams";
import { CatalogManifestSchema } from "@titan/types";

export async function checkCatalogDecisions(directory: string): Promise<string[]> {
  const manifest = CatalogManifestSchema.parse(
    JSON.parse(
      (
        await readFileBytes(join(directory, CatalogDecisionFile.Manifest), IoLimit.DataBytes)
      ).toString(FileEncoding.Utf8),
    ),
  );
  const design = (
    await readFileBytes(join(directory, CatalogDecisionFile.Design), IoLimit.DataBytes)
  ).toString(FileEncoding.Utf8);
  return Object.keys(manifest.workspaces?.catalog ?? {}).filter((name) => !design.includes(name));
}
