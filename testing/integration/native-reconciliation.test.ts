import { unit } from "@titan/test-factories";
import {
  nativeReconciliationCases,
  nativeScriptReconciliationCases,
  nativeSplitReconciliationCases,
} from "../cases/native-reconciliation.ts";
import {
  nativeReconciliation,
  nativeScriptReconciliation,
  nativeSplitReconciliation,
} from "../factories/native-reconciliation.ts";

unit(nativeReconciliation, nativeReconciliationCases);
unit(nativeScriptReconciliation, nativeScriptReconciliationCases);

unit(nativeSplitReconciliation, nativeSplitReconciliationCases);
