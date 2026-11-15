import { unit } from "@titan/test-factories";
import { captureRecoveryCases, sealedCaptureRecoveryCases } from "../cases/capture-recovery.ts";
import {
  reconciliationKnowledgeCases,
  reconciliationRecoveryCases,
  reconciliationRefusalCases,
  scriptReconciliationCases,
  splitReconciliationCases,
} from "../cases/reconciliation.ts";
import { snapshotReconciliationCases } from "../cases/snapshot-reconciliation.ts";
import { captureRecovery, sealedCaptureRecovery } from "../factories/capture-recovery.ts";
import {
  reconciliationKnowledge,
  reconciliationRecovery,
  reconciliationRefusal,
  scriptReconciliation,
  splitReconciliation,
} from "../factories/reconciliation.ts";
import { snapshotReconciliation } from "../factories/snapshot-reconciliation.ts";

unit(captureRecovery, captureRecoveryCases);
unit(sealedCaptureRecovery, sealedCaptureRecoveryCases);
unit(reconciliationRecovery, reconciliationRecoveryCases);
unit(reconciliationKnowledge, reconciliationKnowledgeCases);

unit(reconciliationRefusal, reconciliationRefusalCases);
unit(scriptReconciliation, scriptReconciliationCases);
unit(splitReconciliation, splitReconciliationCases);
unit(snapshotReconciliation, snapshotReconciliationCases);
