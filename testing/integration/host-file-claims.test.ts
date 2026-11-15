import { unit } from "@titan/test-factories";
import {
  hostFileBoundsCases,
  hostFileClaimsCases,
  hostFileLeaseGuardCases,
  hostFilePathGuardCases,
  hostFileRecoveryCases,
} from "../cases/host-file-claims.ts";
import {
  hostFileBounds,
  hostFileClaims,
  hostFileLeaseGuard,
  hostFilePathGuard,
  hostFileRecovery,
} from "../factories/host-file-claims.ts";

unit(hostFileClaims, hostFileClaimsCases);

unit(hostFilePathGuard, hostFilePathGuardCases);

unit(hostFileRecovery, hostFileRecoveryCases);

unit(hostFileBounds, hostFileBoundsCases);

unit(hostFileLeaseGuard, hostFileLeaseGuardCases);
