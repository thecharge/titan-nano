import { unit } from "@titan/test-factories";
import { isOutgoingTip } from "../../tooling/scripts/hook-revisions.ts";
import {
  hookDependencyCases,
  hookGateCases,
  hookMessageCases,
  hookMessageFileCases,
  hookRevisionCases,
  hookSecretCases,
  hookSnapshotCases,
  hookVerificationEnvironmentCases,
  outgoingTipCases,
} from "../cases/hooks.ts";
import {
  commitMessageVerification,
  dependencyIsolation,
  gateOutcome,
  hookVerificationEnvironment,
  messageFileBytes,
  revisionInventory,
  secretFileVerification,
  snapshotIsolation,
} from "../factories/hooks.ts";

unit(revisionInventory, hookRevisionCases);
unit(isOutgoingTip, outgoingTipCases);
unit(snapshotIsolation, hookSnapshotCases);
unit(dependencyIsolation, hookDependencyCases);
unit(secretFileVerification, hookSecretCases);
unit(commitMessageVerification, hookMessageCases);
unit(gateOutcome, hookGateCases);
unit(messageFileBytes, hookMessageFileCases);

unit(hookVerificationEnvironment, hookVerificationEnvironmentCases);
