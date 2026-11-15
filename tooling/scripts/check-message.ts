import { resolve } from "node:path";
import { HookFile } from "@titan/constants";
import { runMessagePolicy } from "./hand-changes.ts";

process.exitCode = await runMessagePolicy(
  resolve(import.meta.dir, HookFile.RepositoryRoot),
  process.argv[2],
);
