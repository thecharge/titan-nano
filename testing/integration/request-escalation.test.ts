import { unit } from "@titan/test-factories";
import { requestEscalationCases } from "../cases/request-escalation.ts";
import { requestEscalation } from "../factories/request-escalation.ts";

unit(requestEscalation, requestEscalationCases);
