import { unit } from "@titan/test-factories";
import {
  attemptInputAdmissionCases,
  attemptInputPublicationCases,
  attemptInputRecoveryCases,
} from "../cases/attempt-input.ts";
import { attemptInputPublication, attemptInputRecovery } from "../factories/attempt-input.ts";
import { attemptInputAdmission } from "../factories/attempt-input-admission.ts";

unit(attemptInputRecovery, attemptInputRecoveryCases);

unit(attemptInputPublication, attemptInputPublicationCases);

unit(attemptInputAdmission, attemptInputAdmissionCases);
