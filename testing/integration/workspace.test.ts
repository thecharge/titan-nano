import { unit } from "@titan/test-factories";
import { assertRelative } from "@titan/workspace";
import {
  legacyHashCases,
  relativePathCases,
  snapshotCases,
  versionedSourceCases,
  workspaceCopyBatchCases,
  workspaceExistsCases,
  workspaceSelectedCases,
  workspaceVisibleCases,
} from "../cases/workspace.ts";
import {
  legacySnapshotHash,
  snapshotRoundTrip,
  versionedSource,
  workspaceCopyBatch,
  workspaceExists,
  workspaceSelected,
  workspaceVisibleFiles,
} from "../factories/workspace.ts";

unit(snapshotRoundTrip, snapshotCases);

unit(legacySnapshotHash, legacyHashCases);

unit(assertRelative, relativePathCases);

unit(workspaceVisibleFiles, workspaceVisibleCases);

unit(workspaceCopyBatch, workspaceCopyBatchCases);
unit(versionedSource, versionedSourceCases);
unit(workspaceSelected, workspaceSelectedCases);
unit(workspaceExists, workspaceExistsCases);
