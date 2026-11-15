import { unit } from "@titan/test-factories";
import { requestRecoveryCases } from "../cases/request-recovery.ts";
import { requestRecovery } from "../factories/request-recovery.ts";

unit(requestRecovery, requestRecoveryCases);
