import { unit } from "@titan/test-factories";
import {
  engineFileModeCases,
  fileModeIdentityCases,
  snapshotModeCases,
} from "../cases/file-modes.ts";
import { engineFileMode, fileModeIdentity, snapshotMode } from "../factories/file-modes.ts";

unit(snapshotMode, snapshotModeCases);
unit(fileModeIdentity, fileModeIdentityCases);
unit(engineFileMode, engineFileModeCases);
