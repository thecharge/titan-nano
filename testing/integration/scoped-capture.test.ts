import { unit } from "@titan/test-factories";
import {
  scopedCaptureCases,
  scopedDependencyCases,
  scopedRecoveryCases,
  scopedRollbackConflictCases,
} from "../cases/scoped-capture.ts";
import { sealedCaptureRecovery } from "../factories/capture-recovery.ts";
import { nativeFileObservation } from "../factories/native-files.ts";
import { scopedCapture, scopedRollbackConflict } from "../factories/scoped-capture.ts";

unit(scopedCapture, scopedCaptureCases);
unit(scopedRollbackConflict, scopedRollbackConflictCases);
unit(nativeFileObservation, scopedDependencyCases);
unit(sealedCaptureRecovery, scopedRecoveryCases);
