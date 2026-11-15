import { unit } from "@titan/test-factories";
import { inspectReadme } from "../../tooling/scripts/package-readmes.ts";
import { readmeCases, readmeFileCases } from "../cases/readmes.ts";
import { readmeFile } from "../factories/readmes.ts";

unit(inspectReadme, readmeCases);
unit(readmeFile, readmeFileCases);
