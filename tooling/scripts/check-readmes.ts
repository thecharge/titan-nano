import { resolve } from "node:path";
import { HookFile } from "@titan/constants";
import { checkPackageReadme } from "./package-readmes.ts";
import { readWorkspaces } from "./workspaces.ts";

const root = resolve(import.meta.dir, HookFile.RepositoryRoot);
let failures = 0;
const packages = await readWorkspaces(root);
for (const owner of packages) {
  const findings = await checkPackageReadme(root, owner.directory, owner.manifest.name);
  if (!findings.length) continue;
  failures += findings.length;
  console.error(JSON.stringify({ package: owner.manifest.name, findings }));
}
console.log(JSON.stringify({ packages: packages.length - 1, failures }));
process.exitCode = failures ? 1 : 0;
