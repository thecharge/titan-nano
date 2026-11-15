import { unit } from "@titan/test-factories";
import { artifactExportCases } from "../cases/artifact-export.ts";
import { artifactExport } from "../factories/artifact-export.ts";

unit(artifactExport, artifactExportCases);
