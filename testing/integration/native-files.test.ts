import { unit } from "@titan/test-factories";
import { nativeFileAccessCases, nativeFileAuditCases } from "../cases/native-audit.ts";
import {
  nativeFileIsolatedCases,
  nativeFileListingCases,
  nativeFileObservationCases,
  nativeServerFilesCases,
  nativeSharedReadsCases,
} from "../cases/native-files.ts";
import { nativeReadGrantCases } from "../cases/native-read-grants.ts";
import { nativeAuditScope } from "../factories/native-audit-scope.ts";
import {
  nativeFileIsolated,
  nativeFileListing,
  nativeFileObservation,
  nativeServerFiles,
  nativeSharedReads,
} from "../factories/native-files.ts";
import { nativeReadGrant } from "../factories/native-read-grants.ts";

unit(nativeFileObservation, nativeFileObservationCases);
unit(nativeFileListing, nativeFileListingCases);
unit(nativeAuditScope, nativeFileAuditCases);
unit(nativeFileIsolated, nativeFileIsolatedCases);
unit(nativeAuditScope, nativeFileAccessCases);
unit(nativeServerFiles, nativeServerFilesCases);
unit(nativeSharedReads, nativeSharedReadsCases);
unit(nativeReadGrant, nativeReadGrantCases);
