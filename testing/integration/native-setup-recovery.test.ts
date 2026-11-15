import { unit } from "@titan/test-factories";
import {
  nativeSetupRecordCases,
  nativeSetupRecoveryCases,
} from "../cases/native-setup-recovery.ts";
import { nativeSetupRecord, nativeSetupRecovery } from "../factories/native-setup-recovery.ts";

unit(nativeSetupRecovery, nativeSetupRecoveryCases);

unit(nativeSetupRecord, nativeSetupRecordCases);
